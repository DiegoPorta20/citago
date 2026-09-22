import {
  FixedClock,
  InMemoryTenantRepository,
} from '../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import {
  AgendaReportQuery,
  type AgendaReportFilters,
  type StaffMemberAppointments,
  type StatusCount,
} from '../../appointments/application/ports/agenda-report.query.js';
import { AppointmentStatus } from '../../appointments/domain/appointment-status.js';
import type { ClientRepository } from '../../clients/domain/client.repository.js';
import {
  SalesReportQuery,
  type PaymentMethodTotal,
  type SalesTotals,
  type ServiceSales,
  type StaffMemberSales,
} from '../../sales/application/ports/sales-report.query.js';
import { PaymentMethod } from '../../sales/domain/payment-method.js';
import { StaffScope } from '../../staff/application/staff-scope.js';
import { StaffMember } from '../../staff/domain/staff-member.entity.js';
import type { StaffRepository } from '../../staff/domain/staff.repository.js';
import { BusinessType } from '../../tenants/domain/business-type.js';
import { Tenant } from '../../tenants/domain/tenant.entity.js';
import { DashboardPeriod } from './dashboard-period.js';
import {
  DashboardPeriodInvertedError,
  DashboardRangeTooWideError,
} from './dashboard.errors.js';
import { GetBusinessDashboardUseCase } from './get-business-dashboard.use-case.js';
import { GetOwnDashboardUseCase } from './get-own-dashboard.use-case.js';

const TENANT_ID = 'tenant-1';
/** 2026-09-21 20:00 UTC is still 15:00 of the 21st in Lima (UTC-5). */
const NOW = new Date('2026-09-21T20:00:00.000Z');

const auth = (role: UserRole, userId = 'user-1'): AuthContext => ({
  userId,
  tenantId: TENANT_ID,
  membershipId: 'membership-1',
  role,
});

class StubAgendaReport extends AgendaReportQuery {
  statuses: StatusCount[] = [];
  staff: StaffMemberAppointments[] = [];
  lastFilters: AgendaReportFilters | undefined;
  lastRange: { from: Date; to: Date } | undefined;

  async countByStatus(
    _tenantId: string,
    range: { start: Date; end: Date },
    filters?: AgendaReportFilters,
  ): Promise<StatusCount[]> {
    this.lastFilters = filters;
    this.lastRange = { from: range.start, to: range.end };

    return this.statuses;
  }

  async byStaffMember(): Promise<StaffMemberAppointments[]> {
    return this.staff;
  }
}

class StubSalesReport extends SalesReportQuery {
  totalsResult: SalesTotals = {
    paid: '0.00',
    paidCount: 0,
    pending: '0.00',
    pendingCount: 0,
    refunded: '0.00',
    refundedCount: 0,
  };
  methods: PaymentMethodTotal[] = [];
  staff: StaffMemberSales[] = [];
  services: ServiceSales[] = [];

  async totals(): Promise<SalesTotals> {
    return this.totalsResult;
  }

  async byPaymentMethod(): Promise<PaymentMethodTotal[]> {
    return this.methods;
  }

  async byStaffMember(): Promise<StaffMemberSales[]> {
    return this.staff;
  }

  async topServices(): Promise<ServiceSales[]> {
    return this.services;
  }
}

function staffMember(id: string, name: string, userId?: string): StaffMember {
  return StaffMember.create(
    { id, tenantId: TENANT_ID, displayName: name, userId },
    NOW,
  );
}

describe('Dashboard', () => {
  let tenants: InMemoryTenantRepository;
  let period: DashboardPeriod;
  let agenda: StubAgendaReport;
  let sales: StubSalesReport;
  let members: StaffMember[];
  let clients: ClientRepository;
  let staff: StaffRepository;

  beforeEach(async () => {
    tenants = new InMemoryTenantRepository();
    await tenants.save(
      Tenant.create(
        {
          id: TENANT_ID,
          name: 'Barbería Demo',
          slug: 'barberia-demo',
          businessType: BusinessType.Barbershop,
          country: 'PE',
          currency: 'PEN',
          timezone: 'America/Lima',
        },
        NOW,
      ),
    );

    period = new DashboardPeriod(tenants, new FixedClock(NOW));
    agenda = new StubAgendaReport();
    sales = new StubSalesReport();
    members = [staffMember('staff-1', 'Carlos', 'user-1')];

    clients = {
      countCreatedBetween: async () => 4,
    } as unknown as ClientRepository;
    staff = {
      list: async () => members,
      findByUserId: async (_tenantId: string, userId: string) =>
        members.find((member) => member.userId === userId) ?? null,
    } as unknown as StaffRepository;
  });

  describe('the period (rule TZ-2)', () => {
    it('defaults to the local day of the business, not the UTC one', async () => {
      const resolved = await period.resolve(TENANT_ID);

      expect(resolved.from).toBe('2026-09-21');
      expect(resolved.to).toBe('2026-09-21');
      // Lima is UTC-5: the local day starts at 05:00 UTC and lasts 24 hours.
      expect(resolved.range.start.toISOString()).toBe(
        '2026-09-21T05:00:00.000Z',
      );
      expect(resolved.range.end.toISOString()).toBe('2026-09-22T05:00:00.000Z');
    });

    it('covers both ends of an explicit period, inclusive', async () => {
      const resolved = await period.resolve(TENANT_ID, {
        from: '2026-09-01',
        to: '2026-09-30',
      });

      expect(resolved.range.start.toISOString()).toBe(
        '2026-09-01T05:00:00.000Z',
      );
      expect(resolved.range.end.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    });

    it('carries the currency of the business', async () => {
      await expect(period.resolve(TENANT_ID)).resolves.toMatchObject({
        currency: 'PEN',
        timezone: 'America/Lima',
      });
    });

    it('rejects a period that ends before it starts', async () => {
      await expect(
        period.resolve(TENANT_ID, { from: '2026-09-30', to: '2026-09-01' }),
      ).rejects.toThrow(DashboardPeriodInvertedError);
    });

    it('rejects a period longer than a year', async () => {
      await expect(
        period.resolve(TENANT_ID, { from: '2024-01-01', to: '2026-01-01' }),
      ).rejects.toThrow(DashboardRangeTooWideError);
    });
  });

  describe('business summary', () => {
    let useCase: GetBusinessDashboardUseCase;

    beforeEach(() => {
      useCase = new GetBusinessDashboardUseCase(
        period,
        sales,
        agenda,
        clients,
        staff,
      );
    });

    it('adds up the agenda counters from the status breakdown', async () => {
      agenda.statuses = [
        { status: AppointmentStatus.Completed, count: 30 },
        { status: AppointmentStatus.Cancelled, count: 5 },
        { status: AppointmentStatus.NoShow, count: 2 },
        { status: AppointmentStatus.Pending, count: 3 },
      ];

      const result = await useCase.execute(auth(UserRole.Owner), {});

      expect(result.appointments).toMatchObject({
        total: 40,
        completed: 30,
        cancelled: 5,
        noShow: 2,
      });
    });

    it('reports revenue with the money that was actually taken', async () => {
      sales.totalsResult = {
        paid: '820.00',
        paidCount: 28,
        pending: '50.00',
        pendingCount: 2,
        refunded: '25.00',
        refundedCount: 1,
      };
      sales.methods = [
        { method: PaymentMethod.Cash, total: '600.00', count: 20 },
        { method: PaymentMethod.Card, total: '220.00', count: 8 },
      ];

      const result = await useCase.execute(auth(UserRole.Admin), {});

      expect(result.currency).toBe('PEN');
      expect(result.revenue).toMatchObject({
        paid: '820.00',
        pending: '50.00',
        refunded: '25.00',
      });
      expect(result.revenue.byPaymentMethod).toHaveLength(2);
    });

    it('lists every staff member, including the ones with nothing to show', async () => {
      members = [
        staffMember('staff-1', 'Carlos', 'user-1'),
        staffMember('staff-2', 'Luis'),
      ];
      agenda.staff = [{ staffMemberId: 'staff-1', completed: 16, noShow: 1 }];
      sales.staff = [{ staffMemberId: 'staff-1', total: '400.00', count: 16 }];

      const result = await useCase.execute(auth(UserRole.Owner), {});

      expect(result.staff).toEqual([
        {
          staffMemberId: 'staff-1',
          name: 'Carlos',
          completedAppointments: 16,
          noShowAppointments: 1,
          revenue: '400.00',
          saleCount: 16,
        },
        {
          staffMemberId: 'staff-2',
          name: 'Luis',
          completedAppointments: 0,
          noShowAppointments: 0,
          revenue: '0.00',
          saleCount: 0,
        },
      ]);
    });

    it('counts the clients the business gained', async () => {
      const result = await useCase.execute(auth(UserRole.Owner), {});

      expect(result.clients.created).toBe(4);
    });
  });

  describe('own dashboard', () => {
    let useCase: GetOwnDashboardUseCase;

    beforeEach(() => {
      useCase = new GetOwnDashboardUseCase(
        period,
        agenda,
        new StaffScope(staff),
      );
    });

    it('asks only for the agenda of the staff member behind the session', async () => {
      agenda.statuses = [{ status: AppointmentStatus.Completed, count: 7 }];

      const result = await useCase.execute(auth(UserRole.Staff), {});

      expect(agenda.lastFilters).toEqual({ staffMemberId: 'staff-1' });
      expect(result.staffMemberId).toBe('staff-1');
      expect(result.appointments.completed).toBe(7);
    });

    it('returns zeros for an account with no staff member, never someone elses numbers', async () => {
      agenda.statuses = [{ status: AppointmentStatus.Completed, count: 99 }];

      const result = await useCase.execute(auth(UserRole.Staff, 'user-9'), {});

      expect(result.staffMemberId).toBeNull();
      expect(result.appointments).toMatchObject({ total: 0, completed: 0 });
    });

    it('carries no money at all', async () => {
      const result = await useCase.execute(auth(UserRole.Staff), {});

      expect(Object.keys(result)).toEqual([
        'period',
        'staffMemberId',
        'appointments',
      ]);
    });
  });
});

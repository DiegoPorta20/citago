import {
  InMemoryMembershipRepository,
  InMemoryTenantRepository,
} from '../../../../../test/support/fakes/identity.fakes.js';
import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { BusinessType } from '../../../tenants/domain/business-type.js';
import { Tenant } from '../../../tenants/domain/tenant.entity.js';
import { Membership } from '../../domain/membership.entity.js';
import { ListMyTenantsUseCase } from './list-my-tenants.use-case.js';

const NOW = new Date('2026-10-20T12:00:00.000Z');

describe('ListMyTenantsUseCase', () => {
  let memberships: InMemoryMembershipRepository;
  let tenants: InMemoryTenantRepository;
  let useCase: ListMyTenantsUseCase;

  const tenant = (id: string, name: string, at: Date = NOW) =>
    Tenant.create(
      {
        id,
        name,
        slug: id,
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
      },
      at,
    );

  const membership = (id: string, tenantId: string, role: UserRole, at: Date) =>
    Membership.create({ id, tenantId, userId: 'user-1', role }, at);

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    role: UserRole.Owner,
  };

  beforeEach(() => {
    memberships = new InMemoryMembershipRepository();
    tenants = new InMemoryTenantRepository();
    useCase = new ListMyTenantsUseCase(memberships, tenants);
  });

  it('lists active memberships of available businesses, flagging the current one', async () => {
    const earlier = new Date(NOW.getTime() - 1000);
    await tenants.save(tenant('tenant-1', 'Barbería Uno'));
    await tenants.save(tenant('tenant-2', 'Barbería Dos'));
    await memberships.save(
      membership('membership-1', 'tenant-1', UserRole.Owner, earlier),
    );
    await memberships.save(
      membership('membership-2', 'tenant-2', UserRole.Staff, NOW),
    );

    const result = await useCase.execute(actor);

    expect(result).toEqual([
      {
        tenantId: 'tenant-1',
        tenantName: 'Barbería Uno',
        role: UserRole.Owner,
        current: true,
      },
      {
        tenantId: 'tenant-2',
        tenantName: 'Barbería Dos',
        role: UserRole.Staff,
        current: false,
      },
    ]);
  });

  it('omits memberships whose business is suspended', async () => {
    const suspended = tenant('tenant-2', 'Suspendida');
    suspended.suspend(NOW);
    await tenants.save(tenant('tenant-1', 'Activa'));
    await tenants.save(suspended);
    await memberships.save(
      membership('membership-1', 'tenant-1', UserRole.Owner, NOW),
    );
    await memberships.save(
      membership('membership-2', 'tenant-2', UserRole.Staff, NOW),
    );

    const result = await useCase.execute(actor);

    expect(result).toHaveLength(1);
    expect(result[0]?.tenantId).toBe('tenant-1');
  });

  it('omits revoked memberships', async () => {
    await tenants.save(tenant('tenant-1', 'Activa'));
    await tenants.save(tenant('tenant-2', 'Otra'));
    await memberships.save(
      membership('membership-1', 'tenant-1', UserRole.Owner, NOW),
    );
    const revoked = membership('membership-2', 'tenant-2', UserRole.Staff, NOW);
    revoked.deactivate(NOW);
    await memberships.save(revoked);

    const result = await useCase.execute(actor);

    expect(result.map((row) => row.tenantId)).toEqual(['tenant-1']);
  });
});

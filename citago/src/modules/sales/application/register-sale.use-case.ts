import { Injectable } from '@nestjs/common';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { Clock } from '../../../shared/application/ports/clock.port.js';
import { IdGenerator } from '../../../shared/application/ports/id-generator.port.js';
import { TransactionRunner } from '../../../shared/application/ports/transaction-runner.port.js';
import { Money } from '../../../shared/domain/money.js';
import type { Appointment } from '../../appointments/domain/appointment.entity.js';
import { AppointmentNotFoundError } from '../../appointments/domain/appointment.errors.js';
import { AppointmentRepository } from '../../appointments/domain/appointment.repository.js';
import { AppointmentStatus } from '../../appointments/domain/appointment-status.js';
import { ServiceNotFoundError } from '../../catalog/domain/errors/catalog.errors.js';
import { ServiceRepository } from '../../catalog/domain/service.repository.js';
import { ClientRepository } from '../../clients/domain/client.repository.js';
import { ClientNotFoundError } from '../../clients/domain/errors/clients.errors.js';
import { StaffMemberNotFoundError } from '../../staff/domain/staff.errors.js';
import { StaffRepository } from '../../staff/domain/staff.repository.js';
import { TenantNotAvailableError } from '../../tenants/domain/errors/tenant-not-available.error.js';
import { TenantRepository } from '../../tenants/domain/tenant.repository.js';
import type { PaymentMethod } from '../domain/payment-method.js';
import { Sale } from '../domain/sale.entity.js';
import { SaleLine } from '../domain/sale-line.js';
import {
  AppointmentAlreadyBilledError,
  AppointmentNotBillableError,
  InvalidSaleDataError,
} from '../domain/sale.errors.js';
import { SaleRepository } from '../domain/sale.repository.js';
import { SalesAccess } from './sales-access.js';

export interface RegisterSaleLineInput {
  readonly serviceId?: string | null;
  readonly description?: string | null;
  readonly unitPrice?: string | null;
  readonly quantity?: number;
}

export interface RegisterSaleInput {
  readonly appointmentId?: string | null;
  readonly clientId?: string | null;
  readonly staffMemberId?: string | null;
  readonly lines?: readonly RegisterSaleLineInput[];
  readonly discount?: string | null;
  readonly paymentMethod?: PaymentMethod | null;
}

@Injectable()
export class RegisterSaleUseCase {
  constructor(
    private readonly sales: SaleRepository,
    private readonly appointments: AppointmentRepository,
    private readonly services: ServiceRepository,
    private readonly clients: ClientRepository,
    private readonly staff: StaffRepository,
    private readonly tenants: TenantRepository,
    private readonly access: SalesAccess,
    private readonly transaction: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(actor: AuthContext, input: RegisterSaleInput): Promise<Sale> {
    return this.transaction.run(async () => {
      const tenant = await this.tenants.findById(actor.tenantId);

      if (!tenant) {
        throw new TenantNotAvailableError();
      }

      const appointment = input.appointmentId
        ? await this.billableAppointment(actor.tenantId, input.appointmentId)
        : null;

      const staffMemberId =
        input.staffMemberId ?? appointment?.staffMemberId ?? null;
      const clientId = input.clientId ?? appointment?.clientId ?? null;

      await this.access.assertCanRecordFor(actor, staffMemberId);
      await this.assertReferencesExist(actor.tenantId, clientId, staffMemberId);

      const sale = Sale.register(
        {
          id: this.ids.generate(),
          tenantId: actor.tenantId,
          appointmentId: appointment?.id ?? null,
          clientId,
          staffMemberId,
          currency: tenant.currency,
          lines: await this.buildLines(actor.tenantId, input, appointment),
          discount: input.discount
            ? Money.fromDecimalString(input.discount)
            : undefined,
          paymentMethod: input.paymentMethod ?? null,
          createdByUserId: actor.userId,
        },
        this.clock.now(),
      );

      await this.sales.save(sale);

      return sale;
    });
  }

  private async billableAppointment(
    tenantId: string,
    appointmentId: string,
  ): Promise<Appointment> {
    const appointment = await this.appointments.findByIdForTenant(
      appointmentId,
      tenantId,
    );

    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (appointment.status !== AppointmentStatus.Completed) {
      throw new AppointmentNotBillableError(appointment.status);
    }

    const existing = await this.sales.findByAppointmentId(
      tenantId,
      appointment.id,
    );

    if (existing) {
      throw new AppointmentAlreadyBilledError(existing.id);
    }

    return appointment;
  }

  private async assertReferencesExist(
    tenantId: string,
    clientId: string | null,
    staffMemberId: string | null,
  ): Promise<void> {
    if (clientId) {
      const client = await this.clients.findByIdForTenant(clientId, tenantId);

      if (!client) {
        throw new ClientNotFoundError();
      }
    }

    if (staffMemberId) {
      const staffMember = await this.staff.findByIdForTenant(
        staffMemberId,
        tenantId,
      );

      if (!staffMember) {
        throw new StaffMemberNotFoundError();
      }
    }
  }

  private async buildLines(
    tenantId: string,
    input: RegisterSaleInput,
    appointment: Appointment | null,
  ): Promise<SaleLine[]> {
    const requested = input.lines ?? [];

    if (requested.length === 0) {
      if (!appointment) {
        throw new InvalidSaleDataError(
          'lines',
          'a sale needs at least one line, or an appointment to charge',
        );
      }

      return [await this.lineFromAppointment(tenantId, appointment)];
    }

    const serviceIds = [
      ...new Set(
        requested
          .map((line) => line.serviceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const services = new Map(
      (await this.services.findManyByIdsForTenant(serviceIds, tenantId)).map(
        (service) => [service.id, service],
      ),
    );

    return requested.map((line) => {
      const service = line.serviceId ? services.get(line.serviceId) : undefined;

      if (line.serviceId && !service) {
        throw new ServiceNotFoundError();
      }

      const description = line.description?.trim() || service?.name;
      const unitPrice = line.unitPrice
        ? Money.fromDecimalString(line.unitPrice)
        : service?.price;

      if (!description) {
        throw new InvalidSaleDataError(
          'line description',
          'a line without a service needs a description',
        );
      }
      if (!unitPrice) {
        throw new InvalidSaleDataError(
          'line unitPrice',
          'a line without a service needs a unit price',
        );
      }

      return SaleLine.of({
        id: this.ids.generate(),
        serviceId: service?.id ?? null,
        description,
        unitPrice,
        quantity: line.quantity ?? 1,
      });
    });
  }

  private async lineFromAppointment(
    tenantId: string,
    appointment: Appointment,
  ): Promise<SaleLine> {
    const service = await this.services.findByIdForTenant(
      appointment.serviceId,
      tenantId,
    );

    if (!service) {
      throw new ServiceNotFoundError();
    }

    return SaleLine.of({
      id: this.ids.generate(),
      serviceId: service.id,
      description: service.name,
      unitPrice: appointment.price,
      quantity: 1,
    });
  }
}

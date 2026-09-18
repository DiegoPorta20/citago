import { DateTime } from 'luxon';
import type { DataSource } from 'typeorm';
import { v7 as uuidV7 } from 'uuid';

import { AppointmentSource } from '../../modules/appointments/domain/appointment-source.js';
import { AppointmentStatus } from '../../modules/appointments/domain/appointment-status.js';
import { AppointmentOrmEntity } from '../../modules/appointments/infrastructure/persistence/typeorm/entities/appointment.orm-entity.js';
import { AppointmentStatusHistoryOrmEntity } from '../../modules/appointments/infrastructure/persistence/typeorm/entities/appointment-status-history.orm-entity.js';
import {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
  MessageType,
} from '../../modules/conversations/domain/conversation.enums.js';
import { ConversationOrmEntity } from '../../modules/conversations/infrastructure/persistence/typeorm/entities/conversation.orm-entity.js';
import { MessageOrmEntity } from '../../modules/conversations/infrastructure/persistence/typeorm/entities/message.orm-entity.js';
import { StaffMemberStatus } from '../../modules/staff/domain/staff-member-status.js';
import { StaffMemberOrmEntity } from '../../modules/staff/infrastructure/persistence/typeorm/entities/staff-member.orm-entity.js';
import { StaffScheduleOrmEntity } from '../../modules/staff/infrastructure/persistence/typeorm/entities/staff-schedule.orm-entity.js';

import { ServiceStatus } from '../../modules/catalog/domain/service-status.js';
import { ServiceOrmEntity } from '../../modules/catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';
import { ClientOrmEntity } from '../../modules/clients/infrastructure/persistence/typeorm/entities/client.orm-entity.js';
import { MembershipStatus } from '../../modules/identity/domain/membership-status.js';
import { UserRole } from '../../shared/domain/user-role.js';
import { MembershipOrmEntity } from '../../modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { UserOrmEntity } from '../../modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { Argon2PasswordHasher } from '../../modules/identity/infrastructure/security/argon2-password-hasher.js';
import { BusinessType } from '../../modules/tenants/domain/business-type.js';
import { TenantStatus } from '../../modules/tenants/domain/tenant-status.js';
import { TenantOrmEntity } from '../../modules/tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';

/**
 * Development data. Obviously fake, and idempotent: running it twice leaves the
 * same rows, so it is safe to re-run after a migration.
 *
 * Identifiers are fixed (not random) so that fixtures, screenshots and manual
 * testing keep referring to the same records.
 */
export const DEMO_TENANT_ID = '01999999-0000-7000-8000-000000000001';

const DEMO_PASSWORD = 'Demo1234!';

interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly membershipId: string;
}

const DEMO_USERS: readonly DemoUser[] = [
  {
    id: '01999999-0000-7000-8000-000000000011',
    email: 'owner@demo.local',
    name: 'Carlos Demo',
    role: UserRole.Owner,
    membershipId: '01999999-0000-7000-8000-000000000021',
  },
  {
    id: '01999999-0000-7000-8000-000000000012',
    email: 'admin@demo.local',
    name: 'Ana Demo',
    role: UserRole.Admin,
    membershipId: '01999999-0000-7000-8000-000000000022',
  },
  {
    id: '01999999-0000-7000-8000-000000000013',
    email: 'staff@demo.local',
    name: 'Luis Demo',
    role: UserRole.Staff,
    membershipId: '01999999-0000-7000-8000-000000000023',
  },
];

interface DemoService {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly price: string;
  readonly status: ServiceStatus;
}

/** A plausible barbershop menu, in the tenant currency (PEN). */
const DEMO_SERVICES: readonly DemoService[] = [
  {
    id: '01999999-0000-7000-8000-000000000031',
    name: 'Corte de cabello',
    description: 'Incluye lavado y peinado',
    durationMinutes: 30,
    price: '25.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000032',
    name: 'Barba',
    description: 'Perfilado y afeitado con navaja',
    durationMinutes: 20,
    price: '15.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000033',
    name: 'Corte + barba',
    description: null,
    durationMinutes: 45,
    price: '35.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000034',
    name: 'Corte niño',
    description: 'Hasta 12 años',
    durationMinutes: 25,
    price: '18.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000035',
    name: 'Diseño de cejas',
    description: null,
    durationMinutes: 15,
    price: '10.00',
    status: ServiceStatus.Active,
  },
  {
    id: '01999999-0000-7000-8000-000000000036',
    name: 'Tinte',
    description: 'Fuera de carta por ahora',
    durationMinutes: 60,
    price: '60.00',
    status: ServiceStatus.Inactive,
  },
];

interface DemoClient {
  readonly name: string;
  /** Test range +51 900 000 0XX: clearly fake, but valid Peruvian mobiles. */
  readonly phoneE164: string | null;
  readonly notes: string | null;
}

const DEMO_CLIENT_NAMES = [
  'Juan Pérez',
  'Carlos Ramírez',
  'Luis Torres',
  'Miguel Rojas',
  'José Flores',
  'Diego Vargas',
  'Andrés Castillo',
  'Jorge Mendoza',
  'Pedro Silva',
  'Ricardo Ortiz',
  'Fernando Díaz',
  'Martín Chávez',
  'Sergio Herrera',
  'Raúl Medina',
  'Óscar Gutiérrez',
  'Gabriel Morales',
  'Daniel Ruiz',
  'Alejandro Vega',
  'Mateo Campos',
  'Tomás Reyes',
];

const DEMO_CLIENTS: readonly DemoClient[] = DEMO_CLIENT_NAMES.map(
  (name, index) => ({
    name,
    // Two walk-ins without phone, as happens in real life.
    phoneE164:
      index >= 18 ? null : `+5190000${String(index + 1).padStart(4, '0')}`,
    notes: index === 0 ? 'Prefiere corte con tijera' : null,
  }),
);

const clientIdAt = (index: number) =>
  `01999999-0000-7000-8000-00000000${String(index + 100).padStart(4, '0')}`;

/** Two barbers, linked to the demo OWNER and STAFF accounts. */
const DEMO_STAFF = [
  {
    id: '01999999-0000-7000-8000-000000000041',
    displayName: 'Carlos (Demo)',
    userId: '01999999-0000-7000-8000-000000000011',
  },
  {
    id: '01999999-0000-7000-8000-000000000042',
    displayName: 'Luis (Demo)',
    userId: '01999999-0000-7000-8000-000000000013',
  },
] as const;

/** Monday to Saturday with a lunch break, in Lima wall-clock time. */
const DEMO_WEEK = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startsAt: '09:00:00', endsAt: '13:00:00' },
  { weekday, startsAt: '15:00:00', endsAt: '20:00:00' },
]);

/** Past appointments get realistic outcomes; future ones are still open. */
function demoStatusFor(dayOffset: number, slot: number): AppointmentStatus {
  if (dayOffset > 0) {
    return slot % 2 === 0
      ? AppointmentStatus.Confirmed
      : AppointmentStatus.Pending;
  }
  if (dayOffset === 0) {
    return AppointmentStatus.Confirmed;
  }

  const outcomes = [
    AppointmentStatus.Completed,
    AppointmentStatus.Completed,
    AppointmentStatus.Completed,
    AppointmentStatus.Cancelled,
    AppointmentStatus.NoShow,
  ];

  return outcomes[(Math.abs(dayOffset) + slot) % outcomes.length];
}

export interface SeedSummary {
  readonly tenantId: string;
  readonly users: readonly { email: string; role: UserRole }[];
  readonly password: string;
  readonly serviceCount: number;
  readonly clientCount: number;
  readonly staffCount: number;
  readonly appointmentCount: number;
}

export async function runDevSeed(dataSource: DataSource): Promise<SeedSummary> {
  const hasher = new Argon2PasswordHasher();
  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  let appointmentCount = 0;

  await dataSource.transaction(async (manager) => {
    const now = new Date();

    await manager.getRepository(TenantOrmEntity).upsert(
      {
        id: DEMO_TENANT_ID,
        name: 'Barbería Demo',
        slug: 'barberia-demo',
        businessType: BusinessType.Barbershop,
        country: 'PE',
        currency: 'PEN',
        timezone: 'America/Lima',
        phone: '+51900000000',
        email: 'contacto@demo.local',
        status: TenantStatus.Active,
        createdAt: now,
        updatedAt: now,
      },
      ['id'],
    );

    for (const user of DEMO_USERS) {
      await manager.getRepository(UserOrmEntity).upsert(
        {
          id: user.id,
          email: user.email,
          passwordHash,
          name: user.name,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );

      await manager.getRepository(MembershipOrmEntity).upsert(
        {
          id: user.membershipId,
          tenantId: DEMO_TENANT_ID,
          userId: user.id,
          role: user.role,
          status: MembershipStatus.Active,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );
    }

    for (const service of DEMO_SERVICES) {
      await manager.getRepository(ServiceOrmEntity).upsert(
        {
          id: service.id,
          tenantId: DEMO_TENANT_ID,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          price: service.price,
          status: service.status,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );
    }

    for (const [index, client] of DEMO_CLIENTS.entries()) {
      await manager.getRepository(ClientOrmEntity).upsert(
        {
          id: clientIdAt(index),
          tenantId: DEMO_TENANT_ID,
          name: client.name,
          phoneE164: client.phoneE164,
          email: null,
          notes: client.notes,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );
    }

    for (const member of DEMO_STAFF) {
      await manager.getRepository(StaffMemberOrmEntity).upsert(
        {
          id: member.id,
          tenantId: DEMO_TENANT_ID,
          userId: member.userId,
          displayName: member.displayName,
          status: StaffMemberStatus.Active,
          createdAt: now,
          updatedAt: now,
        },
        ['id'],
      );

      // Replace the week so re-running the seed never duplicates ranges.
      await manager
        .getRepository(StaffScheduleOrmEntity)
        .delete({ tenantId: DEMO_TENANT_ID, staffMemberId: member.id });
      await manager.getRepository(StaffScheduleOrmEntity).insert(
        DEMO_WEEK.map((range) => ({
          id: uuidV7(),
          tenantId: DEMO_TENANT_ID,
          staffMemberId: member.id,
          ...range,
        })),
      );
    }

    // Appointments from a week ago to a week ahead, recomputed around "today"
    // on every run: two per barber per working day, never overlapping.
    await manager
      .getRepository(AppointmentStatusHistoryOrmEntity)
      .delete({ tenantId: DEMO_TENANT_ID });
    await manager
      .getRepository(AppointmentOrmEntity)
      .delete({ tenantId: DEMO_TENANT_ID });

    const today = DateTime.now().setZone('America/Lima').startOf('day');
    const bookable = DEMO_SERVICES.filter(
      (service) => service.status === ServiceStatus.Active,
    );

    for (let dayOffset = -7; dayOffset <= 7; dayOffset += 1) {
      const day = today.plus({ days: dayOffset });

      if (day.weekday === 7) {
        continue; // Sunday: closed.
      }

      for (const [staffIndex, member] of DEMO_STAFF.entries()) {
        for (const [slot, time] of ['10:00', '16:00'].entries()) {
          const sequence = appointmentCount;
          const service = bookable[(sequence + staffIndex) % bookable.length];
          const [hour, minute] = time.split(':').map(Number);
          const startAt = day.set({ hour, minute }).toJSDate();
          const endAt = new Date(
            startAt.getTime() + service.durationMinutes * 60_000,
          );
          const status = demoStatusFor(dayOffset, slot + staffIndex);
          const id = uuidV7();

          await manager.getRepository(AppointmentOrmEntity).insert({
            id,
            tenantId: DEMO_TENANT_ID,
            clientId: clientIdAt(sequence % DEMO_CLIENTS.length),
            serviceId: service.id,
            staffMemberId: member.id,
            startAt,
            endAt,
            status,
            price: service.price,
            notes: null,
            source: AppointmentSource.Manual,
            createdByUserId: DEMO_USERS[0].id,
            completedAt: status === AppointmentStatus.Completed ? endAt : null,
            cancelledAt:
              status === AppointmentStatus.Cancelled ? startAt : null,
            cancellationReason:
              status === AppointmentStatus.Cancelled
                ? 'Cliente reprogramó'
                : null,
            createdAt: now,
            updatedAt: now,
          });

          const history = [
            { fromStatus: null, toStatus: AppointmentStatus.Pending },
            ...(status === AppointmentStatus.Pending
              ? []
              : [{ fromStatus: AppointmentStatus.Pending, toStatus: status }]),
          ];

          await manager.getRepository(AppointmentStatusHistoryOrmEntity).insert(
            history.map((change) => ({
              id: uuidV7(),
              tenantId: DEMO_TENANT_ID,
              appointmentId: id,
              fromStatus: change.fromStatus,
              toStatus: change.toStatus,
              reason: null,
              changedByUserId: DEMO_USERS[0].id,
              changedAt: now,
            })),
          );

          appointmentCount += 1;
        }
      }
    }

    // Three WhatsApp threads, one per inbox state: pending, answered, archived.
    await manager
      .getRepository(MessageOrmEntity)
      .delete({ tenantId: DEMO_TENANT_ID });
    await manager
      .getRepository(ConversationOrmEntity)
      .delete({ tenantId: DEMO_TENANT_ID });

    const minutesAgo = (minutes: number) =>
      new Date(Date.now() - minutes * 60_000);

    const threads = [
      {
        clientIndex: 0,
        status: ConversationStatus.Open,
        messages: [
          {
            direction: MessageDirection.Inbound,
            body: 'Hola, ¿tienen turno mañana a las 10?',
            ago: 12,
          },
        ],
      },
      {
        clientIndex: 1,
        status: ConversationStatus.Open,
        messages: [
          {
            direction: MessageDirection.Inbound,
            body: '¿Cuánto cuesta corte + barba?',
            ago: 90,
          },
          {
            direction: MessageDirection.Outbound,
            body: 'S/ 35. ¿Te reservo?',
            ago: 80,
          },
        ],
      },
      {
        clientIndex: 2,
        status: ConversationStatus.Archived,
        messages: [
          {
            direction: MessageDirection.Inbound,
            body: 'Gracias, todo bien',
            ago: 3000,
          },
        ],
      },
    ];

    for (const thread of threads) {
      const conversationId = uuidV7();
      const client = DEMO_CLIENTS[thread.clientIndex];
      const sent = thread.messages.map((message) => minutesAgo(message.ago));
      const last = thread.messages[thread.messages.length - 1];
      const inboundTimes = thread.messages
        .filter((message) => message.direction === MessageDirection.Inbound)
        .map((message) => minutesAgo(message.ago));
      const outboundTimes = thread.messages
        .filter((message) => message.direction === MessageDirection.Outbound)
        .map((message) => minutesAgo(message.ago));

      await manager.getRepository(ConversationOrmEntity).insert({
        id: conversationId,
        tenantId: DEMO_TENANT_ID,
        channel: ConversationChannel.WhatsApp,
        contactIdentifier: client.phoneE164 as string,
        contactName: client.name.split(' ')[0],
        clientId: clientIdAt(thread.clientIndex),
        assignedUserId: null,
        status: thread.status,
        needsReply:
          thread.status === ConversationStatus.Open &&
          last.direction === MessageDirection.Inbound,
        lastMessageAt: sent[sent.length - 1],
        lastInboundAt: inboundTimes.at(-1) ?? null,
        lastOutboundAt: outboundTimes.at(-1) ?? null,
        lastMessagePreview: last.body,
        createdAt: now,
        updatedAt: now,
      });

      await manager.getRepository(MessageOrmEntity).insert(
        thread.messages.map((message, index) => ({
          id: uuidV7(),
          tenantId: DEMO_TENANT_ID,
          conversationId,
          externalMessageId: `seed.${uuidV7()}`,
          direction: message.direction,
          type: MessageType.Text,
          body: message.body,
          mediaReference: null,
          mediaMimeType: null,
          sentAt: sent[index],
          receivedAt: sent[index],
          authorUserId:
            message.direction === MessageDirection.Outbound
              ? DEMO_USERS[0].id
              : null,
        })),
      );
    }
  });

  return {
    tenantId: DEMO_TENANT_ID,
    users: DEMO_USERS.map(({ email, role }) => ({ email, role })),
    password: DEMO_PASSWORD,
    serviceCount: DEMO_SERVICES.length,
    clientCount: DEMO_CLIENTS.length,
    staffCount: DEMO_STAFF.length,
    appointmentCount,
  };
}

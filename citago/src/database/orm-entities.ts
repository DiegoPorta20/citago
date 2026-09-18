import { ClientOrmEntity } from '../modules/clients/infrastructure/persistence/typeorm/entities/client.orm-entity.js';
import { AppointmentOrmEntity } from '../modules/appointments/infrastructure/persistence/typeorm/entities/appointment.orm-entity.js';
import { AppointmentStatusHistoryOrmEntity } from '../modules/appointments/infrastructure/persistence/typeorm/entities/appointment-status-history.orm-entity.js';
import { ConversationOrmEntity } from '../modules/conversations/infrastructure/persistence/typeorm/entities/conversation.orm-entity.js';
import { MessageOrmEntity } from '../modules/conversations/infrastructure/persistence/typeorm/entities/message.orm-entity.js';
import { ServiceOrmEntity } from '../modules/catalog/infrastructure/persistence/typeorm/entities/service.orm-entity.js';
import { MembershipOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity.js';
import { RefreshTokenOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/refresh-token.orm-entity.js';
import { UserOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { StaffMemberOrmEntity } from '../modules/staff/infrastructure/persistence/typeorm/entities/staff-member.orm-entity.js';
import { StaffScheduleOrmEntity } from '../modules/staff/infrastructure/persistence/typeorm/entities/staff-schedule.orm-entity.js';
import { StaffTimeOffOrmEntity } from '../modules/staff/infrastructure/persistence/typeorm/entities/staff-time-off.orm-entity.js';
import { TenantOrmEntity } from '../modules/tenants/infrastructure/persistence/typeorm/entities/tenant.orm-entity.js';
import { WhatsAppChannelOrmEntity } from '../modules/whatsapp/infrastructure/persistence/typeorm/entities/whatsapp-channel.orm-entity.js';

/**
 * Every persistence entity, registered explicitly.
 *
 * Globs were the obvious alternative, but TypeORM resolves them with dynamic
 * `import()` at runtime, which races with Jest's ESM teardown and silently
 * leaves entity metadata missing. Listing them costs one line per entity and
 * makes the set of tables obvious.
 *
 * **Add new `*.orm-entity.ts` classes here.**
 */
export const ORM_ENTITIES = [
  TenantOrmEntity,
  UserOrmEntity,
  MembershipOrmEntity,
  RefreshTokenOrmEntity,
  ServiceOrmEntity,
  ClientOrmEntity,
  StaffMemberOrmEntity,
  StaffScheduleOrmEntity,
  StaffTimeOffOrmEntity,
  AppointmentOrmEntity,
  AppointmentStatusHistoryOrmEntity,
  ConversationOrmEntity,
  MessageOrmEntity,
  WhatsAppChannelOrmEntity,
];

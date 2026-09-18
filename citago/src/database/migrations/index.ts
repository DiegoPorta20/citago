import { InitTenancyAndIdentity1789674597432 } from './1789674597432-InitTenancyAndIdentity.js';
import { AddTenantToRefreshTokens1789677885914 } from './1789677885914-AddTenantToRefreshTokens.js';
import { AddServices1789684045518 } from './1789684045518-AddServices.js';
import { AddClients1789699896955 } from './1789699896955-AddClients.js';
import { AddStaff1789704448728 } from './1789704448728-AddStaff.js';
import { AddAppointments1789704978659 } from './1789704978659-AddAppointments.js';
import { AddConversations1789707415253 } from './1789707415253-AddConversations.js';
import { AddWhatsAppChannels1789734112708 } from './1789734112708-AddWhatsAppChannels.js';

/**
 * Every migration, in the order it must be applied.
 *
 * Registered explicitly for the same reason as the entities: glob loading uses
 * dynamic `import()` and misbehaves under the ESM test runner.
 *
 * **Append new migrations at the end. Never reorder or edit an applied one.**
 */
export const MIGRATIONS = [
  InitTenancyAndIdentity1789674597432,
  AddTenantToRefreshTokens1789677885914,
  AddServices1789684045518,
  AddClients1789699896955,
  AddStaff1789704448728,
  AddAppointments1789704978659,
  AddConversations1789707415253,
  AddWhatsAppChannels1789734112708,
];

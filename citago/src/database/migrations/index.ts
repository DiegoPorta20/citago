import { InitTenancyAndIdentity1789674597432 } from './1789674597432-InitTenancyAndIdentity.js';
import { AddTenantToRefreshTokens1789677885914 } from './1789677885914-AddTenantToRefreshTokens.js';

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
];

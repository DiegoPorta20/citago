import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../../domain/user-role.js';

export const ROLES_KEY = 'citago:roles';

/**
 * Restricts an endpoint to the given roles.
 *
 * This is the coarse check ("may this role use this endpoint at all"). Rules
 * about *which rows* a role may touch — "staff only sees their own
 * appointments" — belong to the use case, which knows the data.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../../domain/user-role.js';

export const ROLES_KEY = 'citago:roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

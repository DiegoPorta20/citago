import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../../../../shared/domain/user-role.js';
import { InsufficientRoleError } from '../../domain/errors/authentication.errors.js';
import {
  AUTH_CONTEXT_PROPERTY,
  type RequestWithAuth,
} from '../../../../shared/presentation/decorators/current-auth.decorator.js';
import { ROLES_KEY } from '../../../../shared/presentation/decorators/roles.decorator.js';

/**
 * Enforces `@Roles(...)`.
 *
 * Runs after the auth guard, so the session is already resolved and the role
 * comes from the database rather than from the token.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles on the endpoint: any authenticated member of the tenant may
    // call it. Which rows they get is still decided by the use case.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authContext = request[AUTH_CONTEXT_PROPERTY];

    if (!authContext || !required.includes(authContext.role)) {
      throw new InsufficientRoleError(required);
    }

    return true;
  }
}

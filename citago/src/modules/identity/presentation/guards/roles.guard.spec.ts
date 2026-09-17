import { jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { UserRole } from '../../../../shared/domain/user-role.js';
import { AUTH_CONTEXT_PROPERTY } from '../../../../shared/presentation/decorators/current-auth.decorator.js';
import { InsufficientRoleError } from '../../domain/errors/authentication.errors.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(
  required: UserRole[] | undefined,
  authContext?: AuthContext,
): { guard: RolesGuard; context: ExecutionContext } {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ [AUTH_CONTEXT_PROPERTY]: authContext }),
    }),
  } as unknown as ExecutionContext;

  return { guard, context };
}

const owner: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: UserRole.Owner,
};

const staff: AuthContext = { ...owner, role: UserRole.Staff };

describe('RolesGuard', () => {
  it('allows any member when the endpoint declares no roles', () => {
    const { guard, context } = contextFor(undefined, staff);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a role that is listed', () => {
    const { guard, context } = contextFor(
      [UserRole.Owner, UserRole.Admin],
      owner,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a role that is not listed', () => {
    const { guard, context } = contextFor(
      [UserRole.Owner, UserRole.Admin],
      staff,
    );

    expect(() => guard.canActivate(context)).toThrow(InsufficientRoleError);
  });

  it('reports which roles were required, without leaking anything else', () => {
    const { guard, context } = contextFor([UserRole.Owner], staff);

    try {
      guard.canActivate(context);
      throw new Error('should have thrown');
    } catch (error) {
      const failure = error as InsufficientRoleError;

      expect(failure.code).toBe('INSUFFICIENT_ROLE');
      expect(failure.details).toEqual({ required: [UserRole.Owner] });
    }
  });

  it('rejects when there is no session on the request', () => {
    // Belt and braces: the auth guard runs first, but a misconfigured
    // @Public endpoint with @Roles must not fall through as authorized.
    const { guard, context } = contextFor([UserRole.Owner], undefined);

    expect(() => guard.canActivate(context)).toThrow(InsufficientRoleError);
  });
});

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthContext } from '../../../../shared/application/auth-context.js';
import { TenantRepository } from '../../../tenants/domain/tenant.repository.js';
import { AccessTokenService } from '../../application/ports/access-token.service.js';
import {
  MembershipRevokedError,
  TenantSuspendedError,
} from '../../domain/errors/authentication.errors.js';
import { MembershipRepository } from '../../domain/membership.repository.js';
import {
  AUTH_CONTEXT_PROPERTY,
  type RequestWithAuth,
} from '../../../../shared/presentation/decorators/current-auth.decorator.js';
import { IS_PUBLIC_KEY } from '../../../../shared/presentation/decorators/public.decorator.js';

/**
 * Turns a bearer token into an `AuthContext`, or rejects the request.
 *
 * Registered globally, so every endpoint is private unless marked `@Public()`.
 *
 * The token is only half the check. The membership is loaded from the database
 * on **every** request to confirm the access still exists, and to read the
 * current role — which is why revoking access or changing a role takes effect
 * immediately instead of when the token expires. That costs one primary-key
 * lookup per request, plus one for the tenant.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly memberships: MembershipRepository,
    private readonly tenants: TenantRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const claims = await this.accessTokens.verify(token);

    if (!claims) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const membership = await this.memberships.findByIdForTenant(
      claims.mid,
      claims.tid,
    );

    // The membership must still exist, still be active, and still belong to
    // the user the token names. A token whose membership was moved or revoked
    // is worthless.
    if (
      !membership ||
      !membership.isActive ||
      membership.userId !== claims.sub
    ) {
      throw new MembershipRevokedError();
    }

    const tenant = await this.tenants.findById(claims.tid);

    if (!tenant?.isActive) {
      throw new TenantSuspendedError();
    }

    const authContext: AuthContext = {
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    };

    request[AUTH_CONTEXT_PROPERTY] = authContext;

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, value] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_WHEN_EXPIRED_KEY } from '../../../shared/presentation/decorators/allow-when-expired.decorator.js';
import {
  AUTH_CONTEXT_PROPERTY,
  type RequestWithAuth,
} from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { AssertSubscriptionAccessUseCase } from '../application/billing.use-cases.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Once the trial ends the business can still read everything but cannot
 * change anything. It must run after the JWT guard, which is what sets the
 * auth context; without one (a @Public route) there is no business to check.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly assertAccess: AssertSubscriptionAccessUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = request[AUTH_CONTEXT_PROPERTY];

    if (!auth || READ_METHODS.has(request.method)) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHEN_EXPIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowed) {
      return true;
    }

    await this.assertAccess.execute(auth.tenantId);

    return true;
  }
}

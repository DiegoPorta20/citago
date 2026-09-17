import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthContext } from '../../application/auth-context.js';

/** Where the guard stores the resolved session on the request. */
export const AUTH_CONTEXT_PROPERTY = 'authContext';

export interface RequestWithAuth extends Request {
  [AUTH_CONTEXT_PROPERTY]?: AuthContext;
}

/**
 * Injects the verified session into a controller method.
 *
 * Controllers pass it straight to the use case: it is the only accepted source
 * of `tenantId`, so no endpoint can be tricked into acting on another tenant.
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authContext = request[AUTH_CONTEXT_PROPERTY];

    if (!authContext) {
      // Only reachable if an endpoint is marked @Public and still asks for the
      // session: a wiring mistake, not a runtime condition.
      throw new Error(
        'No auth context on the request. Is the endpoint marked @Public?',
      );
    }

    return authContext;
  },
);

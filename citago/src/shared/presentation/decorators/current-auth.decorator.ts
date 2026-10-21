import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthContext } from '../../application/auth-context.js';

export const AUTH_CONTEXT_PROPERTY = 'authContext';

export interface RequestWithAuth extends Request {
  [AUTH_CONTEXT_PROPERTY]?: AuthContext;
}

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authContext = request[AUTH_CONTEXT_PROPERTY];

    if (!authContext) {
      throw new Error(
        'No auth context on the request. Is the endpoint marked @Public?',
      );
    }

    return authContext;
  },
);

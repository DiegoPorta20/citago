import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import type { Page } from '../../domain/pagination.js';

export interface ResponseEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

function isPage(value: unknown): value is Page<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Page<unknown>).items) &&
    typeof (value as Page<unknown>).meta === 'object' &&
    (value as Page<unknown>).meta !== null
  );
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ResponseEnvelope<unknown> | undefined
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseEnvelope<unknown> | undefined> {
    return next.handle().pipe(
      map((value) => {
        if (value === undefined) {
          return undefined;
        }

        if (isPage(value)) {
          return {
            data: value.items,
            meta: value.meta as unknown as Record<string, unknown>,
          };
        }

        return { data: value as unknown, meta: {} };
      }),
    );
  }
}

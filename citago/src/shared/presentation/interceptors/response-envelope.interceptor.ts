import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import type { Page } from '../../application/pagination.js';

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

/**
 * Wraps every successful response in `{ data, meta }`.
 *
 * A `Page` returned by a use case is unwrapped into `data: items` plus its
 * pagination `meta`, so controllers never assemble the envelope by hand.
 */
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
        // 204 No Content and similar: nothing to wrap.
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

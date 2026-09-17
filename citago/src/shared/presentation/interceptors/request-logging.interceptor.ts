import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap, type Observable } from 'rxjs';

/**
 * Logs one line per request: method, path, status and duration.
 *
 * Deliberately logs no headers, query string or body: those carry credentials,
 * tokens and customer data. Failures are logged by the exception filter.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = http.getResponse<Response>();
          // Prefer the route pattern over the concrete URL: it keeps ids out of
          // the logs and groups requests by endpoint.
          const route = (request.route as { path?: string } | undefined)?.path;

          this.logger.log(
            `${request.method} ${route ?? request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
          );
        },
      }),
    );
  }
}

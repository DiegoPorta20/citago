import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError, DomainErrorCategory } from '../../domain/domain-error.js';
import type { ApiErrorDto } from '../dto/api-error.dto.js';

/** Lowest status code that means "our fault", and therefore must be logged. */
const SERVER_ERROR_MIN_STATUS = 500;

const CATEGORY_STATUS: Record<DomainErrorCategory, HttpStatus> = {
  [DomainErrorCategory.Validation]: HttpStatus.BAD_REQUEST,
  [DomainErrorCategory.NotFound]: HttpStatus.NOT_FOUND,
  [DomainErrorCategory.Conflict]: HttpStatus.CONFLICT,
  [DomainErrorCategory.BusinessRule]: HttpStatus.UNPROCESSABLE_ENTITY,
  [DomainErrorCategory.Forbidden]: HttpStatus.FORBIDDEN,
  [DomainErrorCategory.Unauthorized]: HttpStatus.UNAUTHORIZED,
};

/** Error code returned for framework exceptions that carry no domain code. */
const STATUS_CODE_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE_VIOLATION',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

/**
 * The single translation point between failures and HTTP responses.
 *
 * One filter instead of several avoids depending on Nest's global filter
 * ordering, and keeps the whole error contract readable in one file.
 *
 * Nothing internal ever reaches the client: no stack traces, no SQL, no paths.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const body = this.toErrorBody(exception, request.originalUrl);

    if (body.statusCode >= SERVER_ERROR_MIN_STATUS) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.code}`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string): ApiErrorDto {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      return {
        statusCode: CATEGORY_STATUS[exception.category],
        code: exception.code,
        message: exception.message,
        details: exception.details,
        timestamp,
        path,
      };
    }

    if (exception instanceof HttpException) {
      return { ...this.fromHttpException(exception), timestamp, path };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      timestamp,
      path,
    };
  }

  private fromHttpException(
    exception: HttpException,
  ): Pick<ApiErrorDto, 'statusCode' | 'code' | 'message' | 'details'> {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    // The global ValidationPipe throws BadRequestException with an array of
    // messages. Surface them as structured details instead of a raw array.
    if (
      typeof payload === 'object' &&
      payload !== null &&
      Array.isArray((payload as { message?: unknown }).message)
    ) {
      const messages = (payload as { message: string[] }).message;

      return {
        statusCode,
        code: 'VALIDATION_ERROR',
        message: 'The request payload is invalid.',
        details: { errors: messages },
      };
    }

    const message =
      typeof payload === 'string'
        ? payload
        : (((payload as { message?: unknown }).message as string | undefined) ??
          exception.message);

    return {
      statusCode,
      code: this.defaultCodeFor(statusCode),
      message,
    };
  }

  private defaultCodeFor(statusCode: number): string {
    return (
      STATUS_CODE_NAMES[statusCode] ??
      (statusCode >= SERVER_ERROR_MIN_STATUS
        ? 'INTERNAL_ERROR'
        : 'REQUEST_ERROR')
    );
  }
}

// In ESM mode Jest does not inject globals; import the ones we use.
import { jest } from '@jest/globals';
import {
  type ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { DomainError, DomainErrorCategory } from '../../domain/domain-error.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

class AppointmentOverlapError extends DomainError {
  readonly code = 'APPOINTMENT_OVERLAP';
  readonly category = DomainErrorCategory.Conflict;

  constructor() {
    super('The appointment overlaps with another appointment.', {
      staffMemberId: 'staff-1',
    });
  }
}

class ClientNotFoundError extends DomainError {
  readonly code = 'CLIENT_NOT_FOUND';
  readonly category = DomainErrorCategory.NotFound;

  constructor() {
    super('Client not found.');
  }
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    filter = new AllExceptionsFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/appointments',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
  });

  const bodyOf = () => json.mock.calls[0][0] as Record<string, unknown>;

  it('maps a CONFLICT domain error to 409 keeping its code and details', () => {
    filter.catch(new AppointmentOverlapError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(bodyOf()).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      code: 'APPOINTMENT_OVERLAP',
      details: { staffMemberId: 'staff-1' },
      path: '/api/v1/appointments',
    });
  });

  it('maps a NOT_FOUND domain error to 404', () => {
    filter.catch(new ClientNotFoundError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(bodyOf()).toMatchObject({ code: 'CLIENT_NOT_FOUND' });
  });

  it('turns validation pipe failures into structured details', () => {
    filter.catch(
      new BadRequestException({
        message: ['name should not be empty', 'phone must be a string'],
        statusCode: 400,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(bodyOf()).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: {
        errors: ['name should not be empty', 'phone must be a string'],
      },
    });
  });

  it('keeps the status of a framework HttpException', () => {
    filter.catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(bodyOf()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('never leaks internals of an unexpected error', () => {
    filter.catch(
      new Error('ER_DUP_ENTRY: Duplicate entry for key clients.phone'),
      host,
    );

    const body = bodyOf();

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('ER_DUP_ENTRY');
  });

  it('logs unexpected errors as errors and handled ones as debug', () => {
    filter.catch(new Error('boom'), host);
    expect(Logger.prototype.error).toHaveBeenCalled();

    filter.catch(new ClientNotFoundError(), host);
    expect(Logger.prototype.debug).toHaveBeenCalled();
  });
});

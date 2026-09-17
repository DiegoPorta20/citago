import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The single error shape every endpoint returns. */
export class ApiErrorDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    description: 'Stable, machine-readable error identifier.',
    example: 'APPOINTMENT_OVERLAP',
  })
  code: string;

  @ApiProperty({
    example: 'The appointment overlaps with another appointment.',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Safe contextual information. Never contains internals.',
    type: 'object',
    additionalProperties: true,
  })
  details?: Record<string, unknown>;

  @ApiProperty({ example: '2026-09-17T12:34:56.789Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/appointments' })
  path: string;
}

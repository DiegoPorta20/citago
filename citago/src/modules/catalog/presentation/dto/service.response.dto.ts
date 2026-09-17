import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Service } from '../../domain/service.entity.js';
import { ServiceStatus } from '../../domain/service-status.js';

/**
 * The public shape of a service.
 *
 * The domain entity is never serialized directly: the API contract must be
 * able to stay stable while the entity evolves.
 */
export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Corte de cabello' })
  name: string;

  @ApiPropertyOptional({ example: 'Incluye lavado', nullable: true })
  description: string | null;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiProperty({
    example: '25.00',
    description: 'Decimal string in the tenant currency, never a number.',
  })
  price: string;

  @ApiProperty({ enum: ServiceStatus })
  status: ServiceStatus;

  @ApiProperty({ example: '2026-09-17T12:34:56.789Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-17T12:34:56.789Z' })
  updatedAt: string;

  static fromDomain(service: Service): ServiceResponseDto {
    const snapshot = service.toSnapshot();

    // `tenantId` is deliberately not exposed: the client never needs it, and
    // publishing it invites clients to start sending it back.
    return {
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      durationMinutes: snapshot.durationMinutes,
      price: snapshot.price,
      status: snapshot.status,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }
}

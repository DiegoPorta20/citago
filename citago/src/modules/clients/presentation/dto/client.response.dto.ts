import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { Client } from '../../domain/client.entity.js';

export class ClientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name: string;

  @ApiPropertyOptional({
    example: '+51999999999',
    nullable: true,
    description: 'Always E.164.',
  })
  phone: string | null;

  @ApiPropertyOptional({ example: 'juan@correo.pe', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-09-17T12:34:56.789Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-17T12:34:56.789Z' })
  updatedAt: string;

  static fromDomain(client: Client): ClientResponseDto {
    const snapshot = client.toSnapshot();

    return {
      id: snapshot.id,
      name: snapshot.name,
      phone: snapshot.phoneE164,
      email: snapshot.email,
      notes: snapshot.notes,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }
}

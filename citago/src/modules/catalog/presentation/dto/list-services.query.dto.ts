import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto.js';
import { ServiceStatus } from '../../domain/service-status.js';

export class ListServicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ServiceStatus,
    description: 'Omitted returns both active and inactive services.',
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    example: 'Corte',
    description: 'Prefix search over the service name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

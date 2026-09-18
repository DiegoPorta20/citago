import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto.js';

export class ListClientsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Juan',
    description:
      'Name prefix. With three or more digits it also matches the phone, so "999 999" finds +51999999999.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

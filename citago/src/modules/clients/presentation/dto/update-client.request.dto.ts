import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Partial update. An **empty string** clears an optional field (phone, email,
 * notes); omitting it leaves it untouched.
 */
export class UpdateClientRequestDto {
  @ApiPropertyOptional({ example: 'Juan Pérez', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: '+51 999 999 999',
    description: 'Empty string removes the phone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({
    example: 'juan@correo.pe',
    description: 'Empty string removes the email.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateClientRequestDto) => dto.email !== '')
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

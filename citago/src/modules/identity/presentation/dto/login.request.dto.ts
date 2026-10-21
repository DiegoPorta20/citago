import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'carlos@barberia.pe' })
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: 'unaClaveSegura1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

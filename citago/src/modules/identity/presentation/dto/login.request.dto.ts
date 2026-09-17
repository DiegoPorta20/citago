import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'carlos@barberia.pe' })
  @IsEmail()
  @MaxLength(160)
  email: string;

  /**
   * Not length-restricted beyond a sane cap: rejecting a short password here
   * would tell an attacker their guess was too short to be this account's.
   */
  @ApiProperty({ example: 'unaClaveSegura1' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

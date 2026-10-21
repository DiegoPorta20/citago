import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({ description: 'The refresh token returned by sign-in.' })
  @IsString()
  @Length(1, 256)
  refreshToken: string;
}

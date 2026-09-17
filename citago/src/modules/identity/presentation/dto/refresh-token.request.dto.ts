import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Used by both refresh and sign-out: the token identifies the session. */
export class RefreshTokenRequestDto {
  @ApiProperty({ description: 'The refresh token returned by sign-in.' })
  @IsString()
  @Length(1, 256)
  refreshToken: string;
}

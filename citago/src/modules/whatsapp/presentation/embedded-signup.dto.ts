import { IsString, Length, Matches } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

const META_ID = /^\d{1,32}$/;

export class CompleteEmbeddedSignupRequestDto {
  @ApiProperty({ description: 'One-time code returned by Meta’s JS SDK.' })
  @IsString()
  @Length(10, 2048)
  code: string;

  @ApiProperty({ example: '106540352242922' })
  @Matches(META_ID, { message: 'phoneNumberId must be numeric' })
  phoneNumberId: string;

  @ApiProperty({ example: '102290129340398' })
  @Matches(META_ID, { message: 'wabaId must be numeric' })
  wabaId: string;
}

export class EmbeddedSignupSessionResponseDto {
  @ApiProperty({
    description:
      'Open it in the browser. The token lives in the fragment (#t=…).',
  })
  url: string;

  @ApiProperty({ example: 900 })
  expiresInSeconds: number;
}

export class EmbeddedSignupConfigResponseDto {
  @ApiProperty()
  appId: string;

  @ApiProperty()
  configId: string;

  @ApiProperty({ example: 'v23.0' })
  graphVersion: string;
}

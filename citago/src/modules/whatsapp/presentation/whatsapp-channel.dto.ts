import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { WhatsAppChannel } from '../domain/whatsapp-channel.entity.js';

const META_ID = /^\d{1,32}$/;

export class ConnectWhatsAppRequestDto {
  @ApiProperty({
    example: '106540352242922',
    description: 'Phone number ID from Meta > WhatsApp > API Setup.',
  })
  @Matches(META_ID, { message: 'phoneNumberId must be numeric' })
  phoneNumberId: string;

  @ApiProperty({
    description:
      'Permanent (system user) access token. Stored encrypted and never returned.',
    writeOnly: true,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(1024)
  accessToken: string;

  @ApiPropertyOptional({ example: '102290129340398' })
  @IsOptional()
  @Matches(META_ID, { message: 'wabaId must be numeric' })
  wabaId?: string;
}

/** The connection as the business sees it. The token is never included. */
export class WhatsAppChannelResponseDto {
  @ApiProperty()
  connected: boolean;

  @ApiPropertyOptional({ nullable: true })
  phoneNumberId: string | null;

  @ApiPropertyOptional({ nullable: true })
  wabaId: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+51 999 999 999' })
  displayPhoneNumber: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Barbería Demo' })
  verifiedName: string | null;

  @ApiPropertyOptional({ nullable: true })
  connectedAt: string | null;

  static fromDomain(
    channel: WhatsAppChannel | null,
  ): WhatsAppChannelResponseDto {
    if (!channel) {
      return {
        connected: false,
        phoneNumberId: null,
        wabaId: null,
        displayPhoneNumber: null,
        verifiedName: null,
        connectedAt: null,
      };
    }

    const snapshot = channel.toSnapshot();

    return {
      connected: true,
      phoneNumberId: snapshot.phoneNumberId,
      wabaId: snapshot.wabaId,
      displayPhoneNumber: snapshot.displayPhoneNumber,
      verifiedName: snapshot.verifiedName,
      connectedAt: snapshot.connectedAt.toISOString(),
    };
  }
}

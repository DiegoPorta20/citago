import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { PaginationQueryDto } from '../../../shared/presentation/dto/pagination-query.dto.js';
import type { ConversationView } from '../application/conversation-queries.js';
import {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
  MessageType,
} from '../domain/conversation.enums.js';
import type { Message } from '../domain/message.entity.js';

/** Query strings are text: "true"/"false" become booleans; anything else fails validation. */
const queryBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class InboxQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({
    description: 'true lists only conversations waiting for an answer.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  needsReply?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class MessagesQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Cursor: return messages older than this one.',
  })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class LinkClientRequestDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null unlinks the conversation.',
  })
  @ValidateIf((dto: LinkClientRequestDto) => dto.clientId !== null)
  @IsUUID()
  clientId: string | null;
}

export class AssignRequestDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'A member of this business, or null to unassign.',
  })
  @ValidateIf((dto: AssignRequestDto) => dto.userId !== null)
  @IsUUID()
  userId: string | null;
}

export class SendReplyRequestDto {
  @ApiProperty({ example: 'Hola Juan, sí, mañana a las 10 está libre.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body: string;
}

export class SimulateInboundRequestDto {
  @ApiProperty({
    example: '999 999 999',
    description: 'Sender phone, as typed.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone: string;

  @ApiPropertyOptional({
    example: 'Juan',
    description: 'WhatsApp profile name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'Hola, ¿tienen turno mañana a las 10?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  body: string;

  @ApiPropertyOptional({
    description:
      'Reuse one to simulate a duplicate delivery. Generated if omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalMessageId?: string;

  @ApiPropertyOptional({ description: 'Defaults to now.' })
  @IsOptional()
  @IsDateString({ strict: true })
  sentAt?: string;
}

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ConversationChannel })
  channel: ConversationChannel;

  @ApiProperty({ example: '+51999999999' })
  contactIdentifier: string;

  @ApiPropertyOptional({ nullable: true })
  contactName: string | null;

  @ApiPropertyOptional({ nullable: true })
  client: { id: string; name: string } | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedUserId: string | null;

  @ApiProperty({ enum: ConversationStatus })
  status: ConversationStatus;

  @ApiProperty({ description: 'The client wrote and nobody has answered yet.' })
  needsReply: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastMessageAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastMessagePreview: string | null;

  static fromView(view: ConversationView): ConversationResponseDto {
    const snapshot = view.conversation.toSnapshot();

    return {
      id: snapshot.id,
      channel: snapshot.channel,
      contactIdentifier: snapshot.contactIdentifier,
      contactName: snapshot.contactName,
      client: view.client,
      assignedUserId: snapshot.assignedUserId,
      status: snapshot.status,
      needsReply: snapshot.needsReply,
      lastMessageAt: snapshot.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: snapshot.lastMessagePreview,
    };
  }
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: MessageDirection })
  direction: MessageDirection;

  @ApiProperty({ enum: MessageType })
  type: MessageType;

  @ApiPropertyOptional({ nullable: true })
  body: string | null;

  @ApiProperty()
  sentAt: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authorUserId: string | null;

  static fromDomain(message: Message): MessageResponseDto {
    const snapshot = message.toSnapshot();

    return {
      id: snapshot.id,
      direction: snapshot.direction,
      type: snapshot.type,
      body: snapshot.body,
      sentAt: snapshot.sentAt.toISOString(),
      authorUserId: snapshot.authorUserId,
    };
  }
}

export class SimulateInboundResponseDto {
  @ApiProperty({ enum: ['recorded', 'duplicate'] })
  outcome: 'recorded' | 'duplicate';

  @ApiPropertyOptional({ format: 'uuid' })
  conversationId?: string;
}

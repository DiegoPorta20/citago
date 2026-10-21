import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { v7 as uuidV7 } from 'uuid';

import type { EnvironmentVariables } from '../../../config/environment.js';
import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { ClientPhoneNormalizer } from '../../clients/application/client-phone-normalizer.js';
import { RecordInboundMessageUseCase } from '../application/record-inbound-message.use-case.js';
import {
  ConversationChannel,
  MessageType,
} from '../domain/conversation.enums.js';
import { DevToolsDisabledError } from '../domain/conversation.errors.js';
import {
  SimulateInboundRequestDto,
  SimulateInboundResponseDto,
} from './conversations.dto.js';

@ApiTags('dev')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsDevController {
  private readonly enabled: boolean;

  constructor(
    private readonly recordInbound: RecordInboundMessageUseCase,
    private readonly phoneNormalizer: ClientPhoneNormalizer,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.enabled = config.get('DEV_TOOLS_ENABLED', { infer: true });
  }

  @Post('simulate-inbound')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: '[DEV] Simulate an incoming WhatsApp message',
    description:
      'Only available with DEV_TOOLS_ENABLED=true. Reuse an externalMessageId to test idempotency.',
  })
  @ApiOkResponse({ type: SimulateInboundResponseDto })
  async simulate(
    @CurrentAuth() auth: AuthContext,
    @Body() body: SimulateInboundRequestDto,
  ): Promise<SimulateInboundResponseDto> {
    if (!this.enabled) {
      throw new DevToolsDisabledError();
    }

    const phone = await this.phoneNormalizer.normalize(
      auth.tenantId,
      body.phone,
    );

    const result = await this.recordInbound.execute({
      tenantId: auth.tenantId,
      channel: ConversationChannel.WhatsApp,
      contactIdentifier: phone?.value ?? body.phone,
      contactName: body.name,
      externalMessageId: body.externalMessageId ?? `sim-${uuidV7()}`,
      type: MessageType.Text,
      body: body.body,
      sentAt: body.sentAt ? new Date(body.sentAt) : new Date(),
    });

    return result.outcome === 'recorded'
      ? { outcome: 'recorded', conversationId: result.conversationId }
      : { outcome: 'duplicate' };
  }
}

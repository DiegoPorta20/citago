import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import {
  ConnectWhatsAppChannelUseCase,
  DisconnectWhatsAppChannelUseCase,
  GetWhatsAppChannelUseCase,
} from '../application/whatsapp-channel.use-cases.js';
import {
  ConnectWhatsAppRequestDto,
  WhatsAppChannelResponseDto,
} from './whatsapp-channel.dto.js';

/** Setting up the business's WhatsApp number: OWNER or ADMIN (docs/permissions.md). */
@ApiTags('whatsapp')
@ApiBearerAuth()
@Roles(UserRole.Owner, UserRole.Admin)
@Controller('whatsapp/channel')
export class WhatsAppChannelController {
  constructor(
    private readonly getChannel: GetWhatsAppChannelUseCase,
    private readonly connectChannel: ConnectWhatsAppChannelUseCase,
    private readonly disconnectChannel: DisconnectWhatsAppChannelUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Connection status of the WhatsApp number' })
  @ApiOkResponse({ type: WhatsAppChannelResponseDto })
  async status(
    @CurrentAuth() auth: AuthContext,
  ): Promise<WhatsAppChannelResponseDto> {
    return WhatsAppChannelResponseDto.fromDomain(
      await this.getChannel.execute(auth),
    );
  }

  @Put()
  @ApiOperation({
    summary: 'Connect (or replace) the WhatsApp number',
    description:
      'The credentials are checked with Meta before saving. 422 WHATSAPP_CREDENTIALS_REJECTED if Meta refuses them; 409 WHATSAPP_NUMBER_IN_USE if another business has the number.',
  })
  @ApiOkResponse({ type: WhatsAppChannelResponseDto })
  async connect(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ConnectWhatsAppRequestDto,
  ): Promise<WhatsAppChannelResponseDto> {
    return WhatsAppChannelResponseDto.fromDomain(
      await this.connectChannel.execute(auth, {
        phoneNumberId: body.phoneNumberId,
        accessToken: body.accessToken,
        wabaId: body.wabaId,
      }),
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disconnect the number and delete its token',
    description: 'Conversations and their messages are kept.',
  })
  @ApiNoContentResponse()
  async disconnect(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.disconnectChannel.execute(auth);
  }
}

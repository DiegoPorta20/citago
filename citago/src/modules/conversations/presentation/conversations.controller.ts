import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { Page } from '../../../shared/domain/pagination.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import {
  ArchiveConversationUseCase,
  AssignConversationUseCase,
  LinkConversationClientUseCase,
  MarkConversationResolvedUseCase,
  ReopenConversationUseCase,
} from '../application/conversation-management.use-cases.js';
import {
  ConversationViewAssembler,
  GetConversationUseCase,
  ListInboxUseCase,
  ListMessagesUseCase,
} from '../application/conversation-queries.js';
import { SendReplyUseCase } from '../application/send-reply.use-case.js';
import type { Conversation } from '../domain/conversation.entity.js';
import {
  AssignRequestDto,
  ConversationResponseDto,
  InboxQueryDto,
  LinkClientRequestDto,
  MessageResponseDto,
  MessagesQueryDto,
  SendReplyRequestDto,
} from './conversations.dto.js';

interface CursorMeta {
  readonly hasMore: boolean;
  /** Pass as `before` to load the next, older page. */
  readonly nextBefore: string | null;
}

/**
 * The inbox.
 *
 * Every member reads and handles conversations — the barber at the chair
 * answers too. Archiving and assigning are management: OWNER or ADMIN
 * (docs/permissions.md).
 */
@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly listInbox: ListInboxUseCase,
    private readonly getConversation: GetConversationUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly markResolved: MarkConversationResolvedUseCase,
    private readonly archiveConversation: ArchiveConversationUseCase,
    private readonly reopenConversation: ReopenConversationUseCase,
    private readonly linkClient: LinkConversationClientUseCase,
    private readonly assignConversation: AssignConversationUseCase,
    private readonly sendReply: SendReplyUseCase,
    private readonly assembler: ConversationViewAssembler,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Inbox, most recent activity first',
    description: '`needsReply=true` gives the pending conversations.',
  })
  @ApiOkResponse({ type: ConversationResponseDto, isArray: true })
  async inbox(
    @CurrentAuth() auth: AuthContext,
    @Query() query: InboxQueryDto,
  ): Promise<Page<ConversationResponseDto>> {
    const page = await this.listInbox.execute(auth, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      needsReply: query.needsReply,
      assignedUserId: query.assignedUserId,
      clientId: query.clientId,
    });

    return {
      items: page.items.map((view) => ConversationResponseDto.fromView(view)),
      meta: page.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One conversation' })
  @ApiOkResponse({ type: ConversationResponseDto })
  async detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return ConversationResponseDto.fromView(
      await this.getConversation.execute(auth, id),
    );
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Messages, newest first',
    description:
      'Cursor pagination: pass the id of the oldest message you have as `before` to load earlier ones. `meta.hasMore` tells whether to keep going.',
  })
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  async messages(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ): Promise<{ items: MessageResponseDto[]; meta: CursorMeta }> {
    const page = await this.listMessages.execute(auth, {
      conversationId: id,
      before: query.before,
      limit: query.limit,
    });
    const items = page.items.map((message) =>
      MessageResponseDto.fromDomain(message),
    );

    // Same { items, meta } shape as a Page, so the response interceptor turns
    // it into { data, meta } like every other collection.
    return {
      items,
      meta: {
        hasMore: page.hasMore,
        nextBefore: page.hasMore ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Reply to the client through the conversation channel',
    description:
      'Sent first, then recorded. WhatsApp only accepts a free-form reply within 24 hours since the client last wrote (REPLY_WINDOW_CLOSED otherwise). A channel failure answers 502 MESSAGE_DELIVERY_FAILED and records nothing.',
  })
  @ApiCreatedResponse({ type: MessageResponseDto })
  async reply(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendReplyRequestDto,
  ): Promise<MessageResponseDto> {
    return MessageResponseDto.fromDomain(
      await this.sendReply.execute(auth, {
        conversationId: id,
        body: body.body,
      }),
    );
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark as handled',
    description: 'Clears the pending flag, e.g. when the answer went by phone.',
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  async resolve(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return this.present(auth, await this.markResolved.execute(auth, id));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Archive',
    description: 'Leaves the inbox until the client writes again.',
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  async archive(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return this.present(auth, await this.archiveConversation.execute(auth, id));
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({ summary: 'Bring an archived conversation back to the inbox' })
  @ApiOkResponse({ type: ConversationResponseDto })
  async reopen(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationResponseDto> {
    return this.present(auth, await this.reopenConversation.execute(auth, id));
  }

  @Put(':id/client')
  @ApiOperation({
    summary: 'Link the conversation to a client (or unlink with null)',
    description:
      'Needed when the number was unknown when the first message arrived.',
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  async link(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkClientRequestDto,
  ): Promise<ConversationResponseDto> {
    return this.present(
      auth,
      await this.linkClient.execute(auth, {
        conversationId: id,
        clientId: body.clientId,
      }),
    );
  }

  @Put(':id/assignee')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Assign to a member of the business (or unassign with null)',
  })
  @ApiOkResponse({ type: ConversationResponseDto })
  async assign(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignRequestDto,
  ): Promise<ConversationResponseDto> {
    return this.present(
      auth,
      await this.assignConversation.execute(auth, {
        conversationId: id,
        assigneeUserId: body.userId,
      }),
    );
  }

  private async present(
    auth: AuthContext,
    conversation: Conversation,
  ): Promise<ConversationResponseDto> {
    const [view] = await this.assembler.assemble(auth.tenantId, [conversation]);

    return ConversationResponseDto.fromView(view);
  }
}

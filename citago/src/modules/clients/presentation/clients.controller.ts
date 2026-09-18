import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { Page } from '../../../shared/domain/pagination.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import { CreateClientUseCase } from '../application/create-client/create-client.use-case.js';
import { DeleteClientUseCase } from '../application/delete-client/delete-client.use-case.js';
import { GetClientUseCase } from '../application/get-client/get-client.use-case.js';
import { ListClientsUseCase } from '../application/list-clients/list-clients.use-case.js';
import { RestoreClientUseCase } from '../application/restore-client/restore-client.use-case.js';
import { UpdateClientUseCase } from '../application/update-client/update-client.use-case.js';
import { ClientResponseDto } from './dto/client.response.dto.js';
import { CreateClientRequestDto } from './dto/create-client.request.dto.js';
import { ListClientsQueryDto } from './dto/list-clients.query.dto.js';
import { UpdateClientRequestDto } from './dto/update-client.request.dto.js';

/**
 * Customers of the business.
 *
 * Every member may register and edit clients — the barber at the chair is the
 * one who meets them. Deleting and restoring is OWNER or ADMIN
 * (see docs/permissions.md).
 *
 * `DELETE` is a **soft** delete: the client disappears from lists but keeps
 * their appointments and sales (rule CL-3).
 */
@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly createClient: CreateClientUseCase,
    private readonly updateClient: UpdateClientUseCase,
    private readonly getClient: GetClientUseCase,
    private readonly listClients: ListClientsUseCase,
    private readonly deleteClient: DeleteClientUseCase,
    private readonly restoreClient: RestoreClientUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a client' })
  @ApiCreatedResponse({ type: ClientResponseDto })
  @ApiConflictResponse({
    description:
      'CLIENT_PHONE_ALREADY_REGISTERED (details.clientId points at the existing one) or CLIENT_DELETED_WITH_SAME_PHONE (restore it instead)',
    type: ApiErrorDto,
  })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateClientRequestDto,
  ): Promise<ClientResponseDto> {
    const client = await this.createClient.execute(auth, {
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
    });

    return ClientResponseDto.fromDomain(client);
  }

  @Get()
  @ApiOperation({
    summary: 'List and search clients',
    description: 'Paginated, sorted by name, deleted clients excluded.',
  })
  @ApiOkResponse({ type: ClientResponseDto, isArray: true })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListClientsQueryDto,
  ): Promise<Page<ClientResponseDto>> {
    const page = await this.listClients.execute(auth, {
      page: query.page,
      limit: query.limit,
      query: query.q,
    });

    return {
      items: page.items.map((client) => ClientResponseDto.fromDomain(client)),
      meta: page.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one client' })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiNotFoundResponse({ description: 'CLIENT_NOT_FOUND', type: ApiErrorDto })
  async getOne(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return ClientResponseDto.fromDomain(await this.getClient.execute(auth, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiNotFoundResponse({ description: 'CLIENT_NOT_FOUND', type: ApiErrorDto })
  @ApiConflictResponse({
    description: 'CLIENT_PHONE_ALREADY_REGISTERED',
    type: ApiErrorDto,
  })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientRequestDto,
  ): Promise<ClientResponseDto> {
    const client = await this.updateClient.execute(auth, {
      clientId: id,
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
    });

    return ClientResponseDto.fromDomain(client);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Delete a client (soft)',
    description:
      'Hides the client and keeps their history. Can be undone with POST /:id/restore.',
  })
  @ApiNoContentResponse()
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteClient.execute(auth, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Restore a deleted client',
    description: 'Idempotent. Brings the client back with all their history.',
  })
  @ApiOkResponse({ type: ClientResponseDto })
  async restore(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return ClientResponseDto.fromDomain(
      await this.restoreClient.execute(auth, id),
    );
  }
}

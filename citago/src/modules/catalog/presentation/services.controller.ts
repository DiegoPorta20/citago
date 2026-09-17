import {
  Body,
  Controller,
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
  ApiForbiddenResponse,
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
import { CreateServiceUseCase } from '../application/create-service/create-service.use-case.js';
import { GetServiceUseCase } from '../application/get-service/get-service.use-case.js';
import { ListServicesUseCase } from '../application/list-services/list-services.use-case.js';
import { SetServiceStatusUseCase } from '../application/set-service-status/set-service-status.use-case.js';
import { UpdateServiceUseCase } from '../application/update-service/update-service.use-case.js';
import { ServiceStatus } from '../domain/service-status.js';
import { CreateServiceRequestDto } from './dto/create-service.request.dto.js';
import { ListServicesQueryDto } from './dto/list-services.query.dto.js';
import { ServiceResponseDto } from './dto/service.response.dto.js';
import { UpdateServiceRequestDto } from './dto/update-service.request.dto.js';

/**
 * The service catalogue.
 *
 * There is **no DELETE**: a service with history is deactivated, never removed
 * (rule CA-3). `POST /:id/deactivate` is the honest name for that action.
 *
 * Reading is open to every member of the tenant — staff need to know what the
 * business offers. Changing the catalogue is OWNER or ADMIN
 * (see docs/permissions.md).
 */
@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly setServiceStatus: SetServiceStatusUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly getService: GetServiceUseCase,
  ) {}

  @Post()
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({ summary: 'Create a service' })
  @ApiCreatedResponse({ type: ServiceResponseDto })
  @ApiConflictResponse({
    description: 'DUPLICATE_SERVICE_NAME',
    type: ApiErrorDto,
  })
  @ApiForbiddenResponse({ description: 'INSUFFICIENT_ROLE', type: ApiErrorDto })
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateServiceRequestDto,
  ): Promise<ServiceResponseDto> {
    const service = await this.createService.execute(auth, {
      name: body.name,
      description: body.description,
      durationMinutes: body.durationMinutes,
      price: body.price,
    });

    return ServiceResponseDto.fromDomain(service);
  }

  @Get()
  @ApiOperation({
    summary: 'List services',
    description: 'Paginated and scoped to the authenticated tenant.',
  })
  @ApiOkResponse({ type: ServiceResponseDto, isArray: true })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListServicesQueryDto,
  ): Promise<Page<ServiceResponseDto>> {
    const page = await this.listServices.execute(auth, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      query: query.q,
    });

    // The response interceptor turns a Page into { data, meta }.
    return {
      items: page.items.map((service) =>
        ServiceResponseDto.fromDomain(service),
      ),
      meta: page.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one service' })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiNotFoundResponse({
    description:
      'SERVICE_NOT_FOUND — also returned for another tenant’s service',
    type: ApiErrorDto,
  })
  async getOne(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceResponseDto> {
    return ServiceResponseDto.fromDomain(
      await this.getService.execute(auth, id),
    );
  }

  @Patch(':id')
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Update a service',
    description:
      'Existing appointments keep the price and duration they were booked with.',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiNotFoundResponse({ description: 'SERVICE_NOT_FOUND', type: ApiErrorDto })
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateServiceRequestDto,
  ): Promise<ServiceResponseDto> {
    const service = await this.updateService.execute(auth, {
      serviceId: id,
      name: body.name,
      description: body.description,
      durationMinutes: body.durationMinutes,
      price: body.price,
    });

    return ServiceResponseDto.fromDomain(service);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Put a service back on the menu',
    description: 'Idempotent: activating an active service changes nothing.',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  async activate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceResponseDto> {
    const service = await this.setServiceStatus.execute(auth, {
      serviceId: id,
      status: ServiceStatus.Active,
    });

    return ServiceResponseDto.fromDomain(service);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.Owner, UserRole.Admin)
  @ApiOperation({
    summary: 'Take a service off the menu',
    description:
      'Keeps all history: past appointments still reference it, new ones cannot use it. This replaces deleting.',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  async deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceResponseDto> {
    const service = await this.setServiceStatus.execute(auth, {
      serviceId: id,
      status: ServiceStatus.Inactive,
    });

    return ServiceResponseDto.fromDomain(service);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import type { AuthContext } from '../../../shared/application/auth-context.js';
import type { Page } from '../../../shared/domain/pagination.js';
import { UserRole } from '../../../shared/domain/user-role.js';
import { CurrentAuth } from '../../../shared/presentation/decorators/current-auth.decorator.js';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator.js';
import { ApiErrorDto } from '../../../shared/presentation/dto/api-error.dto.js';
import {
  GetSaleUseCase,
  ListSalesUseCase,
  SaleViewAssembler,
} from '../application/sale-queries.js';
import { RegisterSaleUseCase } from '../application/register-sale.use-case.js';
import { TransitionSaleUseCase } from '../application/transition-sale.use-case.js';
import type { Sale } from '../domain/sale.entity.js';
import { SaleStatus } from '../domain/sale-status.js';
import {
  ListSalesQueryDto,
  PaySaleRequestDto,
  RegisterSaleRequestDto,
  SaleResponseDto,
  VoidSaleRequestDto,
} from './sales.dto.js';

/**
 * The till.
 *
 * There is **no PATCH and no DELETE**: a sale is never edited or removed
 * (rule SA-4). A mistake is cancelled if it was never charged, or refunded if
 * it was, always with a reason and an author — and both are OWNER or ADMIN
 * decisions (docs/permissions.md).
 *
 * Recording and reading are open to every member, but a STAFF user only ever
 * sees and records their own work; that depends on *which* sale, so it is
 * enforced in the use cases rather than here.
 */
@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(
    private readonly registerSale: RegisterSaleUseCase,
    private readonly transitionSale: TransitionSaleUseCase,
    private readonly getSale: GetSaleUseCase,
    private readonly listSales: ListSalesUseCase,
    private readonly assembler: SaleViewAssembler,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Record a sale',
    description:
      'Either for a completed appointment (`appointmentId`) or over the counter (`lines`). With `paymentMethod` the sale is already PAID.',
  })
  @ApiCreatedResponse({ type: SaleResponseDto })
  @ApiConflictResponse({
    description: 'APPOINTMENT_ALREADY_BILLED',
    type: ApiErrorDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'APPOINTMENT_NOT_BILLABLE, DISCOUNT_ABOVE_SUBTOTAL…',
    type: ApiErrorDto,
  })
  @ApiForbiddenResponse({ description: 'OWN_SALES_ONLY', type: ApiErrorDto })
  async register(
    @CurrentAuth() auth: AuthContext,
    @Body() body: RegisterSaleRequestDto,
  ): Promise<SaleResponseDto> {
    return this.present(auth, await this.registerSale.execute(auth, body));
  }

  @Get()
  @ApiOperation({
    summary: 'Sales recorded in a time range',
    description: 'STAFF users only ever see the sales of their own work.',
  })
  @ApiOkResponse({ type: SaleResponseDto, isArray: true })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListSalesQueryDto,
  ): Promise<Page<SaleResponseDto>> {
    const page = await this.listSales.execute(auth, {
      page: query.page,
      limit: query.limit,
      from: new Date(query.from),
      to: new Date(query.to),
      status: query.status,
      clientId: query.clientId,
      staffMemberId: query.staffMemberId,
    });

    return {
      items: page.items.map((view) => SaleResponseDto.fromView(view)),
      meta: page.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One sale with its lines' })
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiNotFoundResponse({ description: 'SALE_NOT_FOUND', type: ApiErrorDto })
  async detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SaleResponseDto> {
    return SaleResponseDto.fromView(await this.getSale.execute(auth, id));
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Charge a pending sale' })
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'INVALID_SALE_TRANSITION',
    type: ApiErrorDto,
  })
  async pay(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaySaleRequestDto,
  ): Promise<SaleResponseDto> {
    const sale = await this.transitionSale.execute(auth, {
      saleId: id,
      target: SaleStatus.Paid,
      paymentMethod: body.paymentMethod,
    });

    return this.present(auth, sale);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Owner, UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void a sale that was never charged',
    description:
      'Only while it is PENDING. A charged sale is refunded instead.',
  })
  @ApiOkResponse({ type: SaleResponseDto })
  async cancel(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VoidSaleRequestDto,
  ): Promise<SaleResponseDto> {
    const sale = await this.transitionSale.execute(auth, {
      saleId: id,
      target: SaleStatus.Cancelled,
      reason: body.reason,
    });

    return this.present(auth, sale);
  }

  @Post(':id/refund')
  @Roles(UserRole.Owner, UserRole.Admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give back a charged sale',
    description:
      'The sale stays in the history as REFUNDED and stops counting as revenue.',
  })
  @ApiOkResponse({ type: SaleResponseDto })
  async refund(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VoidSaleRequestDto,
  ): Promise<SaleResponseDto> {
    const sale = await this.transitionSale.execute(auth, {
      saleId: id,
      target: SaleStatus.Refunded,
      reason: body.reason,
    });

    return this.present(auth, sale);
  }

  private async present(
    auth: AuthContext,
    sale: Sale,
  ): Promise<SaleResponseDto> {
    const [view] = await this.assembler.assemble(auth.tenantId, [sale]);

    return SaleResponseDto.fromView(view);
  }
}

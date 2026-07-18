import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import {
  SetDefaultPaymentMethodDto,
  UpdateBillingDto,
} from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Get brand billing profile and payment methods' })
  async getBilling(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.billing.getBilling(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put()
  @ApiOperation({ summary: 'Update brand billing profile and sync Stripe customer' })
  async updateBilling(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpdateBillingDto,
  ) {
    const data = await this.billing.updateBilling(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('payment-methods/default')
  @ApiOperation({ summary: 'Set the default payment method' })
  async setDefaultPaymentMethod(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: SetDefaultPaymentMethodDto,
  ) {
    const data = await this.billing.setDefaultPaymentMethod(
      user.sub,
      dto.paymentMethodId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('setup-intent')
  @ApiOperation({
    summary: 'Create a Stripe SetupIntent for adding a payment method',
  })
  async createSetupIntent(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.billing.createSetupIntent(user.sub);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('invoices')
  @ApiOperation({
    summary: 'Create a local invoice from the current plan (no Stripe charge)',
  })
  async createInvoice(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.billing.createInvoiceFromPlan(user.sub);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Download an invoice PDF' })
  @Header('Content-Type', 'application/pdf')
  async downloadInvoicePdf(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.billing.getInvoicePdf(user.sub, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(buffer);
  }
}

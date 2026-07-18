import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from 'src/shared/stripe/stripe.service';
import { StripeWebhooksService } from './stripe-webhooks.service';

@ApiTags('stripe')
@Controller('stripe')
export class StripeWebhooksController {
  constructor(
    private readonly stripe: StripeService,
    private readonly webhooks: StripeWebhooksService,
  ) {}

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint (signature-verified when configured)',
  })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    try {
      const event = this.stripe.constructWebhookEvent(req.rawBody, signature);
      const data = await this.webhooks.handleEvent(event);
      return { status: HttpStatus.OK, error: null, data };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid webhook',
      );
    }
  }
}

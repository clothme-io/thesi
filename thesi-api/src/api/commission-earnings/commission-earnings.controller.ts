import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { IsUUID } from 'class-validator';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthJwtPayload,
} from 'src/shared/auth/jwt-auth.guard';
import { MerchantServiceGuard } from '../merchant-links/merchant-links.controller';
import { CommissionEarningsService } from './commission-earnings.service';
import { CommissionEventDto } from './commission-event.dto';
const matches = (actual: unknown, expected: string) =>
  typeof actual === 'string' &&
  expected.length >= 32 &&
  Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
  timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
@Injectable()
export class EarningsIngestionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext) {
    if (
      !matches(
        ctx.switchToHttp().getRequest().headers['x-thesi-earnings-key'],
        this.config.get<string>('EARNINGS_SERVICE_KEY') ?? '',
      )
    )
      throw new ForbiddenException();
    return true;
  }
}
@Injectable()
export class EarningsOperationsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext) {
    if (
      !matches(
        ctx.switchToHttp().getRequest().headers['x-thesi-report-key'],
        this.config.get<string>('EARNINGS_REPORT_SERVICE_KEY') ?? '',
      )
    )
      throw new ForbiddenException();
    return true;
  }
}
class MerchantDto {
  @IsUUID() vendorId!: string;
  @IsUUID() brandId!: string;
}
@Controller('commission-earnings')
@UseGuards(JwtAuthGuard)
export class CommissionEarningsController {
  constructor(private readonly earnings: CommissionEarningsService) {}
  @Get() async mine(@CurrentUser() user: AuthJwtPayload) {
    return { data: await this.earnings.mine(user) };
  }
}
@Controller('internal/commission-earnings')
export class CommissionEarningsInternalController {
  constructor(private readonly earnings: CommissionEarningsService) {}
  @Post('events') @UseGuards(EarningsIngestionGuard) async ingest(
    @Body() event: CommissionEventDto,
  ) {
    return { data: await this.earnings.ingest(event) };
  }
  @Get('report') @UseGuards(EarningsOperationsGuard) async report() {
    return { data: await this.earnings.operations() };
  }
}
@Controller('internal/merchant-links')
@UseGuards(MerchantServiceGuard)
export class MerchantEarningsController {
  constructor(private readonly earnings: CommissionEarningsService) {}
  @Post('earnings') async report(@Body() dto: MerchantDto) {
    return { data: await this.earnings.merchant(dto.vendorId, dto.brandId) };
  }
}

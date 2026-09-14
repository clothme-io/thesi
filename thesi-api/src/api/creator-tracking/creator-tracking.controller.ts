import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, ServiceUnavailableException, Param, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { JwtAuthGuard, type AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { CreatorTrackingService } from './creator-tracking.service';
class CodeDto { @Matches(/^[A-Za-z0-9_-]{43}$/) code!: string; }
class IssueDto { @IsUUID() campaignId!: string; @IsOptional() @IsUUID() productId?:string; }
class ClaimDto extends CodeDto { @Matches(/^[A-Za-z0-9_-]{43}$/) buyerKey!: string; }
class ValidateDto { @IsUUID() receiptId!: string; @Matches(/^[A-Za-z0-9_-]{43}$/) buyerKey!: string; }
@Injectable()
export class AttributionServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    if (this.config.get('CREATOR_TRACKING_ENABLED') !== true) throw new ServiceUnavailableException('Creator attribution verification is paused');
    const actual = context.switchToHttp().getRequest().headers['x-thesi-attribution-key'];
    const expected = this.config.get<string>('ATTRIBUTION_SERVICE_KEY') ?? '';
    if (typeof actual !== 'string' || expected.length < 32 || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new ForbiddenException();
    return true;
  }
}
@Controller('creator-tracking')
export class CreatorTrackingController {
  constructor(private readonly tracking: CreatorTrackingService) {}
  @Get('links') @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser() user: AuthJwtPayload) { return { data: await this.tracking.mine(user.sub) }; }
  @Post('links') @UseGuards(JwtAuthGuard)
  async issue(@CurrentUser() user: AuthJwtPayload, @Body() dto: IssueDto) { return { data: await this.tracking.issue(user.sub, dto.campaignId,dto.productId) }; }
  @Get('preview/:code')
  async preview(@Param() dto: CodeDto) { return { data: await this.tracking.preview(dto.code) }; }
  @Post('click')
  async click(@Body() dto: CodeDto) { return { data: await this.tracking.click(dto.code) }; }
}
@Controller('internal/creator-attribution')
@UseGuards(AttributionServiceGuard)
export class CreatorAttributionController {
  constructor(private readonly tracking: CreatorTrackingService) {}
  @Post('claim') async claim(@Body() dto: ClaimDto) { return { data: await this.tracking.claim(dto.code, dto.buyerKey) }; }
  @Post('validate') async validate(@Body() dto: ValidateDto) { return { data: await this.tracking.validate(dto.receiptId, dto.buyerKey) }; }
}

import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Post, UseGuards, UnauthorizedException, NotFoundException,ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { JwtAuthGuard, type AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { MerchantLinksService } from './merchant-links.service';
import { ProductCampaignService, type ProductCampaignInput } from './product-campaign.service';

class MerchantBrandDto { @IsUUID() vendorId!: string; @IsUUID() brandId!: string; }
class StartDto extends MerchantBrandDto {
  @IsString() @Length(1, 200) vendorName!: string;
  @IsString() @Length(1, 200) brandName!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) challenge!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @IsIn(['link', 'open']) action!: 'link'|'open';
}
class CodeDto { @Matches(/^[A-Za-z0-9_-]{43}$/) code!: string; }
class ApproveDto extends CodeDto { @IsOptional() @IsUUID() workspaceId?: string; }
class CompleteDto extends MerchantBrandDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) code!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) verifier!: string;
}
class RevokeDto extends MerchantBrandDto { @IsUUID() linkId!: string; }
class ProductCampaignReadDto extends MerchantBrandDto { @IsUUID() campaignId!: string; }
class ProductCampaignCurrentDto extends MerchantBrandDto { @IsUUID() productId!: string; }
class ProductCampaignDto extends MerchantBrandDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsString() @Length(1, 160) name!: string;
  @IsString() @Length(0, 1000) description!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
  @IsString() @Length(1, 8000) brief!: string;
  @IsString() @Length(1, 4000) deliverables!: string;
  @IsArray() @ArrayMinSize(1) @IsIn(['tiktok', 'instagram_reels', 'youtube_shorts', 'ugc_photos', 'mixed_bundle', 'long_form'], { each: true }) contentTypes!: string[];
  @IsIn(['percentage_of_sale', 'fixed_amount_per_sale']) commissionType!: 'percentage_of_sale' | 'fixed_amount_per_sale';
  @IsOptional() @IsNumber() @Min(0) commissionPercent?: number;
  @IsOptional() @IsInt() @Min(0) fixedAmountCents?: number;
  @IsString() @Length(1, 2000) notes!: string;
  @IsInt() @Min(1) attributionWindowDays!: number;
  @IsInt() @Min(1) creatorSlots!: number;
  @IsInt() @Min(0) reviewDays!: number;
  @IsIn(['on_approval', 'weekly', 'monthly']) payoutFrequency!: 'on_approval' | 'weekly' | 'monthly';
  @IsInt() @Min(0) minimumPayoutCents!: number;
}
const ok = (data: unknown) => ({ status: 200, error: null, data });

@Injectable()
export class MerchantServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    if (this.config.get('MERCHANT_LINKING_ENABLED') !== true) throw new NotFoundException('Merchant linking is unavailable');
    const supplied = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>().headers['x-thesi-merchant-key'];
    const expected = this.config.get<string>('MERCHANT_LINK_SERVICE_KEY');
    if (typeof supplied !== 'string' || !expected || expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid Merchant service credentials');
    }
    return true;
  }
}

@Controller('internal/merchant-links')
@UseGuards(MerchantServiceGuard)
export class MerchantLinkInternalController {
  constructor(private readonly links: MerchantLinksService, private readonly productCampaigns: ProductCampaignService) {}
  @Post('start') async start(@Body() dto: StartDto) { return ok(await this.links.start(dto)); }
  @Post('product-campaign/read') async readProductCampaign(@Body() dto: ProductCampaignReadDto) { return ok(await this.productCampaigns.read(dto.vendorId, dto.brandId, dto.campaignId)); }
  @Post('product-campaign/current') async currentProductCampaign(@Body() dto: ProductCampaignCurrentDto) { return ok(await this.productCampaigns.current(dto.vendorId, dto.brandId, dto.productId)); }
  @Post('product-campaign') async upsertProductCampaign(@Body() dto: ProductCampaignDto) { return ok(await this.productCampaigns.upsert(dto as ProductCampaignInput)); }
  @Post('review') async review(@Body() dto: CompleteDto) { return ok(await this.links.review(dto)); }
  @Post('complete') async complete(@Body() dto: CompleteDto) { return ok(await this.links.complete(dto)); }
  @Post('status') async status(@Body() dto: MerchantBrandDto) { return ok(await this.links.status(dto.vendorId, dto.brandId)); }
  @Post('revoke') async revoke(@Body() dto: RevokeDto) { return ok(await this.links.revoke(dto.linkId, dto)); }
}

@Controller('merchant-links')
@UseGuards(JwtAuthGuard)
export class MerchantLinksController {
  constructor(private readonly links: MerchantLinksService) {}
  @Post('intent') async describe(@Body() dto: CodeDto) { return ok(await this.links.describe(dto.code)); }
  @Post('approve') async approve(@CurrentUser() user: AuthJwtPayload, @Body() dto: ApproveDto) {
    if(user.merchantWorkspaceId&&dto.workspaceId&&user.merchantWorkspaceId!==dto.workspaceId)throw new ForbiddenException('Open this brand from Merchant Hub');
    return ok(await this.links.approve(user.sub, dto.code, user.merchantWorkspaceId??dto.workspaceId));
  }
  @Get() async mine(@CurrentUser() user: AuthJwtPayload) { return ok(await this.links.mine(user.sub,user.merchantWorkspaceId)); }
  @Post(':id/revoke') async revoke(@CurrentUser() user: AuthJwtPayload, @Param('id', ParseUUIDPipe) id: string) { return ok(await this.links.revoke(id, { userId: user.sub,workspaceId:user.merchantWorkspaceId })); }
}

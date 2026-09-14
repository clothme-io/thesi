import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Post, UseGuards, UnauthorizedException, NotFoundException,ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { JwtAuthGuard, type AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { MerchantLinksService } from './merchant-links.service';

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
  constructor(private readonly links: MerchantLinksService) {}
  @Post('start') async start(@Body() dto: StartDto) { return ok(await this.links.start(dto)); }
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

import {
  Controller,
  Get,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { SocialService } from './social.service';

@ApiTags('social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'List connected social accounts for the creator' })
  async accounts(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.listAccounts(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('youtube/sync')
  @ApiOperation({ summary: 'Sync YouTube stats from the public Data API' })
  async syncYouTube(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.syncYouTube(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('tiktok/connect')
  @ApiOperation({ summary: 'Return the TikTok OAuth authorize URL' })
  async tiktokConnect(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.tiktokConnectUrl(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('tiktok/sync')
  @ApiOperation({ summary: 'Refresh TikTok stats for a connected account' })
  async syncTikTok(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.syncProvider(user.sub, 'tiktok');
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('tiktok/disconnect')
  @ApiOperation({ summary: 'Disconnect TikTok' })
  async disconnectTikTok(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.disconnect(user.sub, 'tiktok');
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('instagram/connect')
  @ApiOperation({ summary: 'Return the Instagram OAuth authorize URL' })
  async instagramConnect(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.instagramConnectUrl(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('instagram/sync')
  @ApiOperation({ summary: 'Refresh Instagram stats for a connected account' })
  async syncInstagram(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.syncProvider(user.sub, 'instagram');
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('instagram/disconnect')
  @ApiOperation({ summary: 'Disconnect Instagram' })
  async disconnectInstagram(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.disconnect(user.sub, 'instagram');
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('youtube/disconnect')
  @ApiOperation({ summary: 'Clear YouTube synced stats' })
  async disconnectYouTube(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.disconnect(user.sub, 'youtube');
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync every connected social account' })
  async syncAll(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.syncAllForUser(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }
}

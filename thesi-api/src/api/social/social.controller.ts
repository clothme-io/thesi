import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { SocialContentUrlDto } from './dto/social.dto';
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

  @Get('youtube/connect')
  @ApiOperation({
    summary: 'Return the Google OAuth authorize URL for YouTube (readonly)',
  })
  async youtubeConnect(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.youtubeConnectUrl(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('youtube/sync')
  @ApiOperation({ summary: 'Sync YouTube stats from the connected Google account' })
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
  @ApiOperation({ summary: 'Disconnect YouTube' })
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

  @Get('content')
  @ApiOperation({ summary: 'List imported posts with live views, likes, comments' })
  async listContent(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.social.listImportedContent(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('content/lookup')
  @ApiOperation({ summary: 'Look up views, likes, and comments for a post URL' })
  async lookupContent(
    @CurrentUser() user: AuthJwtPayload,
    @Body() body: SocialContentUrlDto,
  ) {
    const data = await this.social.lookupContent(user.sub, body.url);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('content/import')
  @ApiOperation({ summary: 'Import a published post into the creator portfolio' })
  async importContent(
    @CurrentUser() user: AuthJwtPayload,
    @Body() body: SocialContentUrlDto,
  ) {
    const data = await this.social.importContent(user.sub, body.url);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('content/:postId/refresh')
  @ApiOperation({ summary: 'Refresh metrics for an imported post' })
  async refreshContent(
    @CurrentUser() user: AuthJwtPayload,
    @Param('postId') postId: string,
  ) {
    const data = await this.social.refreshImportedContent(user.sub, postId);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('campaigns/:campaignId/content')
  @ApiOperation({ summary: 'List published posts attached to a campaign' })
  async listCampaignContent(
    @CurrentUser() user: AuthJwtPayload,
    @Param('campaignId') campaignId: string,
  ) {
    const data = await this.social.listCampaignContent(
      user.sub,
      user.role,
      campaignId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('campaigns/:campaignId/content')
  @ApiOperation({ summary: 'Attach a published post to an accepted campaign' })
  async attachCampaignContent(
    @CurrentUser() user: AuthJwtPayload,
    @Param('campaignId') campaignId: string,
    @Body() body: SocialContentUrlDto,
  ) {
    const data = await this.social.attachCampaignContent(
      user.sub,
      user.role,
      campaignId,
      body.url,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('campaigns/:campaignId/content/:contentId/refresh')
  @ApiOperation({ summary: 'Refresh metrics for a campaign-attached post' })
  async refreshCampaignContent(
    @CurrentUser() user: AuthJwtPayload,
    @Param('campaignId') campaignId: string,
    @Param('contentId') contentId: string,
  ) {
    const data = await this.social.refreshCampaignContent(
      user.sub,
      user.role,
      campaignId,
      contentId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('campaigns/:campaignId/content/:contentId')
  @ApiOperation({ summary: 'Detach a published post from a campaign' })
  async detachCampaignContent(
    @CurrentUser() user: AuthJwtPayload,
    @Param('campaignId') campaignId: string,
    @Param('contentId') contentId: string,
  ) {
    const data = await this.social.detachCampaignContent(
      user.sub,
      user.role,
      campaignId,
      contentId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }
}

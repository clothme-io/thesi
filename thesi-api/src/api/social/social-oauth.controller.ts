import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from 'src/shared/auth/admin-api-key.guard';
import { SocialService } from './social.service';

@ApiTags('social')
@Controller('social')
export class SocialOauthController {
  constructor(private readonly social: SocialService) {}

  @Get('tiktok/callback')
  @Redirect()
  @ApiOperation({ summary: 'TikTok OAuth callback (no JWT; state is signed)' })
  async tiktokCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const url = await this.social.handleOauthCallback(
      'tiktok',
      code,
      state,
      errorDescription || error,
    );
    return { url, statusCode: 302 };
  }

  @Get('instagram/callback')
  @Redirect()
  @ApiOperation({
    summary: 'Instagram OAuth callback (no JWT; state is signed)',
  })
  async instagramCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Query('error_reason') errorReason?: string,
  ) {
    const url = await this.social.handleOauthCallback(
      'instagram',
      code,
      state,
      errorDescription || errorReason || error,
    );
    return { url, statusCode: 302 };
  }

  @Post('cron')
  @UseGuards(AdminApiKeyGuard)
  @ApiHeader({ name: 'X-Admin-Api-Key', required: true })
  @ApiOperation({ summary: 'Sync all connected social accounts (admin cron)' })
  async cron() {
    const data = await this.social.cronSyncAll();
    return { status: HttpStatus.OK, error: null, data };
  }
}

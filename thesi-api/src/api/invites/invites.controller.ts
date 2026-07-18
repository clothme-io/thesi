import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import {
  CreateCampaignInviteDto,
  CreatePlatformBrandInviteDto,
} from './dto/invites.dto';
import { InvitesService } from './invites.service';

@ApiTags('invites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get('campaign')
  @ApiOperation({ summary: 'List campaign invites for the current brand' })
  async listCampaignInvites(
    @CurrentUser() user: AuthJwtPayload,
    @Query('campaignId') campaignId?: string,
  ) {
    const data = await this.invites.listCampaignInvites(user.sub, campaignId);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('campaign')
  @ApiOperation({
    summary: 'Create a campaign invite, deliver inbox, and trigger Novu',
  })
  async createCampaignInvite(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCampaignInviteDto,
  ) {
    const data = await this.invites.createCampaignInvite(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Get('platform-brand')
  @ApiOperation({ summary: 'List platform brand invites sent by the creator' })
  async listPlatformBrandInvites(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.invites.listPlatformBrandInvites(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('platform-brand')
  @ApiOperation({
    summary: 'Create a platform brand invite and trigger Novu',
  })
  async createPlatformBrandInvite(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreatePlatformBrandInviteDto,
  ) {
    const data = await this.invites.createPlatformBrandInvite(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import {
  CreateSelfNotificationDto,
  DeliverCampaignInviteDto,
  SendInboxReplyDto,
} from './dto/inbox.dto';
import { InboxService } from './inbox.service';

@ApiTags('inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'Get inbox contacts, messages, and notifications' })
  async getInbox(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.inbox.getInbox(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a reply in an inbox thread' })
  async sendReply(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: SendInboxReplyDto,
  ) {
    const data = await this.inbox.sendReply(
      user.sub,
      dto.contactId,
      dto.subject,
      dto.content,
    );
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('contacts/:id/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  async markContactRead(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.inbox.markContactRead(user.sub, id);
    return { status: HttpStatus.OK, error: null, data: { read: true } };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Soft-delete a message for the current user' })
  async deleteMessage(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.inbox.deleteMessage(user.sub, id);
    return { status: HttpStatus.OK, error: null, data: { deleted: true } };
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Create a notification for the current user' })
  async createNotification(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateSelfNotificationDto,
  ) {
    const data = await this.inbox.notifySelf(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllNotificationsRead(@CurrentUser() user: AuthJwtPayload) {
    await this.inbox.markAllNotificationsRead(user.sub);
    return { status: HttpStatus.OK, error: null, data: { read: true } };
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markNotificationRead(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.inbox.markNotificationRead(user.sub, id);
    return { status: HttpStatus.OK, error: null, data: { read: true } };
  }

  @Post('campaign-invites/deliver')
  @ApiOperation({
    summary: 'Deliver an internal campaign invite into the creator inbox',
  })
  async deliverCampaignInvite(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: DeliverCampaignInviteDto,
  ) {
    const data = await this.inbox.deliverCampaignInvite(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }
}

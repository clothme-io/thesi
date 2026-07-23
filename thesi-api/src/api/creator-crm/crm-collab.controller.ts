import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { CrmCollabService } from './crm-collab.service';
import {
  AcceptCrmWorkspaceInviteDto,
  ConnectCrmIntegrationDto,
  InviteCrmWorkspaceMemberDto,
  RenameCrmWorkspaceDto,
} from './dto/crm-collab.dto';

@ApiTags('creator-crm-collab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creator-crm')
export class CrmCollabController {
  constructor(private readonly collab: CrmCollabService) {}

  @Get('workspace')
  @ApiOperation({ summary: 'Get CRM workspace, team, and integrations' })
  async getWorkspace(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.collab.getSnapshot(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Patch('workspace')
  @ApiOperation({ summary: 'Rename CRM workspace' })
  async renameWorkspace(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: RenameCrmWorkspaceDto,
  ) {
    const data = await this.collab.renameWorkspace(user.sub, dto.name);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('workspace/invites')
  @ApiOperation({ summary: 'Invite a teammate to the CRM workspace' })
  async inviteMember(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: InviteCrmWorkspaceMemberDto,
  ) {
    const data = await this.collab.inviteMember(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('workspace/invites/accept')
  @ApiOperation({ summary: 'Accept a CRM workspace invite' })
  async acceptInvite(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: AcceptCrmWorkspaceInviteDto,
  ) {
    const data = await this.collab.acceptInvite(user.sub, dto.token);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('workspace/members/:id')
  @ApiOperation({ summary: 'Remove a CRM workspace member' })
  async removeMember(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.collab.removeMember(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('integrations/:id/connect')
  @ApiOperation({
    summary: 'Connect an email/calendar provider (OAuth stub)',
  })
  async connectIntegration(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConnectCrmIntegrationDto,
  ) {
    const data = await this.collab.connectIntegration(
      user.sub,
      id,
      dto.accountEmail,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('integrations/:id/disconnect')
  @ApiOperation({ summary: 'Disconnect an email/calendar provider' })
  async disconnectIntegration(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.collab.disconnectIntegration(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('integrations/:id/sync')
  @ApiOperation({
    summary: 'Run a stub sync that imports sample email/calendar items',
  })
  async syncIntegration(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.collab.syncIntegration(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }
}

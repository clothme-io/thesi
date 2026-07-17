import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from 'src/shared/auth/admin-api-key.guard';
import {
  CreateCreatorApplicationDto,
  CreatorApplicationResponse,
} from './dto/creator-application.dto';
import { CreatorApplicationsService } from './creator-applications.service';

@ApiTags('creator-applications')
@Controller('creator-applications')
export class CreatorApplicationsController {
  constructor(private readonly service: CreatorApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a creator application' })
  @ApiResponse({ status: 201, type: CreatorApplicationResponse })
  async create(
    @Body() dto: CreateCreatorApplicationDto,
  ): Promise<CreatorApplicationResponse> {
    const data = await this.service.create(dto);
    return {
      status: HttpStatus.CREATED,
      error: null,
      data,
    };
  }

  @Get()
  @UseGuards(AdminApiKeyGuard)
  @ApiHeader({ name: 'X-Admin-Api-Key', required: true })
  @ApiOperation({ summary: 'List creator applications (admin)' })
  @ApiResponse({ status: 200, type: CreatorApplicationResponse })
  async list(@Query('status') status?: string) {
    const data = await this.service.list(status);
    return {
      status: HttpStatus.OK,
      error: null,
      data,
    };
  }

  @Patch(':id/approve')
  @UseGuards(AdminApiKeyGuard)
  @ApiHeader({ name: 'X-Admin-Api-Key', required: true })
  @ApiOperation({
    summary: 'Approve application and create creator account (admin)',
  })
  @ApiResponse({ status: 200, type: CreatorApplicationResponse })
  async approve(@Param('id') id: string): Promise<CreatorApplicationResponse> {
    const data = await this.service.approve(id);
    return {
      status: HttpStatus.OK,
      error: null,
      data,
    };
  }

  @Patch(':id/resend-invite')
  @UseGuards(AdminApiKeyGuard)
  @ApiHeader({ name: 'X-Admin-Api-Key', required: true })
  @ApiOperation({
    summary: 'Reset temporary password and resend creator invite (admin)',
  })
  @ApiResponse({ status: 200, type: CreatorApplicationResponse })
  async resendInvite(
    @Param('id') id: string,
  ): Promise<CreatorApplicationResponse> {
    const data = await this.service.resendInvite(id);
    return {
      status: HttpStatus.OK,
      error: null,
      data,
    };
  }
}

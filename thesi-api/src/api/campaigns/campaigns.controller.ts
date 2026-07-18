import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import {
  PayCreatorDto,
  PreviewPlatformFeeDto,
  UpsertCampaignDto,
} from './dto/campaign.dto';
import { CampaignsService } from './campaigns.service';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns for the authenticated brand' })
  async list(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.campaigns.list(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('platform-fee/preview')
  @ApiOperation({ summary: 'Preview the campaign platform fee for a payment model' })
  async previewPlatformFee(@Body() dto: PreviewPlatformFeeDto) {
    const data = this.campaigns.previewPlatformFee(dto.payment);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign owned by the authenticated brand' })
  async get(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.campaigns.get(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get(':id/platform-fee')
  @ApiOperation({ summary: 'Get platform fee status for a campaign' })
  async getPlatformFee(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.campaigns.getPlatformFee(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/pay-platform-fee')
  @ApiOperation({ summary: 'Collect the campaign platform fee' })
  async payPlatformFee(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.campaigns.payPlatformFee(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get(':id/payouts')
  @ApiOperation({ summary: 'List Connect payouts for a campaign' })
  async listPayouts(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.campaigns.listCreatorPayouts(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/pay-creator')
  @ApiOperation({
    summary: 'Charge brand card and Transfer funds to a creator Express account',
  })
  async payCreator(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayCreatorDto,
  ) {
    const data = await this.campaigns.payCreator(user.sub, id, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a brand campaign' })
  async create(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpsertCampaignDto,
  ) {
    const data = await this.campaigns.create(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a brand campaign' })
  async update(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertCampaignDto,
  ) {
    const data = await this.campaigns.update(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Upload a file attachment to a campaign' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
  ) {
    const data = await this.campaigns.uploadFile(user.sub, id, file);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Get(':id/files/:fileId/download')
  @ApiOperation({ summary: 'Download a campaign file attachment' })
  async downloadFile(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.campaigns.downloadFile(user.sub, id, fileId);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    res.send(file.buffer);
  }

  @Delete(':id/files/:fileId')
  @ApiOperation({ summary: 'Delete a campaign file attachment' })
  async deleteFile(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const data = await this.campaigns.deleteFile(user.sub, id, fileId);
    return { status: HttpStatus.OK, error: null, data };
  }
}

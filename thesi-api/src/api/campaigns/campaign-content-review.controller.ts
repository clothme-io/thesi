import { workspaceResourceOwner } from '../brand-workspaces/workspace-context';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CampaignContentReviewService, MAX_REVIEW_FILE_BYTES } from './campaign-content-review.service';
import {
  CampaignContentReviewCommentDto,
  CampaignContentReviewNoteDto,
} from './dto/campaign-content-review.dto';

@ApiTags('campaign-content-review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignContentReviewController {
  constructor(private readonly reviews: CampaignContentReviewService) {}

  @Get(':id/submissions')
  @ApiOperation({ summary: 'List campaign draft submissions for review' })
  async list(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
  ) {
    const data = await this.reviews.list(actorId(user), user.role, campaignId);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions')
  @ApiOperation({ summary: 'Upload a pre-publish draft for brand review' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        deliverableLabel: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_REVIEW_FILE_BYTES },
    }),
  )
  async upload(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
    @Body() body: { title?: string; deliverableLabel?: string },
  ) {
    const data = await this.reviews.upload(
      actorId(user),
      user.role,
      campaignId,
      file,
      body,
    );
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Get(':id/submissions/:submissionId')
  @ApiOperation({ summary: 'Get a campaign draft and its review thread' })
  async get(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    const data = await this.reviews.get(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get(':id/submissions/:submissionId/media')
  @ApiOperation({ summary: 'Stream a campaign draft for in-app playback' })
  async media(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Res() res: Response,
  ) {
    const file = await this.reviews.media(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    res.send(file.buffer);
  }

  @Post(':id/submissions/:submissionId/submit')
  @ApiOperation({ summary: 'Submit a draft for brand review' })
  async submit(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    const data = await this.reviews.submit(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions/:submissionId/revisions')
  @ApiOperation({ summary: 'Replace a draft file after feedback' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_REVIEW_FILE_BYTES },
    }),
  )
  async revise(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
          size: number;
        }
      | undefined,
    @Body() body: { title?: string; comment?: string },
  ) {
    const data = await this.reviews.revise(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
      file,
      body,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions/:submissionId/approve')
  @ApiOperation({ summary: 'Approve a submitted campaign draft' })
  async approve(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: CampaignContentReviewNoteDto,
  ) {
    const data = await this.reviews.approve(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
      body.comment,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions/:submissionId/request-changes')
  @ApiOperation({ summary: 'Request changes on a submitted campaign draft' })
  async requestChanges(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: CampaignContentReviewCommentDto,
  ) {
    const data = await this.reviews.requestChanges(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
      body.comment,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions/:submissionId/reject')
  @ApiOperation({ summary: 'Reject a submitted campaign draft' })
  async reject(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: CampaignContentReviewCommentDto,
  ) {
    const data = await this.reviews.reject(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
      body.comment,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/submissions/:submissionId/comments')
  @ApiOperation({ summary: 'Add a review comment without changing status' })
  async comment(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: CampaignContentReviewCommentDto,
  ) {
    const data = await this.reviews.comment(
      actorId(user),
      user.role,
      campaignId,
      submissionId,
      body.comment,
    );
    return { status: HttpStatus.OK, error: null, data };
  }
}

function actorId(user: AuthJwtPayload) {
  return user.role === 'brand' ? workspaceResourceOwner(user.sub) : user.sub;
}

import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Put,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import {
  UpdateBrandProfileDto,
  UpdateCreatorProfileDto,
} from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated account profile' })
  async getCurrent(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.profiles.getCurrent(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put('creator')
  @ApiOperation({ summary: 'Replace the authenticated creator profile' })
  async updateCreator(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpdateCreatorProfileDto,
  ) {
    const data = await this.profiles.updateCreator(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('creator/image')
  @ApiOperation({ summary: 'Upload the authenticated creator profile image' })
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
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadCreatorImage(
    @CurrentUser() user: AuthJwtPayload,
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
    const data = await this.profiles.uploadCreatorProfileImage(user.sub, file);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put('brand')
  @ApiOperation({ summary: 'Replace the authenticated brand profile' })
  async updateBrand(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpdateBrandProfileDto,
  ) {
    const data = await this.profiles.updateBrand(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }
}

@ApiTags('profiles')
@Controller('profile-images')
export class ProfileImagesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('creators/:userId')
  @ApiOperation({ summary: 'Render a creator profile image' })
  async renderCreatorImage(
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    const image = await this.profiles.getCreatorProfileImage(userId);
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(image.buffer);
  }
}

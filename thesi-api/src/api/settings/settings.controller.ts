import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import {
  BrandSettingsDto,
  CreatorSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get settings for the authenticated account role' })
  async getCurrent(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.settings.getCurrent(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put('creator')
  @ApiOperation({ summary: 'Replace authenticated creator settings' })
  async updateCreator(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreatorSettingsDto,
  ) {
    const data = await this.settings.updateCreator(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put('brand')
  @ApiOperation({ summary: 'Replace authenticated brand settings' })
  async updateBrand(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: BrandSettingsDto,
  ) {
    const data = await this.settings.updateBrand(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }
}

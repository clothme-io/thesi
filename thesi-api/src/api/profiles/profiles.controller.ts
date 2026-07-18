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

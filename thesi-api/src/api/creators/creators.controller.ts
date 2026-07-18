import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { CreatorsService } from './creators.service';

@ApiTags('creators')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Get()
  @ApiOperation({ summary: 'List creators in the brand directory' })
  async list(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.creators.list(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorited creator ids for the brand' })
  async listFavorites(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.creators.listFavorites(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a creator directory profile' })
  async get(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.creators.get(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Favorite a creator' })
  async addFavorite(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.creators.addFavorite(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Unfavorite a creator' })
  async removeFavorite(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
  ) {
    const data = await this.creators.removeFavorite(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }
}

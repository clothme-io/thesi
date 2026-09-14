import { Body, ForbiddenException, Controller, Get, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IsString, IsUUID, Length } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { JwtAuthGuard, type AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { BrandWorkspacesService } from './brand-workspaces.service';

class CreateBrandWorkspaceDto {
  @IsString() @Length(1, 120) name!: string;
  @IsUUID() creationKey!: string;
}

@ApiTags('brand-workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('brand-workspaces')
export class BrandWorkspacesController {
  constructor(private readonly workspaces: BrandWorkspacesService) {}

  @Get()
  async list(@CurrentUser() user: AuthJwtPayload) {
    return { status: HttpStatus.OK, error: null, data: (await this.workspaces.list(user.sub,user.merchantWorkspaceId)).map(w=>({...w,canCreate:!user.merchantWorkspaceId&&w.canCreate})) };
  }

  @Post()
  async create(@CurrentUser() user: AuthJwtPayload, @Body() dto: CreateBrandWorkspaceDto) {
    if(user.merchantSessionId)throw new ForbiddenException('Create or connect another brand from Merchant Hub');
    return { status: HttpStatus.CREATED, error: null, data: await this.workspaces.create(user.sub, dto.name, dto.creationKey) };
  }
}

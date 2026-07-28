import {
  Body,
  Controller,
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
import { ApplyToListingDto, RespondToApplicationDto } from './dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get()
  @ApiOperation({ summary: 'Get marketplace listings and creator application state' })
  async getMarketplace(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.marketplace.getMarketplace(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get a marketplace listing' })
  async getListing(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.marketplace.getListing(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('listings/:id/applications')
  @ApiOperation({
    summary: 'List applications for a brand-owned marketplace listing',
  })
  async listApplications(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.marketplace.listListingApplications(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('listings/:id/applications/:applicationId/respond')
  @ApiOperation({
    summary: 'Accept or reject a marketplace application as the listing owner',
  })
  async respondToApplication(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: RespondToApplicationDto,
  ) {
    const data = await this.marketplace.respondToApplication(
      user.sub,
      id,
      applicationId,
      dto.decision,
    );
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('listings/:id/apply')
  @ApiOperation({ summary: 'Apply to a marketplace listing as a creator' })
  async apply(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyToListingDto,
  ) {
    const data = await this.marketplace.apply(
      user.sub,
      id,
      dto.pitch,
      dto.addToCrm ?? true,
    );
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('listings/:id/crm-link')
  @ApiOperation({ summary: 'Link a listing into the creator CRM without applying' })
  async linkCrm(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.marketplace.linkToCrm(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { ConnectService } from './connect.service';
import { CreateConnectAccountLinkDto } from './dto/connect.dto';

@ApiTags('connect')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connect')
export class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Stripe Connect payout onboarding status' })
  async getStatus(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.connect.getStatus(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('account-link')
  @ApiOperation({ summary: 'Create Stripe Connect Express onboarding link' })
  async createAccountLink(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateConnectAccountLinkDto,
  ) {
    const data = await this.connect.createAccountLink(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('login-link')
  @ApiOperation({ summary: 'Create Stripe Express dashboard login link' })
  async createLoginLink(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.connect.createLoginLink(user.sub);
    return { status: HttpStatus.CREATED, error: null, data };
  }
}

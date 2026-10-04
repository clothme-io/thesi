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
import { CreateSupportThreadDto, SendSupportMessageDto } from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'List support threads for the current user' })
  async list(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.support.list(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get one support thread and its messages' })
  async getThread(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.support.getThread(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('threads')
  @ApiOperation({ summary: 'Create a support thread' })
  async createThread(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateSupportThreadDto,
  ) {
    const data = await this.support.createThread(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message in a support thread' })
  async sendMessage(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: SendSupportMessageDto,
  ) {
    const data = await this.support.sendMessage(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }
}

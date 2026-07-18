import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  type AuthJwtPayload,
  JwtAuthGuard,
} from 'src/shared/auth/jwt-auth.guard';
import { CreatorCrmService } from './creator-crm.service';
import {
  CreateCrmPaymentDto,
  UpdateCrmPaymentDto,
  UpdateDealStageDto,
  UpdateTaskStatusDto,
} from './dto/creator-crm.dto';

@ApiTags('creator-crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('creator-crm')
export class CreatorCrmController {
  constructor(private readonly crm: CreatorCrmService) {}

  @Get()
  @ApiOperation({ summary: 'Get the creator CRM aggregate' })
  async getCrm(@CurrentUser() user: AuthJwtPayload) {
    const data = await this.crm.getCrm(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Patch('deals/:id/stage')
  @ApiOperation({ summary: 'Move a deal to a new pipeline stage' })
  async moveDealStage(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealStageDto,
  ) {
    const data = await this.crm.moveDealStage(user.sub, id, dto.stage);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Patch('tasks/:id')
  @ApiOperation({ summary: 'Update a CRM task status' })
  async updateTaskStatus(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    const data = await this.crm.updateTaskStatus(user.sub, id, dto.status);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('payments')
  @ApiOperation({ summary: 'Create a creator client invoice (crm_payment)' })
  async createPayment(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmPaymentDto,
  ) {
    const data = await this.crm.createPayment(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('payments/:id')
  @ApiOperation({ summary: 'Update a creator invoice / payment status' })
  async updatePayment(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmPaymentDto,
  ) {
    const data = await this.crm.updatePayment(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Get('payments/:id/pdf')
  @ApiOperation({ summary: 'Download a creator invoice PDF' })
  @Header('Content-Type', 'application/pdf')
  async downloadPaymentPdf(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { fileName, buffer } = await this.crm.getPaymentPdf(user.sub, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.send(buffer);
  }
}

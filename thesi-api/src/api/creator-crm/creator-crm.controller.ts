import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { CreatorCrmService } from './creator-crm.service';
import {
  CreateCrmBrandDto,
  CreateCrmBrandPersonDto,
  CreateCrmCalendarEventDto,
  CreateCrmContractDto,
  CreateCrmCustomFieldDto,
  CreateCrmCustomObjectDto,
  CreateCrmCustomRecordDto,
  CreateCrmDealDto,
  CreateCrmPaymentDto,
  CreateCrmTaskDto,
  CreateCrmWorkflowDto,
  ImportCrmCsvDto,
  UpdateCrmBrandPersonDto,
  UpdateCrmCustomObjectDto,
  UpdateCrmCustomRecordDto,
  UpdateCrmDealDto,
  UpdateCrmNotesDto,
  UpdateCrmPaymentDto,
  UpdateCrmWorkflowDto,
  UpdateDealStageDto,
  UpdateTaskStatusDto,
  UpsertCrmEntityFieldValuesDto,
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

  @Post('brands')
  @ApiOperation({ summary: 'Create a CRM brand' })
  async createBrand(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmBrandDto,
  ) {
    const data = await this.crm.createBrand(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import brands and deals from CSV-parsed rows' })
  async importCsv(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: ImportCrmCsvDto,
  ) {
    const data = await this.crm.importCsv(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('deals')
  @ApiOperation({ summary: 'Create a CRM deal' })
  async createDeal(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmDealDto,
  ) {
    const data = await this.crm.createDeal(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('deals/:id')
  @ApiOperation({ summary: 'Update CRM deal fields' })
  async updateDeal(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmDealDto,
  ) {
    const data = await this.crm.updateDeal(user.sub, id, dto);
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

  @Post('tasks')
  @ApiOperation({ summary: 'Create a CRM task' })
  async createTask(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmTaskDto,
  ) {
    const data = await this.crm.createTask(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
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

  @Post('brands/:id/people')
  @ApiOperation({ summary: 'Add a person to a brand' })
  async createBrandPerson(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCrmBrandPersonDto,
  ) {
    const data = await this.crm.createBrandPerson(user.sub, id, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('people/:id')
  @ApiOperation({ summary: 'Update a brand person' })
  async updateBrandPerson(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmBrandPersonDto,
  ) {
    const data = await this.crm.updateBrandPerson(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('people/:id')
  @ApiOperation({ summary: 'Delete a brand person' })
  async deleteBrandPerson(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.crm.deleteBrandPerson(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Patch('brands/:id/notes')
  @ApiOperation({ summary: 'Update brand notes' })
  async updateBrandNotes(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmNotesDto,
  ) {
    const data = await this.crm.updateBrandNotes(user.sub, id, dto.notes);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Patch('jobs/:id/notes')
  @ApiOperation({ summary: 'Update job notes' })
  async updateJobNotes(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmNotesDto,
  ) {
    const data = await this.crm.updateJobNotes(user.sub, id, dto.notes);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('calendar-events')
  @ApiOperation({ summary: 'Create a CRM calendar event' })
  async createCalendarEvent(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmCalendarEventDto,
  ) {
    const data = await this.crm.createCalendarEvent(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('contracts')
  @ApiOperation({ summary: 'Create a CRM contract (optional file upload)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        jobId: { type: 'string', format: 'uuid' },
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'signed', 'expired'],
        },
        expiresAt: { type: 'string', example: '2026-12-31' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['brandId', 'title'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async createContract(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmContractDto,
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
    const data = await this.crm.createContract(user.sub, dto, file);
    return { status: HttpStatus.CREATED, error: null, data };
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

  @Post('custom-objects')
  @ApiOperation({ summary: 'Create a custom CRM object' })
  async createCustomObject(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmCustomObjectDto,
  ) {
    const data = await this.crm.createCustomObject(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('custom-objects/:id')
  @ApiOperation({ summary: 'Update a custom CRM object' })
  async updateCustomObject(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmCustomObjectDto,
  ) {
    const data = await this.crm.updateCustomObject(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('custom-objects/:id')
  @ApiOperation({ summary: 'Delete a custom CRM object' })
  async deleteCustomObject(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.crm.deleteCustomObject(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('custom-fields')
  @ApiOperation({ summary: 'Create a custom field on brand/deal/job/object' })
  async createCustomField(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmCustomFieldDto,
  ) {
    const data = await this.crm.createCustomField(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Delete('custom-fields/:id')
  @ApiOperation({ summary: 'Delete a custom field' })
  async deleteCustomField(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.crm.deleteCustomField(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Put('entity-field-values')
  @ApiOperation({ summary: 'Upsert custom field values for a brand/deal/job' })
  async upsertEntityFieldValues(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: UpsertCrmEntityFieldValuesDto,
  ) {
    const data = await this.crm.upsertEntityFieldValues(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('custom-records')
  @ApiOperation({ summary: 'Create a custom object record' })
  async createCustomRecord(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmCustomRecordDto,
  ) {
    const data = await this.crm.createCustomRecord(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('custom-records/:id')
  @ApiOperation({ summary: 'Update a custom object record' })
  async updateCustomRecord(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmCustomRecordDto,
  ) {
    const data = await this.crm.updateCustomRecord(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('custom-records/:id')
  @ApiOperation({ summary: 'Delete a custom object record' })
  async deleteCustomRecord(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.crm.deleteCustomRecord(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create a CRM workflow rule' })
  async createWorkflow(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: CreateCrmWorkflowDto,
  ) {
    const data = await this.crm.createWorkflow(user.sub, dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Patch('workflows/:id')
  @ApiOperation({ summary: 'Update a CRM workflow rule' })
  async updateWorkflow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrmWorkflowDto,
  ) {
    const data = await this.crm.updateWorkflow(user.sub, id, dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Delete('workflows/:id')
  @ApiOperation({ summary: 'Delete a CRM workflow rule' })
  async deleteWorkflow(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.crm.deleteWorkflow(user.sub, id);
    return { status: HttpStatus.OK, error: null, data };
  }
}

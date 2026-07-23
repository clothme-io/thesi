import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

const DEAL_STAGES = [
  'lead',
  'contacted',
  'pitched',
  'negotiating',
  'contract_sent',
  'won',
  'lost',
] as const;

const CALENDAR_TYPES = [
  'shoot',
  'draft_due',
  'submission',
  'posting',
  'campaign_launch',
  'payment_due',
] as const;

const CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'expired'] as const;

export class UpdateDealStageDto {
  @ApiProperty({ enum: DEAL_STAGES })
  @IsString()
  @IsIn([...DEAL_STAGES])
  stage: (typeof DEAL_STAGES)[number];
}

export class CreateCrmDealDto {
  @ApiProperty()
  @IsUUID()
  brandId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  @ApiPropertyOptional({ enum: DEAL_STAGES, default: 'lead' })
  @IsOptional()
  @IsString()
  @IsIn([...DEAL_STAGES])
  stage?: (typeof DEAL_STAGES)[number];

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  primaryContactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class UpdateCrmDealDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  primaryContactId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ['pending', 'done'] })
  @IsString()
  @IsIn(['pending', 'done'])
  status: 'pending' | 'done';
}

export class CreateCrmTaskDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}

export class CreateCrmBrandPersonDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCrmBrandPersonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCrmNotesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  notes: string;
}

export class CreateCrmCalendarEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: CALENDAR_TYPES })
  @IsString()
  @IsIn([...CALENDAR_TYPES])
  type: (typeof CALENDAR_TYPES)[number];

  @ApiProperty({ example: '2026-08-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class CreateCrmContractDto {
  @ApiProperty()
  @IsUUID()
  brandId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ enum: CONTRACT_STATUSES, default: 'draft' })
  @IsOptional()
  @IsString()
  @IsIn([...CONTRACT_STATUSES])
  status?: (typeof CONTRACT_STATUSES)[number];

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiresAt?: string;
}

export class CreateCrmPaymentDto {
  @ApiProperty()
  @IsUUID()
  brandId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  amountCents: number;

  @ApiProperty({ example: '2026-08-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateCrmPaymentDto {
  @ApiPropertyOptional({
    enum: ['unpaid', 'invoice_sent', 'paid', 'overdue'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['unpaid', 'invoice_sent', 'paid', 'overdue'])
  status?: 'unpaid' | 'invoice_sent' | 'paid' | 'overdue';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreateCrmBrandDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @ApiPropertyOptional({
    enum: ['prospect', 'active', 'partner', 'inactive'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['prospect', 'active', 'partner', 'inactive'])
  relationshipStage?: 'prospect' | 'active' | 'partner' | 'inactive';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class ImportCrmCsvDto {
  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  brands?: Array<{
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    relationshipStage?: 'prospect' | 'active' | 'partner' | 'inactive';
    tags?: string;
    notes?: string;
  }>;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  deals?: Array<{
    brandName: string;
    title: string;
    valueCents?: number;
    stage?:
      | 'lead'
      | 'contacted'
      | 'pitched'
      | 'negotiating'
      | 'contract_sent'
      | 'won'
      | 'lost';
    expectedCloseDate?: string;
    notes?: string;
  }>;
}

const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'select',
] as const;

const FIELD_TARGETS = ['brand', 'deal', 'job', 'custom_object'] as const;

const WORKFLOW_TRIGGERS = [
  'deal_stage_changed',
  'deal_created',
  'payment_status_changed',
  'task_created',
  'custom_record_created',
] as const;

const WORKFLOW_ACTIONS = [
  'create_task',
  'create_activity',
  'set_entity_field',
] as const;

export class CreateCrmCustomObjectDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  apiName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCrmCustomObjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateCrmCustomFieldDto {
  @ApiProperty({ enum: FIELD_TARGETS })
  @IsString()
  @IsIn([...FIELD_TARGETS])
  targetType: (typeof FIELD_TARGETS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetObjectId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  apiName?: string;

  @ApiProperty({ enum: CUSTOM_FIELD_TYPES })
  @IsString()
  @IsIn([...CUSTOM_FIELD_TYPES])
  fieldType: (typeof CUSTOM_FIELD_TYPES)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpsertCrmEntityFieldValuesDto {
  @ApiProperty({ enum: ['brand', 'deal', 'job'] })
  @IsString()
  @IsIn(['brand', 'deal', 'job'])
  entityType: 'brand' | 'deal' | 'job';

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  values: Record<string, string | number | boolean | null>;
}

export class CreateCrmCustomRecordDto {
  @ApiProperty()
  @IsUUID()
  objectId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  values?: Record<string, string | number | boolean | null>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobId?: string;
}

export class UpdateCrmCustomRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  values?: Record<string, string | number | boolean | null>;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  jobId?: string;
}

export class CreateCrmWorkflowDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ enum: WORKFLOW_TRIGGERS })
  @IsString()
  @IsIn([...WORKFLOW_TRIGGERS])
  triggerType: (typeof WORKFLOW_TRIGGERS)[number];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @ApiProperty({ type: 'array' })
  actions: Array<{
    actionType: (typeof WORKFLOW_ACTIONS)[number];
    actionConfig?: Record<string, unknown>;
  }>;
}

export class UpdateCrmWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: WORKFLOW_TRIGGERS })
  @IsOptional()
  @IsString()
  @IsIn([...WORKFLOW_TRIGGERS])
  triggerType?: (typeof WORKFLOW_TRIGGERS)[number];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  actions?: Array<{
    actionType: (typeof WORKFLOW_ACTIONS)[number];
    actionConfig?: Record<string, unknown>;
  }>;
}

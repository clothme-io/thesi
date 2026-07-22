import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedCloseDate?: string;

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

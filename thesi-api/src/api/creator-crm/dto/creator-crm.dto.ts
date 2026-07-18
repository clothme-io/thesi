import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateDealStageDto {
  @ApiProperty({
    enum: [
      'lead',
      'contacted',
      'pitched',
      'negotiating',
      'contract_sent',
      'won',
      'lost',
    ],
  })
  @IsString()
  @IsIn([
    'lead',
    'contacted',
    'pitched',
    'negotiating',
    'contract_sent',
    'won',
    'lost',
  ])
  stage:
    | 'lead'
    | 'contacted'
    | 'pitched'
    | 'negotiating'
    | 'contract_sent'
    | 'won'
    | 'lost';
}

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: ['pending', 'done'] })
  @IsString()
  @IsIn(['pending', 'done'])
  status: 'pending' | 'done';
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

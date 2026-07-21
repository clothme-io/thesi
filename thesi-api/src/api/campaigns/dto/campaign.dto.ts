import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const CAMPAIGN_TYPES = [
  'tiktok',
  'instagram_reels',
  'youtube_shorts',
  'ugc_photos',
  'mixed_bundle',
  'long_form',
] as const;

/** Business goal of the campaign (separate from content format). */
export const CAMPAIGN_GOAL_TYPES = [
  'experience',
  'growth',
  'product',
  'brand_partnership',
  'community',
] as const;

export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
] as const;

export const CAMPAIGN_PAYMENT_MODELS = [
  'flat_rate',
  'milestone',
  'royalty',
  'hybrid',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CampaignRequirementsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  niches: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  minFollowersRange: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  location: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  platforms: string[];
}

export class CampaignFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  sizeLabel: string;
}

export class CampaignMilestoneDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  label: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  trigger: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  amountCents: number;
}

export class CampaignPaymentDto {
  @ApiProperty({ enum: CAMPAIGN_PAYMENT_MODELS })
  @IsIn(CAMPAIGN_PAYMENT_MODELS)
  model: (typeof CAMPAIGN_PAYMENT_MODELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  flatRateCents?: number;

  @ApiPropertyOptional({ type: [CampaignMilestoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMilestoneDto)
  milestones?: CampaignMilestoneDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  royaltyPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class PreviewPlatformFeeDto {
  @ApiProperty({ type: CampaignPaymentDto })
  @ValidateNested()
  @Type(() => CampaignPaymentDto)
  payment: CampaignPaymentDto;
}

export class PayCreatorDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  creatorUserId: string;

  @ApiPropertyOptional({
    description: 'Defaults to campaign payout cents from payment model',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
}

export class UpsertCampaignDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({
    enum: CAMPAIGN_GOAL_TYPES,
    description: 'Business goal of the campaign',
  })
  @IsIn(CAMPAIGN_GOAL_TYPES)
  campaignType: (typeof CAMPAIGN_GOAL_TYPES)[number];

  @ApiProperty({
    enum: CAMPAIGN_TYPES,
    description: 'Content format (applies to all campaign types)',
  })
  @IsIn(CAMPAIGN_TYPES)
  type: (typeof CAMPAIGN_TYPES)[number];

  @ApiProperty({ enum: CAMPAIGN_STATUSES })
  @IsIn(CAMPAIGN_STATUSES)
  status: (typeof CAMPAIGN_STATUSES)[number];

  @ApiProperty({ example: '2026-07-01' })
  @IsString()
  @Matches(DATE_PATTERN)
  startDate: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @Matches(DATE_PATTERN)
  endDate: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  brief: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  deliverables: string;

  @ApiProperty({
    type: [String],
    description: 'Optional example / reference video URLs',
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  exampleVideoLinks: string[];

  @ApiProperty({ type: CampaignRequirementsDto })
  @ValidateNested()
  @Type(() => CampaignRequirementsDto)
  requirements: CampaignRequirementsDto;

  @ApiProperty({ type: [CampaignFileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignFileDto)
  files: CampaignFileDto[];

  @ApiProperty({ type: CampaignPaymentDto })
  @ValidateNested()
  @Type(() => CampaignPaymentDto)
  payment: CampaignPaymentDto;

  @ApiProperty()
  @IsBoolean()
  postToMarketplace: boolean;
}

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
  ValidateIf,
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

export const CAMPAIGN_MILESTONE_STRUCTURES = [
  'cumulative',
  'highest_achieved',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CampaignRequirementsDto {
  @ApiProperty({ type: [String] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  niches: string[];

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(80)
  minFollowersRange: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  location: string;

  @ApiProperty({ type: [String] })
  @ValidateIf((_, value) => value !== undefined)
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
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(CAMPAIGN_PAYMENT_MODELS)
  model: (typeof CAMPAIGN_PAYMENT_MODELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  flatRateCents?: number;

  @ApiPropertyOptional({
    enum: CAMPAIGN_MILESTONE_STRUCTURES,
    description: 'How milestone amounts are calculated for payout/fee preview',
  })
  @IsOptional()
  @IsIn(CAMPAIGN_MILESTONE_STRUCTURES)
  milestoneStructure?: (typeof CAMPAIGN_MILESTONE_STRUCTURES)[number];

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

export class CampaignRequiredTaskDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty()
  @IsBoolean()
  required: boolean;
}

export class CampaignCreatorBenefitsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  guaranteedPaymentCents?: number;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  productsKept: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  bonusEligibility: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  creatorPoolEligibility: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  foundingCreatorRecognition: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  portfolioUse: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  priorityFutureCampaigns: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  brandOpportunityAccess: boolean;

  @ApiProperty({ type: [String] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  customBenefits: string[];
}

export class CampaignContentRightsDto {
  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  organicUsage: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  websiteAppUsage: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  paidAdsUsage: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  duration: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  rawContentAccess: boolean;
}

export class CampaignProductProvidedDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty()
  @IsBoolean()
  creatorKeeps: boolean;
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
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({
    enum: CAMPAIGN_GOAL_TYPES,
    description: 'Business goal of the campaign',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(CAMPAIGN_GOAL_TYPES)
  campaignType: (typeof CAMPAIGN_GOAL_TYPES)[number];

  @ApiProperty({
    enum: CAMPAIGN_TYPES,
    isArray: true,
    description: 'Content format (applies to all campaign types)',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsIn(CAMPAIGN_TYPES, { each: true })
  contentTypes: (typeof CAMPAIGN_TYPES)[number][];

  @ApiProperty({ enum: CAMPAIGN_STATUSES })
  @IsIn(CAMPAIGN_STATUSES)
  status: (typeof CAMPAIGN_STATUSES)[number];

  @ApiProperty({ example: '2026-07-01' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(DATE_PATTERN)
  startDate: string;

  @ApiProperty({ example: '2026-08-01' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(DATE_PATTERN)
  endDate: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(8000)
  brief: string;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(4000)
  deliverables: string;

  @ApiProperty({
    type: [String],
    description: 'Optional example / reference video URLs',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  exampleVideoLinks: string[];

  @ApiProperty({ type: CampaignRequirementsDto })
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => CampaignRequirementsDto)
  requirements: CampaignRequirementsDto;

  @ApiProperty({ type: [CampaignFileDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignFileDto)
  files: CampaignFileDto[];

  @ApiProperty({ type: CampaignPaymentDto })
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => CampaignPaymentDto)
  payment: CampaignPaymentDto;

  @ApiProperty({ type: [CampaignRequiredTaskDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignRequiredTaskDto)
  requiredTasks: CampaignRequiredTaskDto[];

  @ApiProperty({ type: CampaignCreatorBenefitsDto })
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => CampaignCreatorBenefitsDto)
  creatorBenefits: CampaignCreatorBenefitsDto;

  @ApiProperty({ type: CampaignContentRightsDto })
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => CampaignContentRightsDto)
  contentRights?: CampaignContentRightsDto;

  @ApiProperty({ type: [CampaignProductProvidedDto] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignProductProvidedDto)
  productsProvided: CampaignProductProvidedDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  creatorCapacity?: number;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  postToMarketplace: boolean;
}

import type { PromotedProduct } from '../campaign-products.service';
import {
  AUDIENCE_AGE_RANGES,
  AUDIENCE_GENDERS,
  AUDIENCE_LIFE_STAGES,
  AUDIENCE_WORK_ROLES,
  SHOPPER_STYLES,
  VIDEO_FACE,
  VIDEO_LENGTHS,
  VIDEO_SETTINGS,
  VIDEO_STYLES,
} from '../creative-direction';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
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
  'commission',
  'product_commission',
  'app_install',
] as const;

export const CAMPAIGN_MILESTONE_STRUCTURES = [
  'cumulative',
  'highest_achieved',
] as const;

export const CAMPAIGN_HYBRID_BASE_TRIGGERS = [
  'campaign_accepted',
  'contract_signed',
  'content_submitted',
  'content_accepted',
  'content_published',
  'campaign_completed',
  'custom',
] as const;

export const CAMPAIGN_HYBRID_METRICS = [
  'views',
  'qualified_signups',
  'account_creations',
  'fit_profiles_completed',
  'purchases',
  'sales_revenue',
  'engagement',
  'clicks',
  'custom',
] as const;

export const CAMPAIGN_HYBRID_MILESTONE_AMOUNT_TYPES = [
  'total_compensation',
  'bonus_in_addition_to_base',
] as const;

export const CAMPAIGN_HYBRID_AFFILIATE_TYPES = [
  'percentage_of_sale',
  'percentage_of_platform_commission',
  'fixed_amount_per_sale',
  'fixed_amount_per_install',
] as const;

export const CAMPAIGN_HYBRID_POOL_DISTRIBUTIONS = [
  'impact_score',
  'proportional_performance',
  'equal_distribution',
  'manual',
  'custom',
] as const;

export const CAMPAIGN_HYBRID_POOL_SETTLEMENTS = [
  'campaign_end',
  'days_after_campaign_end',
  'manual',
] as const;

export const CAMPAIGN_INSTALL_APPS = ['customer', 'vendor'] as const;

export const CAMPAIGN_CUSTOMER_INSTALL_EVENTS = [
  'verified_account',
  'fit_profile_completed',
  'first_purchase',
] as const;

export const CAMPAIGN_VENDOR_INSTALL_EVENTS = [
  'vendor_registered',
  'vendor_approved',
  'store_completed',
  'product_listed',
  'x_products_listed',
  'first_sale',
] as const;

export const CAMPAIGN_INSTALL_CONVERSION_EVENTS = [
  ...CAMPAIGN_CUSTOMER_INSTALL_EVENTS,
  ...CAMPAIGN_VENDOR_INSTALL_EVENTS,
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

export class CampaignHybridBaseDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;

  @ApiProperty({ enum: ['USD'] })
  @IsIn(['USD'])
  currency: 'USD';

  @ApiProperty({ enum: CAMPAIGN_HYBRID_BASE_TRIGGERS })
  @IsIn(CAMPAIGN_HYBRID_BASE_TRIGGERS)
  trigger: (typeof CAMPAIGN_HYBRID_BASE_TRIGGERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customTrigger?: string;
}

export class CampaignHybridMilestonesDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ enum: CAMPAIGN_HYBRID_METRICS })
  @IsIn(CAMPAIGN_HYBRID_METRICS)
  metric: (typeof CAMPAIGN_HYBRID_METRICS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  customMetric?: string;

  @ApiProperty({ enum: CAMPAIGN_MILESTONE_STRUCTURES })
  @IsIn(CAMPAIGN_MILESTONE_STRUCTURES)
  payoutMethod: (typeof CAMPAIGN_MILESTONE_STRUCTURES)[number];

  @ApiProperty({ enum: CAMPAIGN_HYBRID_MILESTONE_AMOUNT_TYPES })
  @IsIn(CAMPAIGN_HYBRID_MILESTONE_AMOUNT_TYPES)
  amountType: (typeof CAMPAIGN_HYBRID_MILESTONE_AMOUNT_TYPES)[number];

  @ApiProperty({ type: [CampaignMilestoneDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMilestoneDto)
  tiers: CampaignMilestoneDto[];
}

export class CommissionRulesDto {
  @IsIn([1]) version!: 1;
  @IsInt() @Min(0) @Max(365) reviewDays!: number;
  @IsIn(['on_approval','weekly','monthly']) payoutFrequency!: 'on_approval'|'weekly'|'monthly';
  @IsInt() @Min(0) @Max(2147483647) minimumPayoutCents!: number;
  @IsIn([0]) creatorFeeCents!: 0;
  @IsIn(['hold_until_verified']) creditPolicy!: 'hold_until_verified';
  @IsIn(['hold_until_reviewed']) selfReferralPolicy!: 'hold_until_reviewed';
}

export class CampaignInstallConversionDto {
  @ApiProperty({ enum: CAMPAIGN_INSTALL_CONVERSION_EVENTS })
  @IsIn(CAMPAIGN_INSTALL_CONVERSION_EVENTS)
  event: (typeof CAMPAIGN_INSTALL_CONVERSION_EVENTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  amountCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  listedProductCount?: number;
}

export class CampaignHybridAffiliateDto {
  @IsOptional() @ValidateNested() @Type(() => CommissionRulesDto) rules?: CommissionRulesDto;
  @ApiPropertyOptional({enum:[1]}) @IsOptional() @IsIn([1]) fundingFlowVersion?: 1;
  @ApiPropertyOptional({enum:['clothme','brand']}) @IsOptional() @IsIn(['clothme','brand']) payoutHandler?: 'clothme'|'brand';
  @ApiPropertyOptional({enum:['brand','clothme','shared_custom']}) @IsOptional() @IsIn(['brand','clothme','shared_custom']) fundingSource?: 'brand'|'clothme'|'shared_custom';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) fundingTerms?: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ enum: CAMPAIGN_HYBRID_AFFILIATE_TYPES })
  @IsIn(CAMPAIGN_HYBRID_AFFILIATE_TYPES)
  commissionType: (typeof CAMPAIGN_HYBRID_AFFILIATE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fixedAmountCents?: number;

  @ApiPropertyOptional({ enum: CAMPAIGN_INSTALL_APPS })
  @IsOptional()
  @IsIn(CAMPAIGN_INSTALL_APPS)
  installApp?: (typeof CAMPAIGN_INSTALL_APPS)[number];

  @ApiPropertyOptional({ type: [CampaignInstallConversionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => CampaignInstallConversionDto)
  conversions?: CampaignInstallConversionDto[];

  @ApiProperty({ enum: ['USD'] })
  @IsIn(['USD'])
  currency: 'USD';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionWindowDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;
}

export class CampaignHybridPoolMetricDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  weightPercent: number;
}

export class CampaignHybridCreatorPoolDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  poolAmountCents?: number;

  @ApiProperty({ enum: ['USD'] })
  @IsIn(['USD'])
  currency: 'USD';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  campaignGoal?: string;

  @ApiProperty({ enum: CAMPAIGN_HYBRID_POOL_DISTRIBUTIONS })
  @IsIn(CAMPAIGN_HYBRID_POOL_DISTRIBUTIONS)
  distributionMethod: (typeof CAMPAIGN_HYBRID_POOL_DISTRIBUTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  customDistributionMethod?: string;

  @ApiProperty({ type: [CampaignHybridPoolMetricDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignHybridPoolMetricDto)
  metrics: CampaignHybridPoolMetricDto[];

  @ApiProperty({ enum: CAMPAIGN_HYBRID_POOL_SETTLEMENTS })
  @IsIn(CAMPAIGN_HYBRID_POOL_SETTLEMENTS)
  settlementType: (typeof CAMPAIGN_HYBRID_POOL_SETTLEMENTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  settlementDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rules?: string;
}

export class CampaignHybridPaymentDto {
  @ApiPropertyOptional({ type: CampaignHybridBaseDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignHybridBaseDto)
  base?: CampaignHybridBaseDto;

  @ApiPropertyOptional({ type: CampaignHybridMilestonesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignHybridMilestonesDto)
  milestones?: CampaignHybridMilestonesDto;

  @ApiPropertyOptional({ type: CampaignHybridAffiliateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignHybridAffiliateDto)
  affiliate?: CampaignHybridAffiliateDto;

  @ApiPropertyOptional({ type: CampaignHybridCreatorPoolDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignHybridCreatorPoolDto)
  creatorPool?: CampaignHybridCreatorPoolDto;
}

export class CampaignPaymentDto {
  // Type-only server output. Do not emit an undefined class field: strict
  // whitelist validation would reject that field on every campaign request.
  declare promotedProduct?: PromotedProduct;
  declare promotedProducts?: PromotedProduct[];
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

  @ApiPropertyOptional({ type: CampaignHybridPaymentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignHybridPaymentDto)
  hybrid?: CampaignHybridPaymentDto;

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

export class CampaignAudienceDto {
  @ApiPropertyOptional({ enum: AUDIENCE_AGE_RANGES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(AUDIENCE_AGE_RANGES, { each: true })
  ageRanges?: string[];

  @ApiPropertyOptional({ enum: AUDIENCE_GENDERS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(AUDIENCE_GENDERS, { each: true })
  genders?: string[];

  @ApiPropertyOptional({ enum: AUDIENCE_LIFE_STAGES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(AUDIENCE_LIFE_STAGES, { each: true })
  lifeStages?: string[];

  @ApiPropertyOptional({ enum: AUDIENCE_WORK_ROLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(AUDIENCE_WORK_ROLES, { each: true })
  workRoles?: string[];

  @ApiPropertyOptional({ enum: SHOPPER_STYLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(SHOPPER_STYLES, { each: true })
  shopperStyles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CampaignVideoDirectionDto {
  @ApiPropertyOptional({ enum: VIDEO_STYLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(VIDEO_STYLES, { each: true })
  styles?: string[];

  @ApiPropertyOptional({ enum: VIDEO_FACE })
  @IsOptional()
  @IsIn(['', ...VIDEO_FACE])
  face?: string;

  @ApiPropertyOptional({ enum: VIDEO_SETTINGS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(VIDEO_SETTINGS, { each: true })
  settings?: string[];

  @ApiPropertyOptional({ enum: VIDEO_LENGTHS })
  @IsOptional()
  @IsIn(['', ...VIDEO_LENGTHS])
  length?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  mustInclude?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  avoid?: string[];
}

export class CampaignCreativeDirectionDto {
  @ApiPropertyOptional({ type: CampaignAudienceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignAudienceDto)
  audience?: CampaignAudienceDto;

  @ApiPropertyOptional({ type: CampaignVideoDirectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignVideoDirectionDto)
  video?: CampaignVideoDirectionDto;
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

export class MerchantProductSelectionDto {
  @IsUUID() productId!:string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID(undefined,{each:true}) variantIds?:string[];
}
export class UpsertCampaignDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({each:true}) @Type(()=>MerchantProductSelectionDto) merchantProducts?:MerchantProductSelectionDto[];
  @IsOptional() @IsUUID() merchantProductId?: string | null;
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

  @ApiPropertyOptional({
    description: 'Short campaign description for list/detail context',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

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

  @ApiPropertyOptional({
    type: CampaignCreativeDirectionDto,
    description:
      'Optional audience and video direction. Drafts and published campaigns can omit it.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignCreativeDirectionDto)
  creativeDirection?: CampaignCreativeDirectionDto;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  creatorDisclosureEnabled?: boolean;

  @ApiProperty()
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  postToMarketplace: boolean;
}

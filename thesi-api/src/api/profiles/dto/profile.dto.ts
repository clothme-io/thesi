import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CREATOR_FOLLOWER_RANGES } from '../follower-range.util';

const CREATOR_NICHES = [
  'Fashion',
  'Beauty',
  'Lifestyle',
  'Food',
  'Tech',
  'Fitness',
  'Travel',
];

const BRAND_PLATFORMS = [
  'TikTok',
  'Instagram',
  'YouTube',
  'Pinterest',
  'Snapchat',
];

const UGC_PLATFORMS = ['TikTok', 'Instagram', 'YouTube'] as const;

export class CreatorUgcPostInputDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: UGC_PLATFORMS })
  @IsIn(UGC_PLATFORMS)
  platform: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  postedAt: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  views: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  likes: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  comments?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  shares?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  saves?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  campaignName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  brandName?: string;
}

export class UpdateCreatorProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  displayName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  headline: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  bio: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  location: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  website: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  instagram: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  tiktok: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  youtube: string;

  @ApiProperty({ type: [String], enum: CREATOR_NICHES })
  @IsArray()
  @ArrayMaxSize(CREATOR_NICHES.length)
  @IsString({ each: true })
  @IsIn(CREATOR_NICHES, { each: true })
  niches: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  rateRange: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  turnaround: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  portfolioUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profileImageUrl?: string;

  @ApiProperty({ enum: ['', ...CREATOR_FOLLOWER_RANGES] })
  @IsIn(['', ...CREATOR_FOLLOWER_RANGES])
  followerRange: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  tiktokFollowers: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  instagramFollowers: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  youtubeFollowers: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  avgViews: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  avgEngagementRate: number;

  @ApiProperty({ type: [CreatorUgcPostInputDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreatorUgcPostInputDto)
  ugcPosts: CreatorUgcPostInputDto[];
}

export class UpdateBrandProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  tagline: string;

  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  about: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  website: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  headquarters: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  industry: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  instagram: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  tiktok: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  youtube: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  linkedin: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  companySize: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  typicalBudgetRange: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  primaryGoal: string;

  @ApiProperty({ type: [String], enum: CREATOR_NICHES })
  @IsArray()
  @ArrayMaxSize(CREATOR_NICHES.length)
  @IsString({ each: true })
  @IsIn(CREATOR_NICHES, { each: true })
  preferredCreatorNiches: string[];

  @ApiProperty({ type: [String], enum: BRAND_PLATFORMS })
  @IsArray()
  @ArrayMaxSize(BRAND_PLATFORMS.length)
  @IsString({ each: true })
  @IsIn(BRAND_PLATFORMS, { each: true })
  preferredPlatforms: string[];
}

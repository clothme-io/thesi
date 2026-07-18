import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';

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

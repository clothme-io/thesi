import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IErrorReturnType, ErrorReturnType } from 'src/types/ErrorReturnType';

export enum CreatorType {
  MOM_PARENT = 'mom_parent',
  STUDENT = 'student',
  FASHION_CREATOR = 'fashion_creator',
  LIFESTYLE_CREATOR = 'lifestyle_creator',
  UGC_CREATOR = 'ugc_creator',
  GEN_Z_CREATOR = 'gen_z_creator',
  OTHER = 'other',
}

export enum FollowerCountRange {
  ZERO_TO_500 = '0-500',
  FIVE_HUNDRED_TO_1K = '500-1K',
  ONE_K_TO_5K = '1K-5K',
  FIVE_K_PLUS = '5K+',
}

export enum InterestedCreatorStore {
  YES = 'yes',
  MAYBE = 'maybe',
  NO = 'no',
}

export enum InterestedAffiliate {
  YES = 'yes',
  MAYBE = 'maybe',
  NO = 'no',
}

export enum Country {
  USA = 'USA',
  CANADA = 'Canada',
}

export class CreateCreatorApplicationDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ enum: Country })
  @IsEnum(Country)
  country: Country;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ enum: CreatorType })
  @IsEnum(CreatorType)
  creatorType: CreatorType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tiktokUrl: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  instagramUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otherLinks?: string;

  @ApiProperty({ enum: FollowerCountRange })
  @IsEnum(FollowerCountRange)
  followerCountRange: FollowerCountRange;

  @ApiProperty()
  @IsBoolean()
  hasUgcExperience: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  portfolioLink: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  whyClothme: string;

  @ApiProperty({ enum: InterestedCreatorStore })
  @IsEnum(InterestedCreatorStore)
  interestedCreatorStore: InterestedCreatorStore;

  @ApiProperty({ enum: InterestedAffiliate })
  @IsEnum(InterestedAffiliate)
  interestedAffiliate: InterestedAffiliate;
}

export class CreatorApplicationData {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty({ required: false }) phoneNumber?: string | null;
  @ApiProperty() country: string;
  @ApiProperty() city: string;
  @ApiProperty() creatorType: string;
  @ApiProperty() tiktokUrl: string;
  @ApiProperty() instagramUrl: string;
  @ApiProperty({ required: false }) youtubeUrl?: string | null;
  @ApiProperty({ required: false }) otherLinks?: string | null;
  @ApiProperty() followerCountRange: string;
  @ApiProperty() hasUgcExperience: boolean;
  @ApiProperty() portfolioLink: string;
  @ApiProperty() whyClothme: string;
  @ApiProperty() interestedCreatorStore: string;
  @ApiProperty() interestedAffiliate: string;
  @ApiProperty() status: string;
  @ApiProperty({ required: false }) notes?: string | null;
  @ApiProperty() createdAt: Date | null;
  @ApiProperty() updatedAt: Date | null;
}

export class CreatorApplicationResponse {
  @ApiProperty() status: number;
  @ApiProperty({ type: ErrorReturnType, required: false }) error: IErrorReturnType | null;
  @ApiProperty({ type: CreatorApplicationData, required: false }) data: CreatorApplicationData | null;
}

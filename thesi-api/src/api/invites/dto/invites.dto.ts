import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCampaignInviteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  campaignId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  campaignName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  brandName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  creatorId?: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  creatorEmail: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  creatorName: string;

  @ApiProperty()
  @IsBoolean()
  external: boolean;
}

export class CreatePlatformBrandInviteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  brandName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  brandEmail: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  invitedBy: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  invitedByEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiProperty()
  @IsBoolean()
  addToCrm: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  crmBrandId?: string;
}

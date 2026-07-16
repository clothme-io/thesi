import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OnboardingAnswersDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  monthlyProjects?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  preferredPayment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  biggestChallenge?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hearAbout?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companySize?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  monthlyCampaigns?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryGoal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  budgetRange?: string;
}

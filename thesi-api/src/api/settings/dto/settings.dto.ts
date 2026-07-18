import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString } from 'class-validator';

export const SUPPORTED_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
] as const;

export const DATE_FORMATS = ['mdy', 'dmy', 'ymd'] as const;

export class WorkspaceSettingsDto {
  @ApiProperty({ enum: SUPPORTED_TIMEZONES })
  @IsString()
  @IsIn(SUPPORTED_TIMEZONES)
  timezone: string;

  @ApiProperty({ enum: DATE_FORMATS })
  @IsString()
  @IsIn(DATE_FORMATS)
  dateFormat: 'mdy' | 'dmy' | 'ymd';

  @ApiProperty()
  @IsBoolean()
  compactSidebar: boolean;

  @ApiProperty()
  @IsBoolean()
  emailNotifications: boolean;

  @ApiProperty()
  @IsBoolean()
  paymentReminders: boolean;

  @ApiProperty()
  @IsBoolean()
  marketingEmails: boolean;
}

export class CreatorSettingsDto extends WorkspaceSettingsDto {
  @ApiProperty()
  @IsBoolean()
  dealUpdates: boolean;

  @ApiProperty()
  @IsBoolean()
  taskReminders: boolean;
}

export class BrandSettingsDto extends WorkspaceSettingsDto {
  @ApiProperty()
  @IsBoolean()
  campaignUpdates: boolean;

  @ApiProperty()
  @IsBoolean()
  creatorApplications: boolean;

  @ApiProperty()
  @IsBoolean()
  marketplaceActivity: boolean;
}

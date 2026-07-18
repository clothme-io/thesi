import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendInboxReplyDto {
  @ApiProperty()
  @IsUUID()
  contactId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  content: string;
}

export class CreateSelfNotificationDto {
  @ApiProperty({
    enum: [
      'campaign_invite',
      'campaign_update',
      'application_received',
      'application_status',
      'platform_invite',
      'payment_reminder',
      'system',
    ],
  })
  @IsIn([
    'campaign_invite',
    'campaign_update',
    'application_received',
    'application_status',
    'platform_invite',
    'payment_reminder',
    'system',
  ])
  type:
    | 'campaign_invite'
    | 'campaign_update'
    | 'application_received'
    | 'application_status'
    | 'platform_invite'
    | 'payment_reminder'
    | 'system';

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body: string;

  @ApiProperty({ enum: ['creator', 'brand', 'all'] })
  @IsIn(['creator', 'brand', 'all'])
  audience: 'creator' | 'brand' | 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaignId?: string;
}

export class DeliverCampaignInviteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  creatorUserId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  creatorEmail: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  creatorName: string;

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

  @ApiProperty()
  @IsBoolean()
  external: boolean;
}

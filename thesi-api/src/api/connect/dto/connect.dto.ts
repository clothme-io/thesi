import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateConnectAccountLinkDto {
  @ApiPropertyOptional({
    description: 'Stripe refresh URL; defaults to creator settings',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  refreshUrl?: string;

  @ApiPropertyOptional({
    description: 'Stripe return URL; defaults to creator settings',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  returnUrl?: string;
}

export class ConnectStatusData {
  @ApiProperty()
  stripeConfigured: boolean;

  @ApiProperty({
    enum: ['not_started', 'pending', 'complete', 'unavailable'],
  })
  status: 'not_started' | 'pending' | 'complete' | 'unavailable';

  @ApiPropertyOptional()
  accountId?: string | null;

  @ApiProperty()
  detailsSubmitted: boolean;

  @ApiProperty()
  chargesEnabled: boolean;

  @ApiProperty()
  payoutsEnabled: boolean;

  @ApiProperty()
  readyForPayouts: boolean;
}

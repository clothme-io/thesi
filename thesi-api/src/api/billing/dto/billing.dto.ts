import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateBillingDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  billingEmail: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  addressLine1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  city: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  state: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  postalCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string;
}

export class SetDefaultPaymentMethodDto {
  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;
}

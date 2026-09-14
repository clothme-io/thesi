import {
  ArrayMaxSize,
  IsOptional,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CommissionEventPaymentEvidenceDto {
  @IsIn(['stripe', 'credit', 'mixed'])
  source!: 'stripe' | 'credit' | 'mixed';

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  paymentIntentIds!: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  chargeIds!: string[];

  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  capturedCents!: number;

  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  refundedCents!: number;

  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  creditCapturedCents!: number;
}
export class CommissionEventDto {
  @IsUUID() eventId!: string;
  @IsUUID() orderId!: string;
  @IsUUID() orderLineId!: string;
  @IsInt() @Min(1) @Max(2147483647) revision!: number;
  @IsUUID() receiptId!: string;
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() variantId?:string;
  @IsUUID() brandId!: string;
  @IsUUID() vendorId!: string;
  @IsISO8601({ strict: true }) purchasedAt!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) netSaleCents!: number;
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  platformFeeCents!: number | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  refundedNetCents?: number;
  @IsOptional() @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) refundedPlatformFeeCents?: number;
  @IsBoolean() fullyRefunded!: boolean;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  holdReasons!: string[];
  @IsString() @Length(1, 100) evidence!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionEventPaymentEvidenceDto)
  paymentEvidence?: CommissionEventPaymentEvidenceDto;
}

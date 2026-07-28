import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApplyToListingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  pitch: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  addToCrm?: boolean;
}

export class RespondToApplicationDto {
  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsIn(['accepted', 'rejected'])
  decision: 'accepted' | 'rejected';
}

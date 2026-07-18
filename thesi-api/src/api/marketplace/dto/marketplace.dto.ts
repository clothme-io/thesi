import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

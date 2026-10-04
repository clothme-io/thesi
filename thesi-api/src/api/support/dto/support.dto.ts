import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSupportThreadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  content: string;
}

export class SendSupportMessageDto {
  @ApiProperty()
  @IsUUID()
  threadId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  content: string;
}

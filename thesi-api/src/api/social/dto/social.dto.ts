import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength } from 'class-validator';

export class SocialContentUrlDto {
  @ApiProperty({
    description: 'TikTok, Instagram, or YouTube post URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url!: string;
}

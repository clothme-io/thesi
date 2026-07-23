import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RenameCrmWorkspaceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;
}

export class InviteCrmWorkspaceMemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ['admin', 'member', 'viewer'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'member', 'viewer'])
  role?: 'admin' | 'member' | 'viewer';
}

export class AcceptCrmWorkspaceInviteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  token: string;
}

export class ConnectCrmIntegrationDto {
  @ApiProperty({ example: 'creator@gmail.com' })
  @IsEmail()
  accountEmail: string;
}

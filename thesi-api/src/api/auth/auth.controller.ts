import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/shared/auth/jwt-auth.guard';
import type { AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth-response.dto';
import {
  ChangePasswordDto,
  RefreshTokenDto,
  SignInDto,
  SignUpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a brand account' })
  @ApiResponse({ status: 201, type: AuthResponse })
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponse> {
    const data = await this.authService.signUp(dto);
    return { status: HttpStatus.CREATED, error: null, data };
  }

  @Post('signin')
  @ApiOperation({ summary: 'Sign in' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async signIn(@Body() dto: SignInDto): Promise<AuthResponse> {
    const data = await this.authService.signIn(dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    const data = await this.authService.refresh(dto);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (required on first sign-in)' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async changePassword(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<AuthResponse> {
    const data = await this.authService.changePassword(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }
}

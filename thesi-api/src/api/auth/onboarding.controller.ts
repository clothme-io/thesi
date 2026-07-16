import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/shared/auth/jwt-auth.guard';
import type { AuthJwtPayload } from 'src/shared/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth-response.dto';
import { OnboardingAnswersDto } from './dto/onboarding.dto';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly authService: AuthService) {}

  @Post('welcome')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark welcome step complete' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async completeWelcome(@CurrentUser() user: AuthJwtPayload): Promise<AuthResponse> {
    const data = await this.authService.completeWelcome(user.sub);
    return { status: HttpStatus.OK, error: null, data };
  }

  @Post('questions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit onboarding questionnaire' })
  @ApiResponse({ status: 200, type: AuthResponse })
  async submitQuestions(
    @CurrentUser() user: AuthJwtPayload,
    @Body() dto: OnboardingAnswersDto,
  ): Promise<AuthResponse> {
    const data = await this.authService.submitOnboarding(user.sub, dto);
    return { status: HttpStatus.OK, error: null, data };
  }
}

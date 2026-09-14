import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthJwtPayload,
} from 'src/shared/auth/jwt-auth.guard';
import { CampaignFundingService } from './campaign-funding.service';
class DepositDto {
  @IsInt() @Min(1) @Max(99999999) expectedAmountCents!: number;
}
class AcceptDto {
  @IsUUID() obligationId!: string;
  @IsString() @Length(1, 2000) note!: string;
}
class RetryDto {
  @IsUUID() operationId!: string;
}
class RecoverDto extends RetryDto {
  @IsString() @Length(1, 200) providerId!: string;
  @IsString() @Length(1, 2000) reason!: string;
  @IsIn(['verify', 'retry_refund']) mode!: 'verify' | 'retry_refund';
}
@Controller('campaign-funding/:id')
@UseGuards(JwtAuthGuard)
export class CampaignFundingController {
  constructor(private readonly funding: CampaignFundingService) {}
  @Get() async status(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.funding.status(u.sub, id) };
  }
  @Post('deposit') async deposit(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositDto,
  ) {
    return {
      data: await this.funding.deposit(u.sub, id, dto.expectedAmountCents),
    };
  }
  @Post('accept-work') async accept(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptDto,
  ) {
    return {
      data: await this.funding.acceptWork(
        u.sub,
        id,
        dto.obligationId,
        dto.note,
      ),
    };
  }
  @Post('cancel-obligation') async cancel(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: AcceptDto,
  ) {
    return {
      data: await this.funding.cancelObligation(
        u.sub,
        id,
        b.obligationId,
        b.note,
      ),
    };
  }
  @Post('deposit-action') async depositAction(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.funding.depositAction(u.sub, id) };
  }
  @Post('recover') async recover(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() b: RecoverDto,
  ) {
    return {
      data: await this.funding.recover(
        u.sub,
        id,
        b.operationId,
        b.providerId,
        b.reason,
        b.mode === 'retry_refund',
      ),
    };
  }
  @Post('retry') async retry(
    @CurrentUser() u: AuthJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetryDto,
  ) {
    return { data: await this.funding.retry(u.sub, id, dto.operationId) };
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { CurrentUser } from 'src/shared/auth/current-user.decorator';
import {
  JwtAuthGuard,
  type AuthJwtPayload,
} from 'src/shared/auth/jwt-auth.guard';
import { CommissionSettlementService } from './commission-settlement.service';
class DecisionDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) expectedRevision!: number;
  @IsIn(['qualify', 'disqualify', 'reconcile']) action!:
    'qualify' | 'disqualify' | 'reconcile';
  @IsString() @Length(1, 2000) reason!: string;
}
class RiskDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) expectedRevision!: number;
  @IsIn(['hold', 'clear']) status!: 'hold' | 'clear';
  @IsIn(['suspected_self_referral', 'fraud']) kind!:
    'suspected_self_referral' | 'fraud';
  @IsString() @Length(1, 2000) reason!: string;
}
class RequestDto {
  @IsUUID() requestId!: string;
}
class OperationDto {
  @IsUUID() operationId!: string;
}
class RecoveryDto extends OperationDto {
  @IsString() @Length(1, 200) providerId!: string;
  @IsString() @Length(1, 2000) reason!: string;
}
class BatchRunDto {
  @IsUUID() batchId!: string;
  @IsString() @Length(1, 2000) reason!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  lineIds?: string[];
}
@Controller('commission-settlement-batches')
@UseGuards(JwtAuthGuard)
export class CommissionSettlementBatchController {
  constructor(private readonly settlement: CommissionSettlementService) {}
  @Get('preview') async preview(@CurrentUser() user: AuthJwtPayload) {
    return { data: await this.settlement.batchPreview(user) };
  }
  @Get(':id') async status(
    @CurrentUser() user: AuthJwtPayload,
    @Param('id') id: string,
  ) {
    return { data: await this.settlement.batchStatus(user, id) };
  }
  @Post() async run(
    @CurrentUser() user: AuthJwtPayload,
    @Body() body: BatchRunDto,
  ) {
    return { data: await this.settlement.runBatch(user, body) };
  }
}
@Controller('commission-settlement/:line')
@UseGuards(JwtAuthGuard)
export class CommissionSettlementController {
  constructor(private readonly settlement: CommissionSettlementService) {}
  @Post('risk') async risk(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
    @Body() body: RiskDto,
  ) {
    return { data: await this.settlement.reviewRisk(user, line, body) };
  }
  @Get() async preview(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
  ) {
    return { data: await this.settlement.preview(user, line) };
  }
  @Post('decide') async decide(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
    @Body() b: DecisionDto,
  ) {
    return { data: await this.settlement.decide(user, line, b) };
  }
  @Post('replay') async replay(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
    @Body() b: RequestDto,
  ) {
    return { data: await this.settlement.replay(user, line, b.requestId) };
  }
  @Post('retry') async retry(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
    @Body() b: OperationDto,
  ) {
    return { data: await this.settlement.retry(user, line, b.operationId) };
  }
  @Post('recover') async recover(
    @CurrentUser() user: AuthJwtPayload,
    @Param('line') line: string,
    @Body() b: RecoveryDto,
  ) {
    return {
      data: await this.settlement.recover(
        user,
        line,
        b.operationId,
        b.providerId,
        b.reason,
      ),
    };
  }
}

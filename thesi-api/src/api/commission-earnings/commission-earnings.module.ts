import {ConnectModule} from '../connect/connect.module';
import {CommissionSettlementService} from './commission-settlement.service';
import {
  CommissionSettlementBatchController,
  CommissionSettlementController,
} from './commission-settlement.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantServiceGuard } from '../merchant-links/merchant-links.controller';
import { CommissionEarningsService } from './commission-earnings.service';
import {
  CommissionEarningsController,
  CommissionEarningsInternalController,
  EarningsIngestionGuard,
  EarningsOperationsGuard,
  MerchantEarningsController,
} from './commission-earnings.controller';
@Module({
  imports: [AuthModule,ConnectModule],
  controllers: [
    CommissionSettlementBatchController,
    CommissionSettlementController,
    CommissionEarningsController,
    CommissionEarningsInternalController,
    MerchantEarningsController,
  ],
  providers: [
    CommissionSettlementService,
    CommissionEarningsService,
    EarningsIngestionGuard,
    EarningsOperationsGuard,
    MerchantServiceGuard,
  ],
})
export class CommissionEarningsModule {}

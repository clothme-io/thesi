import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { BILLING_REPOSITORY } from './billing.repository';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PostgresBillingRepository } from './postgres-billing.repository';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: BILLING_REPOSITORY,
      useClass: PostgresBillingRepository,
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}

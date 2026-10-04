import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { SUPPORT_REPOSITORY } from './support.repository';
import { PostgresSupportRepository } from './postgres-support.repository';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule],
  controllers: [SupportController],
  providers: [
    SupportService,
    {
      provide: SUPPORT_REPOSITORY,
      useClass: PostgresSupportRepository,
    },
  ],
})
export class SupportModule {}

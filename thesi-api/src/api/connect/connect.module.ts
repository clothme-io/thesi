import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CONNECT_REPOSITORY } from './connect.repository';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';
import { PostgresConnectRepository } from './postgres-connect.repository';

@Module({
  imports: [AuthModule],
  controllers: [ConnectController],
  providers: [
    ConnectService,
    {
      provide: CONNECT_REPOSITORY,
      useClass: PostgresConnectRepository,
    },
  ],
  exports: [ConnectService],
})
export class ConnectModule {}

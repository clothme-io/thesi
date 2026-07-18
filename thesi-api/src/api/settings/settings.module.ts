import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { PostgresSettingsRepository } from './postgres-settings.repository';
import { SETTINGS_REPOSITORY } from './settings.repository';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    {
      provide: SETTINGS_REPOSITORY,
      useClass: PostgresSettingsRepository,
    },
  ],
})
export class SettingsModule {}

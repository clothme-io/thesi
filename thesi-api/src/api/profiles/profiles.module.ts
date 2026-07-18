import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { PROFILE_REPOSITORY } from './profile.repository';
import { PostgresProfileRepository } from './postgres-profile.repository';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    {
      provide: PROFILE_REPOSITORY,
      useClass: PostgresProfileRepository,
    },
  ],
})
export class ProfilesModule {}

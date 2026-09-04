import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { FILE_STORAGE } from 'src/shared/storage/file-storage.port';
import { ConfigurableFileStorage } from 'src/shared/storage/file-storage';
import { PROFILE_REPOSITORY } from './profile.repository';
import { PostgresProfileRepository } from './postgres-profile.repository';
import {
  ProfileImagesController,
  ProfilesController,
} from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController, ProfileImagesController],
  providers: [
    ProfilesService,
    {
      provide: PROFILE_REPOSITORY,
      useClass: PostgresProfileRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: ConfigurableFileStorage,
    },
  ],
})
export class ProfilesModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CREATORS_DIRECTORY_REPOSITORY } from './creators-directory.repository';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { PostgresCreatorsDirectoryRepository } from './postgres-creators-directory.repository';

@Module({
  imports: [AuthModule],
  controllers: [CreatorsController],
  providers: [
    CreatorsService,
    {
      provide: CREATORS_DIRECTORY_REPOSITORY,
      useClass: PostgresCreatorsDirectoryRepository,
    },
  ],
})
export class CreatorsModule {}

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { EmailService } from 'src/shared/email/email.service';
import { CreateCreatorApplicationDto, CreatorApplicationData } from './dto/creator-application.dto';

@Injectable()
export class CreatorApplicationsService {
  private readonly logger = new Logger(CreatorApplicationsService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateCreatorApplicationDto): Promise<CreatorApplicationData> {
    const id = uuidv4();

    const [inserted] = await this.db
      .insert(schema.thesiCreatorApplication)
      .values({
        id,
        fullName: dto.fullName,
        email: dto.email,
        country: dto.country,
        city: dto.city,
        creatorType: dto.creatorType,
        tiktokUrl: dto.tiktokUrl,
        instagramUrl: dto.instagramUrl,
        followerCountRange: dto.followerCountRange,
        hasUgcExperience: dto.hasUgcExperience,
        portfolioLink: dto.portfolioLink,
        whyClothme: dto.whyClothme,
        interestedCreatorStore: dto.interestedCreatorStore,
        interestedAffiliate: dto.interestedAffiliate,
        phoneNumber: dto.phoneNumber ?? null,
        youtubeUrl: dto.youtubeUrl ?? null,
        otherLinks: dto.otherLinks ?? null,
        status: 'applied',
      })
      .returning();

    this.emailService
      .sendCreatorApplicationConfirmation(dto.email, dto.fullName)
      .catch((err) => this.logger.warn(`Failed to send confirmation email: ${err?.message}`));

    return inserted as CreatorApplicationData;
  }
}

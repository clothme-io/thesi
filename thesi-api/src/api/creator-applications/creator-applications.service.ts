import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from 'src/api/auth/auth.service';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { EmailService } from 'src/shared/email/email.service';
import { generateTempPassword } from 'src/shared/auth/token.util';
import {
  CreateCreatorApplicationDto,
  CreatorApplicationData,
} from './dto/creator-application.dto';

@Injectable()
export class CreatorApplicationsService {
  private readonly logger = new Logger(CreatorApplicationsService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  async create(
    dto: CreateCreatorApplicationDto,
  ): Promise<CreatorApplicationData> {
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
      .catch((err) =>
        this.logger.warn(`Failed to send confirmation email: ${err?.message}`),
      );

    return inserted as CreatorApplicationData;
  }

  async list(status?: string): Promise<CreatorApplicationData[]> {
    const rows = status
      ? await this.db
          .select()
          .from(schema.thesiCreatorApplication)
          .where(eq(schema.thesiCreatorApplication.status, status))
      : await this.db.select().from(schema.thesiCreatorApplication);

    return rows as CreatorApplicationData[];
  }

  async approve(id: string): Promise<CreatorApplicationData> {
    const tempPassword = generateTempPassword();
    const { application, alreadyApproved } = await this.db.transaction(
      async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.thesiCreatorApplication)
          .where(eq(schema.thesiCreatorApplication.id, id))
          .limit(1);

        if (!current) {
          throw new NotFoundException('Creator application not found');
        }

        if (current.status === 'approved') {
          return { application: current, alreadyApproved: true };
        }

        await this.authService.createUserFromApplication(
          {
            email: current.email,
            fullName: current.fullName,
            creatorApplicationId: current.id,
            tempPassword,
          },
          tx,
        );

        const [updated] = await tx
          .update(schema.thesiCreatorApplication)
          .set({
            status: 'approved',
            updatedAt: new Date(),
          })
          .where(eq(schema.thesiCreatorApplication.id, id))
          .returning();

        return { application: updated, alreadyApproved: false };
      },
    );

    if (alreadyApproved) {
      return application as CreatorApplicationData;
    }

    await this.sendAccountReadyOrThrow(application, tempPassword);
    return application as CreatorApplicationData;
  }

  async resendInvite(id: string): Promise<CreatorApplicationData> {
    const [application] = await this.db
      .select()
      .from(schema.thesiCreatorApplication)
      .where(eq(schema.thesiCreatorApplication.id, id))
      .limit(1);

    if (!application) {
      throw new NotFoundException('Creator application not found');
    }
    if (application.status !== 'approved') {
      throw new ConflictException(
        'Creator application must be approved before resending its invite',
      );
    }

    const tempPassword = generateTempPassword();
    await this.authService.resetCreatorTemporaryPassword(id, tempPassword);
    await this.sendAccountReadyOrThrow(application, tempPassword);

    return application as CreatorApplicationData;
  }

  private async sendAccountReadyOrThrow(
    application: typeof schema.thesiCreatorApplication.$inferSelect,
    tempPassword: string,
  ): Promise<void> {
    try {
      await this.emailService.sendCreatorAccountReady(
        application.email,
        application.fullName,
        tempPassword,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Creator account ${application.id} was created, but invite delivery failed: ${message}`,
      );
      throw new BadGatewayException(
        `Creator account was created, but invitation delivery failed. Retry PATCH /v1/creator-applications/${application.id}/resend-invite.`,
      );
    }
  }
}

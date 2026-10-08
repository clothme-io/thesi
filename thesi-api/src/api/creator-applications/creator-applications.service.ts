import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from 'src/api/auth/auth.service';
import { creatorProfileSeedFromApplication } from 'src/api/profiles/follower-range.util';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { generateTempPassword } from 'src/shared/auth/token.util';
import { NovuService } from 'src/shared/novu/novu.service';
import {
  CreateCreatorApplicationDto,
  CreatorApplicationData,
} from './dto/creator-application.dto';

type ApplicationRow = typeof schema.thesiCreatorApplication.$inferSelect;

@Injectable()
export class CreatorApplicationsService {
  private readonly logger = new Logger(CreatorApplicationsService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly novu: NovuService,
    private readonly authService: AuthService,
  ) {}

  async create(
    dto: CreateCreatorApplicationDto,
  ): Promise<CreatorApplicationData> {
    const id = uuidv4();
    const email = dto.email.trim().toLowerCase();

    let inserted: ApplicationRow;
    try {
      inserted = await this.db.transaction(async (tx) => {
        const [application] = await tx
          .insert(schema.thesiCreatorApplication)
          .values({
            id,
            fullName: dto.fullName,
            email,
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

        await this.authService.createPendingCreatorAccount(
          {
            email,
            fullName: dto.fullName,
            creatorApplicationId: id,
          },
          tx,
        );

        return application;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A user account already exists for this email',
        );
      }
      throw error;
    }

    this.novu
      .trigger({
        type: 'creator_application_received',
        toEmail: email,
        firstName: this.firstName(dto.fullName),
      })
      .catch((err: { message?: string }) =>
        this.logger.warn(`Failed to send confirmation email: ${err?.message}`),
      );

    return inserted;
  }

  async list(status?: string): Promise<CreatorApplicationData[]> {
    const rows = status
      ? await this.db
          .select()
          .from(schema.thesiCreatorApplication)
          .where(eq(schema.thesiCreatorApplication.status, status))
      : await this.db.select().from(schema.thesiCreatorApplication);

    return rows;
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
        if (current.status === 'rejected') {
          throw new ConflictException('Creator application was rejected');
        }

        const user = await this.authService.activateCreatorAccount(
          {
            email: current.email,
            fullName: current.fullName,
            creatorApplicationId: current.id,
            tempPassword,
          },
          tx,
        );
        const seed = creatorProfileSeedFromApplication(current);
        await tx
          .insert(schema.creatorProfile)
          .values({
            userId: user.id,
            displayName: seed.displayName,
            location: seed.location,
            instagram: seed.instagram,
            tiktok: seed.tiktok,
            youtube: seed.youtube,
            followerRange: seed.followerRange,
            portfolioUrl: seed.portfolioUrl,
            platforms: seed.platforms,
          })
          .onConflictDoNothing();

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
      return application;
    }

    await this.sendAccountReadyOrThrow(application, tempPassword);
    return application;
  }

  async reject(id: string): Promise<CreatorApplicationData> {
    const application = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.thesiCreatorApplication)
        .where(eq(schema.thesiCreatorApplication.id, id))
        .limit(1);

      if (!current) {
        throw new NotFoundException('Creator application not found');
      }
      if (current.status === 'approved') {
        throw new ConflictException(
          'Approved creator applications cannot be rejected',
        );
      }
      if (current.status === 'rejected') {
        return current;
      }

      await this.authService.disableCreatorAccount(current.id, tx);
      const [updated] = await tx
        .update(schema.thesiCreatorApplication)
        .set({
          status: 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(schema.thesiCreatorApplication.id, id))
        .returning();

      return updated;
    });

    return application;
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

    return application;
  }

  private async sendAccountReadyOrThrow(
    application: ApplicationRow,
    tempPassword: string,
  ): Promise<void> {
    try {
      await this.novu.trigger({
        type: 'creator_account_approved',
        toEmail: application.email,
        firstName: this.firstName(application.fullName),
        temporaryPassword: tempPassword,
      });
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

  private firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] || 'there';
  }
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && (current as { code?: string }).code === '23505') {
      return true;
    }
    current =
      'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

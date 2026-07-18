import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  CampaignInviteRecord,
  CreateCampaignInviteInput,
  CreatePlatformBrandInviteInput,
  InviteStatus,
  InviteUser,
  InvitesRepository,
  PlatformBrandInviteRecord,
} from './invites.repository';

@Injectable()
export class PostgresInvitesRepository implements InvitesRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<InviteUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findUserByEmail(email: string): Promise<InviteUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(sql`lower(${schema.thesiUser.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return user ?? null;
  }

  async findOwnedCampaign(brandUserId: string, campaignId: string) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(campaignId)) {
      return null;
    }

    const [row] = await this.db
      .select({
        id: schema.campaign.id,
        name: schema.campaign.name,
      })
      .from(schema.campaign)
      .where(
        and(
          eq(schema.campaign.id, campaignId),
          eq(schema.campaign.ownerUserId, brandUserId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listCampaignInvites(brandUserId: string, campaignId?: string) {
    const rows = await this.db
      .select()
      .from(schema.campaignInvite)
      .where(
        campaignId
          ? and(
              eq(schema.campaignInvite.brandUserId, brandUserId),
              eq(schema.campaignInvite.campaignId, campaignId),
            )
          : eq(schema.campaignInvite.brandUserId, brandUserId),
      )
      .orderBy(desc(schema.campaignInvite.sentAt));
    return rows.map((row) => this.toCampaignInvite(row));
  }

  async findCampaignInviteByEmail(campaignId: string, creatorEmail: string) {
    const [row] = await this.db
      .select()
      .from(schema.campaignInvite)
      .where(
        and(
          eq(schema.campaignInvite.campaignId, campaignId),
          sql`lower(${schema.campaignInvite.creatorEmail}) = ${creatorEmail.toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ? this.toCampaignInvite(row) : null;
  }

  async createCampaignInvite(input: CreateCampaignInviteInput) {
    const [row] = await this.db
      .insert(schema.campaignInvite)
      .values({
        campaignId: input.campaignId,
        brandUserId: input.brandUserId,
        campaignName: input.campaignName,
        brandName: input.brandName,
        creatorUserId: input.creatorUserId ?? null,
        creatorEmail: input.creatorEmail.trim().toLowerCase(),
        creatorName: input.creatorName.trim(),
        external: input.external,
        status: 'sent',
      })
      .returning();
    return this.toCampaignInvite(row);
  }

  async setCampaignInviteNovuTransactionId(
    inviteId: string,
    transactionId: string,
  ) {
    await this.db
      .update(schema.campaignInvite)
      .set({ novuTransactionId: transactionId })
      .where(eq(schema.campaignInvite.id, inviteId));
  }

  async listPlatformBrandInvites(invitedByUserId: string) {
    const rows = await this.db
      .select()
      .from(schema.platformBrandInvite)
      .where(eq(schema.platformBrandInvite.invitedByUserId, invitedByUserId))
      .orderBy(desc(schema.platformBrandInvite.sentAt));
    return rows.map((row) => this.toPlatformInvite(row));
  }

  async findPlatformBrandInviteByEmail(
    invitedByUserId: string,
    brandEmail: string,
  ) {
    const [row] = await this.db
      .select()
      .from(schema.platformBrandInvite)
      .where(
        and(
          eq(schema.platformBrandInvite.invitedByUserId, invitedByUserId),
          sql`lower(${schema.platformBrandInvite.brandEmail}) = ${brandEmail.toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ? this.toPlatformInvite(row) : null;
  }

  async createPlatformBrandInvite(input: CreatePlatformBrandInviteInput) {
    const [row] = await this.db
      .insert(schema.platformBrandInvite)
      .values({
        invitedByUserId: input.invitedByUserId,
        brandName: input.brandName.trim(),
        brandEmail: input.brandEmail.trim().toLowerCase(),
        invitedByName: input.invitedByName.trim(),
        invitedByEmail: input.invitedByEmail.trim().toLowerCase(),
        message: input.message?.trim() || null,
        addToCrm: input.addToCrm,
        crmBrandId: input.crmBrandId ?? null,
        status: 'sent',
      })
      .returning();
    return this.toPlatformInvite(row);
  }

  async setPlatformBrandInviteNovuTransactionId(
    inviteId: string,
    transactionId: string,
  ) {
    await this.db
      .update(schema.platformBrandInvite)
      .set({ novuTransactionId: transactionId })
      .where(eq(schema.platformBrandInvite.id, inviteId));
  }

  private toCampaignInvite(row: typeof schema.campaignInvite.$inferSelect) {
    return {
      id: row.id,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      brandName: row.brandName,
      ...(row.creatorUserId ? { creatorId: row.creatorUserId } : {}),
      creatorEmail: row.creatorEmail,
      creatorName: row.creatorName,
      external: row.external,
      status: row.status as InviteStatus,
      sentAt: row.sentAt.toISOString(),
    } satisfies CampaignInviteRecord;
  }

  private toPlatformInvite(row: typeof schema.platformBrandInvite.$inferSelect) {
    return {
      id: row.id,
      brandName: row.brandName,
      brandEmail: row.brandEmail,
      invitedBy: row.invitedByName,
      invitedByEmail: row.invitedByEmail,
      ...(row.message ? { message: row.message } : {}),
      addToCrm: row.addToCrm,
      ...(row.crmBrandId ? { crmBrandId: row.crmBrandId } : {}),
      status: row.status as InviteStatus,
      sentAt: row.sentAt.toISOString(),
    } satisfies PlatformBrandInviteRecord;
  }
}

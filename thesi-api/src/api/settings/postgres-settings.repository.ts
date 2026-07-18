import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  BrandSettingsDto,
  CreatorSettingsDto,
} from './dto/settings.dto';
import type {
  SettingsRepository,
  SettingsRow,
  SettingsUser,
} from './settings.repository';

@Injectable()
export class PostgresSettingsRepository implements SettingsRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<SettingsUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async get(userId: string): Promise<SettingsRow | null> {
    const [settings] = await this.db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);
    return settings ? mapSettings(settings) : null;
  }

  async upsertCreator(
    userId: string,
    settings: CreatorSettingsDto,
  ): Promise<SettingsRow> {
    const values = {
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      compactSidebar: settings.compactSidebar,
      emailNotifications: settings.emailNotifications,
      paymentReminders: settings.paymentReminders,
      marketingEmails: settings.marketingEmails,
      dealUpdates: settings.dealUpdates,
      taskReminders: settings.taskReminders,
    };
    const [saved] = await this.db
      .insert(schema.userSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return mapSettings(saved);
  }

  async upsertBrand(
    userId: string,
    settings: BrandSettingsDto,
  ): Promise<SettingsRow> {
    const values = {
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      compactSidebar: settings.compactSidebar,
      emailNotifications: settings.emailNotifications,
      paymentReminders: settings.paymentReminders,
      marketingEmails: settings.marketingEmails,
      campaignUpdates: settings.campaignUpdates,
      creatorApplications: settings.creatorApplications,
      marketplaceActivity: settings.marketplaceActivity,
    };
    const [saved] = await this.db
      .insert(schema.userSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: schema.userSettings.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return mapSettings(saved);
  }
}

function mapSettings(
  row: typeof schema.userSettings.$inferSelect,
): SettingsRow {
  return {
    timezone: row.timezone,
    dateFormat: row.dateFormat as SettingsRow['dateFormat'],
    compactSidebar: row.compactSidebar,
    emailNotifications: row.emailNotifications,
    paymentReminders: row.paymentReminders,
    marketingEmails: row.marketingEmails,
    dealUpdates: row.dealUpdates,
    taskReminders: row.taskReminders,
    campaignUpdates: row.campaignUpdates,
    creatorApplications: row.creatorApplications,
    marketplaceActivity: row.marketplaceActivity,
  };
}

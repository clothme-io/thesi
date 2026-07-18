import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BrandSettingsDto,
  CreatorSettingsDto,
} from './dto/settings.dto';
import {
  SETTINGS_REPOSITORY,
  type SettingsRepository,
  type SettingsRow,
  type SettingsUser,
} from './settings.repository';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTINGS_REPOSITORY)
    private readonly settings: SettingsRepository,
  ) {}

  async getCurrent(
    userId: string,
  ): Promise<CreatorSettingsDto | BrandSettingsDto> {
    const user = await this.requireUser(userId);
    const row = (await this.settings.get(userId)) ?? defaultSettings();
    if (user.role === 'creator') return creatorSettings(row);
    if (user.role === 'brand') return brandSettings(row);
    throw new ForbiddenException('This account does not have workspace settings');
  }

  async updateCreator(
    userId: string,
    dto: CreatorSettingsDto,
  ): Promise<CreatorSettingsDto> {
    const user = await this.requireUser(userId);
    this.requireRole(user, 'creator');
    return creatorSettings(await this.settings.upsertCreator(userId, dto));
  }

  async updateBrand(
    userId: string,
    dto: BrandSettingsDto,
  ): Promise<BrandSettingsDto> {
    const user = await this.requireUser(userId);
    this.requireRole(user, 'brand');
    return brandSettings(await this.settings.upsertBrand(userId, dto));
  }

  private async requireUser(userId: string): Promise<SettingsUser> {
    const user = await this.settings.getUser(userId);
    if (!user) throw new NotFoundException('User account not found');
    return user;
  }

  private requireRole(user: SettingsUser, role: 'creator' | 'brand'): void {
    if (user.role !== role) {
      throw new ForbiddenException(
        `${role === 'creator' ? 'Creator' : 'Brand'} settings access required`,
      );
    }
  }
}

function defaultSettings(): SettingsRow {
  return {
    timezone: 'America/Los_Angeles',
    dateFormat: 'mdy',
    compactSidebar: false,
    emailNotifications: true,
    paymentReminders: true,
    marketingEmails: false,
    dealUpdates: true,
    taskReminders: true,
    campaignUpdates: true,
    creatorApplications: true,
    marketplaceActivity: true,
  };
}

function creatorSettings(row: SettingsRow): CreatorSettingsDto {
  return {
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    compactSidebar: row.compactSidebar,
    emailNotifications: row.emailNotifications,
    paymentReminders: row.paymentReminders,
    marketingEmails: row.marketingEmails,
    dealUpdates: row.dealUpdates,
    taskReminders: row.taskReminders,
  };
}

function brandSettings(row: SettingsRow): BrandSettingsDto {
  return {
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    compactSidebar: row.compactSidebar,
    emailNotifications: row.emailNotifications,
    paymentReminders: row.paymentReminders,
    marketingEmails: row.marketingEmails,
    campaignUpdates: row.campaignUpdates,
    creatorApplications: row.creatorApplications,
    marketplaceActivity: row.marketplaceActivity,
  };
}

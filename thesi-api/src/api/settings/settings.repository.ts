import type {
  BrandSettingsDto,
  CreatorSettingsDto,
} from './dto/settings.dto';

export const SETTINGS_REPOSITORY = Symbol('SETTINGS_REPOSITORY');

export type SettingsUser = {
  id: string;
  role: string;
};

export type SettingsRow = {
  timezone: string;
  dateFormat: 'mdy' | 'dmy' | 'ymd';
  compactSidebar: boolean;
  emailNotifications: boolean;
  paymentReminders: boolean;
  marketingEmails: boolean;
  dealUpdates: boolean;
  taskReminders: boolean;
  campaignUpdates: boolean;
  creatorApplications: boolean;
  marketplaceActivity: boolean;
};

export interface SettingsRepository {
  getUser(userId: string): Promise<SettingsUser | null>;
  get(userId: string): Promise<SettingsRow | null>;
  upsertCreator(
    userId: string,
    settings: CreatorSettingsDto,
  ): Promise<SettingsRow>;
  upsertBrand(userId: string, settings: BrandSettingsDto): Promise<SettingsRow>;
}

import type { WorkspacePreferences } from "./shared-types";
import { DEFAULT_WORKSPACE_PREFERENCES } from "./shared-types";

export interface BrandSettings extends WorkspacePreferences {
  emailNotifications: boolean;
  campaignUpdates: boolean;
  creatorApplications: boolean;
  paymentReminders: boolean;
  marketplaceActivity: boolean;
  marketingEmails: boolean;
}

export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  emailNotifications: true,
  campaignUpdates: true,
  creatorApplications: true,
  paymentReminders: true,
  marketplaceActivity: true,
  marketingEmails: false,
  ...DEFAULT_WORKSPACE_PREFERENCES,
};

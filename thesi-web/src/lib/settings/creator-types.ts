import type { DateFormat, WorkspacePreferences } from "./shared-types";
import { DEFAULT_WORKSPACE_PREFERENCES } from "./shared-types";

export interface CreatorSettings extends WorkspacePreferences {
  emailNotifications: boolean;
  dealUpdates: boolean;
  paymentReminders: boolean;
  taskReminders: boolean;
  marketingEmails: boolean;
}

export const DEFAULT_CREATOR_SETTINGS: CreatorSettings = {
  emailNotifications: true,
  dealUpdates: true,
  paymentReminders: true,
  taskReminders: true,
  marketingEmails: false,
  ...DEFAULT_WORKSPACE_PREFERENCES,
};

export type { DateFormat };

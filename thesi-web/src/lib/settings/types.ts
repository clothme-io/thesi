export interface AppSettings {
  emailNotifications: boolean;
  dealUpdates: boolean;
  paymentReminders: boolean;
  taskReminders: boolean;
  marketingEmails: boolean;
  timezone: string;
  dateFormat: "mdy" | "dmy" | "ymd";
  compactSidebar: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  emailNotifications: true,
  dealUpdates: true,
  paymentReminders: true,
  taskReminders: true,
  marketingEmails: false,
  timezone: "America/Los_Angeles",
  dateFormat: "mdy",
  compactSidebar: false,
};

export const TIMEZONE_OPTIONS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

export const DATE_FORMAT_OPTIONS: { value: AppSettings["dateFormat"]; label: string }[] = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "ymd", label: "YYYY-MM-DD" },
];

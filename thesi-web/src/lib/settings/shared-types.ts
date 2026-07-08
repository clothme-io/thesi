export const TIMEZONE_OPTIONS = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

export type DateFormat = "mdy" | "dmy" | "ymd";

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "ymd", label: "YYYY-MM-DD" },
];

export interface WorkspacePreferences {
  timezone: string;
  dateFormat: DateFormat;
  compactSidebar: boolean;
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  timezone: "America/Los_Angeles",
  dateFormat: "mdy",
  compactSidebar: false,
};

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspaceMemberStatus = "active" | "invited" | "removed";
export type IntegrationProvider =
  | "gmail"
  | "google_calendar"
  | "microsoft_mail"
  | "microsoft_calendar";
export type IntegrationStatus =
  | "disconnected"
  | "connected"
  | "error"
  | "stub";

export type CrmWorkspace = {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmWorkspaceMember = {
  id: string;
  workspaceId: string;
  userId?: string;
  email: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  inviteToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmIntegrationConnection = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  accountEmail: string;
  status: IntegrationStatus;
  scopes: string[];
  lastSyncAt?: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmSyncedEmail = {
  id: string;
  connectionId: string;
  direction: "inbound" | "outbound";
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet: string;
  sentAt: string;
  brandId?: string;
};

export type CrmSyncedCalendarEvent = {
  id: string;
  connectionId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location: string;
  brandId?: string;
  jobId?: string;
};

export type CrmCollabSnapshot = {
  workspace: CrmWorkspace;
  members: CrmWorkspaceMember[];
  connections: CrmIntegrationConnection[];
  syncedEmails: CrmSyncedEmail[];
  syncedCalendarEvents: CrmSyncedCalendarEvent[];
};

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> =
  {
    gmail: "Gmail",
    google_calendar: "Google Calendar",
    microsoft_mail: "Microsoft Outlook",
    microsoft_calendar: "Microsoft Calendar",
  };

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

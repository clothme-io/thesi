export interface InboxContact {
  id: string;
  brandId?: string;
  name: string;
  email: string;
  company?: string;
}

export type InboxMessageKind = "message" | "invite";

export interface InboxMessage {
  id: string;
  contactId: string;
  subject: string;
  content: string;
  createdAt: string;
  read: boolean;
  isFromMe: boolean;
  kind?: InboxMessageKind;
  campaignId?: string;
}

export interface InboxData {
  contacts: InboxContact[];
  messages: InboxMessage[];
  notifications: InboxNotification[];
}

export type InboxNotificationType =
  | "campaign_invite"
  | "campaign_update"
  | "application_received"
  | "application_status"
  | "platform_invite"
  | "payment_reminder"
  | "system";

export type InboxNotificationAudience = "creator" | "brand" | "all";

export interface InboxNotification {
  id: string;
  type: InboxNotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
  campaignId?: string;
  audience: InboxNotificationAudience;
}

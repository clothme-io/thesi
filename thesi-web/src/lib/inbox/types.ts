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
}

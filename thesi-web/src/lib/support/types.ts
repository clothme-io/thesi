export type SupportThreadStatus = "open" | "pending" | "closed";

export interface SupportThread {
  id: string;
  userId: string;
  subject: string;
  status: SupportThreadStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  unreadCount: number;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  senderUserId?: string | null;
  senderType: "user" | "support";
  content: string;
  createdAt: string;
}

export interface SupportListData {
  threads: SupportThread[];
}

export interface SupportThreadData {
  thread: SupportThread;
  messages: SupportMessage[];
}

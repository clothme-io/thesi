"use client";

import { useCallback, useEffect, useState } from "react";
import type { InboxData, InboxMessage, InboxNotification, InboxNotificationAudience } from "./types";
import { SEED_INBOX_DATA } from "./seed";

const STORAGE_KEY = "thesi_inbox";

function normalizeInboxData(raw: Partial<InboxData>): InboxData {
  return {
    contacts: raw.contacts ?? SEED_INBOX_DATA.contacts,
    messages: raw.messages ?? SEED_INBOX_DATA.messages,
    notifications: raw.notifications ?? SEED_INBOX_DATA.notifications,
  };
}

export function loadInboxData(): InboxData {
  if (typeof window === "undefined") return SEED_INBOX_DATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INBOX_DATA));
    return SEED_INBOX_DATA;
  }
  try {
    return normalizeInboxData(JSON.parse(raw) as Partial<InboxData>);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INBOX_DATA));
    return SEED_INBOX_DATA;
  }
}

export function saveInboxData(data: InboxData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useInbox() {
  const [data, setData] = useState<InboxData>(SEED_INBOX_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadInboxData());
    setReady(true);
  }, []);

  const persist = useCallback((next: InboxData) => {
    setData(next);
    saveInboxData(next);
  }, []);

  return { data, ready, persist };
}

export function getMessagesForContact(data: InboxData, contactId: string) {
  return data.messages
    .filter((m) => m.contactId === contactId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getUnreadCount(data: InboxData, contactId: string) {
  return data.messages.filter((m) => m.contactId === contactId && !m.read && !m.isFromMe).length;
}

export function getNotificationsForRole(
  data: InboxData,
  role: "creator" | "brand",
): InboxNotification[] {
  return data.notifications
    .filter((n) => n.audience === role || n.audience === "all")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadNotificationCount(data: InboxData, role: "creator" | "brand"): number {
  return getNotificationsForRole(data, role).filter((n) => !n.read).length;
}

export function markContactMessagesRead(data: InboxData, contactId: string): InboxData {
  return {
    ...data,
    messages: data.messages.map((m) =>
      m.contactId === contactId && !m.isFromMe ? { ...m, read: true } : m,
    ),
  };
}

export function markNotificationRead(data: InboxData, notificationId: string): InboxData {
  return {
    ...data,
    notifications: data.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    ),
  };
}

export function markAllNotificationsRead(data: InboxData, role: "creator" | "brand"): InboxData {
  const visible = new Set(getNotificationsForRole(data, role).map((n) => n.id));
  return {
    ...data,
    notifications: data.notifications.map((n) =>
      visible.has(n.id) ? { ...n, read: true } : n,
    ),
  };
}

export function addInboxNotification(
  input: Omit<InboxNotification, "id" | "createdAt" | "read"> & { read?: boolean },
): InboxNotification {
  const notification: InboxNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
    ...input,
  };
  const data = loadInboxData();
  saveInboxData({ ...data, notifications: [notification, ...data.notifications] });
  return notification;
}

export function addReply(
  data: InboxData,
  contactId: string,
  subject: string,
  content: string,
): InboxData {
  const message: InboxMessage = {
    id: `msg-${Date.now()}`,
    contactId,
    subject,
    content,
    createdAt: new Date().toISOString(),
    read: true,
    isFromMe: true,
  };
  return { ...data, messages: [...data.messages, message] };
}

export function deleteMessage(data: InboxData, messageId: string): InboxData {
  return {
    ...data,
    messages: data.messages.filter((m) => m.id !== messageId),
  };
}

export function formatMessageDateTime(iso: string) {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function formatNotificationAudience(role: InboxNotificationAudience): string {
  if (role === "all") return "All";
  return role === "brand" ? "Brand" : "Creator";
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  InboxData,
  InboxMessage,
  InboxNotification,
  InboxNotificationAudience,
} from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: InboxData = {
  contacts: [],
  messages: [],
  notifications: [],
};

export function useInbox(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<InboxData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<InboxData>("/api/inbox");
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<InboxData>("/api/inbox")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load inbox",
          );
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const markContactRead = useCallback(
    async (contactId: string) => {
      await authenticatedRequest(`/api/inbox/contacts/${contactId}/read`, {
        method: "POST",
        body: {},
      });
      setData((prev) => ({
        ...prev,
        messages: prev.messages.map((message) =>
          message.contactId === contactId && !message.isFromMe
            ? { ...message, read: true }
            : message,
        ),
      }));
    },
    [authenticatedRequest],
  );

  const sendReply = useCallback(
    async (contactId: string, subject: string, content: string) => {
      const message = await authenticatedRequest<InboxMessage>("/api/inbox/messages", {
        method: "POST",
        body: { contactId, subject, content },
      });
      setData((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
      }));
      return message;
    },
    [authenticatedRequest],
  );

  const removeMessage = useCallback(
    async (messageId: string) => {
      await authenticatedRequest(`/api/inbox/messages/${messageId}`, {
        method: "DELETE",
      });
      setData((prev) => ({
        ...prev,
        messages: prev.messages.filter((message) => message.id !== messageId),
      }));
    },
    [authenticatedRequest],
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await authenticatedRequest(`/api/inbox/notifications/${notificationId}/read`, {
        method: "POST",
        body: {},
      });
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      }));
    },
    [authenticatedRequest],
  );

  const markAllNotificationsRead = useCallback(async () => {
    await authenticatedRequest("/api/inbox/notifications/read-all", {
      method: "POST",
      body: {},
    });
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    }));
  }, [authenticatedRequest]);

  return {
    data,
    ready,
    error,
    reload,
    markContactRead,
    sendReply,
    removeMessage,
    markNotificationRead,
    markAllNotificationsRead,
  };
}

export async function addInboxNotification(
  authenticatedRequest: AuthenticatedRequest,
  input: Omit<InboxNotification, "id" | "createdAt" | "read"> & { read?: boolean },
): Promise<InboxNotification> {
  return authenticatedRequest<InboxNotification>("/api/inbox/notifications", {
    method: "POST",
    body: {
      type: input.type,
      title: input.title,
      body: input.body,
      audience: input.audience,
      href: input.href,
      campaignId: input.campaignId,
    },
  });
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

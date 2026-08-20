"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import {
  useInbox,
  getMessagesForContact,
  getUnreadCount,
  getNotificationsForRole,
  getUnreadNotificationCount,
  formatMessageDateTime,
} from "@/lib/inbox/storage";
import type { InboxMessage } from "@/lib/inbox/types";
import {
  getReceivedCampaignInvite,
  respondToCampaignInvite,
} from "@/lib/invites/respond-campaign-invite";
import { INVITE_STATUS_LABELS } from "@/lib/invites/status-labels";
import type { InviteStatus } from "@/lib/invites/types";

type InboxTab = "messages" | "notifications";

function replySubject(subject: string) {
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  campaign_invite: "Campaign invite",
  campaign_update: "Campaign update",
  application_received: "Application",
  application_status: "Application status",
  platform_invite: "Platform invite",
  payment_reminder: "Payment",
  system: "System",
};

export function InboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, authenticatedRequest } = useAuth();
  const role = session?.user.role === "brand" ? "brand" : "creator";
  const {
    data,
    ready,
    error,
    markContactRead,
    sendReply,
    removeMessage,
    markNotificationRead,
    markAllNotificationsRead,
    reload,
  } = useInbox(authenticatedRequest);
  const [tab, setTab] = useState<InboxTab>("messages");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [replySubjectValue, setReplySubjectValue] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteStatuses, setInviteStatuses] = useState<
    Record<string, InviteStatus>
  >({});
  const [respondingCampaignId, setRespondingCampaignId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const brandId = searchParams.get("brand");
    if (!brandId || !ready) return;
    const contact = data.contacts.find((c) => c.brandId === brandId);
    if (contact) {
      setTab("messages");
      setSelectedContactId(contact.id);
    }
  }, [searchParams, ready, data.contacts]);

  useEffect(() => {
    if (searchParams.get("tab") === "notifications") {
      setTab("notifications");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!ready || role !== "creator") return;
    const campaignIds = [
      ...new Set(
        data.messages
          .filter((message) => message.kind === "invite" && message.campaignId)
          .map((message) => message.campaignId as string),
      ),
    ];
    if (campaignIds.length === 0) return;

    let active = true;
    void (async () => {
      const next: Record<string, InviteStatus> = {};
      await Promise.all(
        campaignIds.map(async (campaignId) => {
          try {
            const invite = await getReceivedCampaignInvite(
              authenticatedRequest,
              campaignId,
            );
            if (invite) next[campaignId] = invite.status;
          } catch {
            // Ignore individual status failures; buttons stay available.
          }
        }),
      );
      if (active) {
        setInviteStatuses((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      active = false;
    };
  }, [authenticatedRequest, data.messages, ready, role]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.contacts;
    return data.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.company?.toLowerCase().includes(query) ?? false),
    );
  }, [data.contacts, search]);

  const notifications = useMemo(() => getNotificationsForRole(data, role), [data, role]);

  const selectedContact = data.contacts.find((c) => c.id === selectedContactId);
  const messages = selectedContactId ? getMessagesForContact(data, selectedContactId) : [];

  const selectContact = async (contactId: string) => {
    setSelectedContactId(contactId);
    setReplySubjectValue("");
    setReplyContent("");
    setActionError("");
    try {
      await markContactRead(contactId);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not mark conversation read",
      );
    }
  };

  const handleReplyTo = (message: InboxMessage) => {
    setReplySubjectValue(replySubject(message.subject));
    setReplyContent("");
  };

  const handleInviteDecision = async (
    campaignId: string,
    decision: Exclude<InviteStatus, "sent">,
  ) => {
    setRespondingCampaignId(campaignId);
    setActionError("");
    try {
      const invite = await respondToCampaignInvite(
        authenticatedRequest,
        campaignId,
        decision,
      );
      setInviteStatuses((prev) => ({ ...prev, [campaignId]: invite.status }));
      await reload();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update invite",
      );
    } finally {
      setRespondingCampaignId(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !replyContent.trim()) return;
    setSending(true);
    setActionError("");
    const subject = replySubjectValue.trim() || "Re: Message";
    try {
      await sendReply(selectedContactId, subject, replyContent.trim());
      setReplySubjectValue("");
      setReplyContent("");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not send reply",
      );
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    setActionError("");
    try {
      await removeMessage(messageId);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete message",
      );
    }
  };

  const handleNotificationClick = async (notificationId: string, href?: string) => {
    setActionError("");
    try {
      await markNotificationRead(notificationId);
      if (href) router.push(href);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update notification",
      );
    }
  };

  if (!ready) return null;

  const totalUnread = data.contacts.reduce((sum, c) => sum + getUnreadCount(data, c.id), 0);
  const notificationUnread = getUnreadNotificationCount(data, role);

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Inbox</h1>
          <span className="workspace-subtitle">
            {tab === "messages"
              ? totalUnread > 0
                ? `${totalUnread} unread messages`
                : "All caught up"
              : notificationUnread > 0
                ? `${notificationUnread} unread notifications`
                : "No new notifications"}
          </span>
        </div>
        {tab === "notifications" && notificationUnread > 0 && (
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={async () => {
              setActionError("");
              try {
                await markAllNotificationsRead();
              } catch (requestError) {
                setActionError(
                  requestError instanceof Error
                    ? requestError.message
                    : "Could not mark notifications read",
                );
              }
            }}
          >
            Mark all read
          </button>
        )}
      </header>

      <div className="app-content app-content--flush">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ padding: "12px 16px 0" }}>
            {actionError || error}
          </p>
        )}
        <div className="inbox-tabs">
          <button
            type="button"
            className={tab === "messages" ? "inbox-tab inbox-tab--active" : "inbox-tab"}
            onClick={() => setTab("messages")}
          >
            Messages
            {totalUnread > 0 && <span className="inbox-tab-badge">{totalUnread}</span>}
          </button>
          <button
            type="button"
            className={tab === "notifications" ? "inbox-tab inbox-tab--active" : "inbox-tab"}
            onClick={() => setTab("notifications")}
          >
            Notifications
            {notificationUnread > 0 && <span className="inbox-tab-badge">{notificationUnread}</span>}
          </button>
        </div>

        {tab === "messages" ? (
          <div className="inbox-layout">
            <aside className="inbox-contacts">
              <div className="inbox-contacts-header">
                <input
                  type="search"
                  className="inbox-search"
                  placeholder="Search contacts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ul className="inbox-contact-list">
                {filteredContacts.map((contact) => {
                  const unread = getUnreadCount(data, contact.id);
                  const lastMessage = getMessagesForContact(data, contact.id).at(-1);
                  const isActive = contact.id === selectedContactId;
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className={`inbox-contact ${isActive ? "inbox-contact--active" : ""}`}
                        onClick={() => selectContact(contact.id)}
                      >
                        <span className="inbox-avatar" aria-hidden="true">
                          {contact.name
                            .split(" ")
                            .slice(0, 2)
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="inbox-contact-body">
                          <span className="inbox-contact-top">
                            <strong>{contact.name}</strong>
                            {unread > 0 && <span className="inbox-badge">{unread}</span>}
                          </span>
                          <span className="inbox-contact-company">{contact.company}</span>
                          {lastMessage && (
                            <span className="inbox-contact-preview">{lastMessage.subject}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <section className="inbox-thread">
              {!selectedContact ? (
                <div className="inbox-empty">
                  <h2>Select a contact</h2>
                  <p>Choose a contact to view messages and reply.</p>
                </div>
              ) : (
                <>
                  <header className="inbox-thread-header">
                    <div>
                      <h2>{selectedContact.name}</h2>
                      <p>
                        {selectedContact.company} · {selectedContact.email}
                      </p>
                    </div>
                  </header>

                  <div className="inbox-messages">
                    {messages.length === 0 ? (
                      <p className="inbox-empty-thread">No messages yet. Send a reply below.</p>
                    ) : (
                      messages.map((message) => {
                        const { date, time } = formatMessageDateTime(message.createdAt);
                        const isUnread = !message.read && !message.isFromMe;
                        return (
                          <article
                            key={message.id}
                            className={`inbox-message inbox-message--full ${isUnread ? "inbox-message--unread" : "inbox-message--read"} ${message.isFromMe ? "inbox-message--mine" : ""}`}
                          >
                            <div className="inbox-message-meta">
                              <span>{date}</span>
                              <span>{time}</span>
                              {message.kind === "invite" && (
                                <span className="crm-tag">Campaign invite</span>
                              )}
                              {message.isFromMe && <span className="inbox-message-tag">You</span>}
                            </div>
                            <h3 className="inbox-message-subject">{message.subject}</h3>
                            <p className="inbox-message-content">{message.content}</p>
                            <div className="inbox-message-actions">
                              {role === "creator" &&
                                message.kind === "invite" &&
                                message.campaignId &&
                                !message.isFromMe && (
                                  <>
                                    {inviteStatuses[message.campaignId] &&
                                    inviteStatuses[message.campaignId] !==
                                      "sent" ? (
                                      <span className="crm-tag">
                                        {
                                          INVITE_STATUS_LABELS[
                                            inviteStatuses[message.campaignId]
                                          ]
                                        }
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="inbox-btn-text"
                                          disabled={
                                            respondingCampaignId ===
                                            message.campaignId
                                          }
                                          onClick={() =>
                                            void handleInviteDecision(
                                              message.campaignId!,
                                              "accepted",
                                            )
                                          }
                                        >
                                          {respondingCampaignId ===
                                          message.campaignId
                                            ? "Working…"
                                            : "Accept"}
                                        </button>
                                        <button
                                          type="button"
                                          className="inbox-btn-text inbox-btn-text--danger"
                                          disabled={
                                            respondingCampaignId ===
                                            message.campaignId
                                          }
                                          onClick={() =>
                                            void handleInviteDecision(
                                              message.campaignId!,
                                              "declined",
                                            )
                                          }
                                        >
                                          Decline
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              <button
                                type="button"
                                className="inbox-btn-text"
                                onClick={() => handleReplyTo(message)}
                              >
                                Reply
                              </button>
                              <button
                                type="button"
                                className="inbox-btn-text inbox-btn-text--danger"
                                onClick={() => handleDelete(message.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>

                  <form className="inbox-reply" onSubmit={handleSendReply}>
                    <label className="inbox-field">
                      <span>Subject</span>
                      <input
                        type="text"
                        value={replySubjectValue}
                        onChange={(e) => setReplySubjectValue(e.target.value)}
                        placeholder={`Re: ${selectedContact.company} thread`}
                      />
                    </label>
                    <label className="inbox-field">
                      <span>Message</span>
                      <textarea
                        rows={4}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply…"
                        required
                      />
                    </label>
                    <div className="inbox-reply-footer">
                      <button type="submit" className="crm-btn-primary" disabled={sending}>
                        {sending ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        ) : (
          <div className="inbox-notifications">
            {notifications.length === 0 ? (
              <div className="inbox-empty">
                <h2>No notifications</h2>
                <p>Campaign updates, invites, and application alerts will appear here.</p>
              </div>
            ) : (
              <ul className="inbox-notification-list">
                {notifications.map((notification) => {
                  const { date, time } = formatMessageDateTime(notification.createdAt);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        className={`inbox-notification ${notification.read ? "inbox-notification--read" : "inbox-notification--unread"}`}
                        onClick={() => handleNotificationClick(notification.id, notification.href)}
                      >
                        <div className="inbox-notification-top">
                          <span className="crm-tag">
                            {NOTIFICATION_TYPE_LABELS[notification.type] ?? notification.type}
                          </span>
                          <span className="inbox-notification-time">
                            {date} · {time}
                          </span>
                        </div>
                        <strong>{notification.title}</strong>
                        <p>{notification.body}</p>
                        {notification.href && (
                          <span className="inbox-notification-link">View details →</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

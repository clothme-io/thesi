"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useInbox,
  getMessagesForContact,
  getUnreadCount,
  markContactMessagesRead,
  addReply,
  deleteMessage,
  formatMessageDateTime,
} from "@/lib/inbox/storage";
import type { InboxMessage } from "@/lib/inbox/types";

function replySubject(subject: string) {
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

export function InboxPageContent() {
  const searchParams = useSearchParams();
  const { data, ready, persist } = useInbox();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [replySubjectValue, setReplySubjectValue] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const brandId = searchParams.get("brand");
    if (!brandId || !ready) return;
    const contact = data.contacts.find((c) => c.brandId === brandId);
    if (contact) setSelectedContactId(contact.id);
  }, [searchParams, ready, data.contacts]);

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

  const selectedContact = data.contacts.find((c) => c.id === selectedContactId);
  const messages = selectedContactId ? getMessagesForContact(data, selectedContactId) : [];

  const selectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    setReplySubjectValue("");
    setReplyContent("");
    persist(markContactMessagesRead(data, contactId));
  };

  const handleReplyTo = (message: InboxMessage) => {
    setReplySubjectValue(replySubject(message.subject));
    setReplyContent("");
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !replyContent.trim()) return;
    const subject = replySubjectValue.trim() || "Re: Message";
    persist(addReply(data, selectedContactId, subject, replyContent.trim()));
    setReplySubjectValue("");
    setReplyContent("");
  };

  const handleDelete = (messageId: string) => {
    persist(deleteMessage(data, messageId));
  };

  if (!ready) return null;

  const totalUnread = data.contacts.reduce((sum, c) => sum + getUnreadCount(data, c.id), 0);

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Inbox</h1>
          <span className="workspace-subtitle">
            {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
          </span>
        </div>
      </header>

      <div className="app-content app-content--flush">
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
                          className={`inbox-message ${isUnread ? "inbox-message--unread" : "inbox-message--read"} ${message.isFromMe ? "inbox-message--mine" : ""}`}
                        >
                          <div className="inbox-message-meta">
                            <span>{date}</span>
                            <span>{time}</span>
                            {message.isFromMe && <span className="inbox-message-tag">You</span>}
                          </div>
                          <h3 className="inbox-message-subject">{message.subject}</h3>
                          <p className="inbox-message-content">{message.content}</p>
                          <div className="inbox-message-actions">
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
                    <button type="submit" className="crm-btn-primary">
                      Send reply
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

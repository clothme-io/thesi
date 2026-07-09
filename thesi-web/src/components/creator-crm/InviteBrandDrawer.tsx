"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPlatformInviteData } from "@/lib/invites/platform-storage";
import { sendPlatformBrandInvite } from "@/lib/invites/send-platform-brand-invite";

export interface InviteBrandDrawerProps {
  open: boolean;
  onClose: () => void;
  invitedBy: string;
  invitedByEmail: string;
  onInvited?: () => void;
}

function parseBrandLines(raw: string): { name: string; email: string }[] {
  return raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const emailMatch = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
      const email = emailMatch?.[0] ?? "";
      const name =
        line
          .replace(email, "")
          .replace(/[<>",]/g, "")
          .trim() || email.split("@")[0];
      return { name, email };
    })
    .filter((entry) => entry.email);
}

export function InviteBrandDrawer({
  open,
  onClose,
  invitedBy,
  invitedByEmail,
  onInvited,
}: InviteBrandDrawerProps) {
  const [externalRaw, setExternalRaw] = useState("");
  const [message, setMessage] = useState("");
  const [addToCrm, setAddToCrm] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteTick, setInviteTick] = useState(0);

  const sentInvites = useMemo(() => {
    if (!open) return [];
    return loadPlatformInviteData()
      .brandInvites.filter((i) => i.invitedByEmail === invitedByEmail)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [open, invitedByEmail, inviteTick]);

  const alreadyInvitedEmails = useMemo(
    () => new Set(sentInvites.map((i) => i.brandEmail.toLowerCase())),
    [sentInvites],
  );

  useEffect(() => {
    if (!open) {
      setExternalRaw("");
      setMessage("");
      setFeedback(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSend = async () => {
    setSending(true);
    setFeedback(null);
    let sent = 0;

    try {
      const entries = parseBrandLines(externalRaw);
      for (const entry of entries) {
        if (alreadyInvitedEmails.has(entry.email.toLowerCase())) continue;
        await sendPlatformBrandInvite({
          brandName: entry.name,
          brandEmail: entry.email,
          invitedBy,
          invitedByEmail,
          message: message.trim() || undefined,
          addToCrm,
        });
        sent += 1;
      }
      setFeedback(sent > 0 ? `Sent ${sent} invite${sent === 1 ? "" : "s"}.` : "No new invites sent.");
      setInviteTick((t) => t + 1);
      onInvited?.();
      setExternalRaw("");
    } finally {
      setSending(false);
    }
  };

  const canSend = parseBrandLines(externalRaw).length > 0;

  return (
    <>
      <div className="crm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="crm-drawer invite-drawer" role="dialog" aria-modal="true" aria-label="Invite brands">
        <div className="crm-drawer-header">
          <div>
            <h2>Invite brands</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Invite clients and brands to join Thesi
            </p>
          </div>
          <button type="button" className="crm-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="crm-drawer-body">
          <p className="workspace-hint" style={{ marginTop: 0 }}>
            Paste brand names and emails (one per line). Invites trigger email — TODO: wire Novu.
          </p>
          <label className="crm-form-field">
            <span>Brand emails</span>
            <textarea
              rows={6}
              placeholder={"Acme Co, billing@acme.com\npartners@brand.io"}
              value={externalRaw}
              onChange={(e) => setExternalRaw(e.target.value)}
            />
          </label>
          <label className="crm-form-field">
            <span>Optional message</span>
            <textarea
              rows={3}
              placeholder="We'd love to collaborate on UGC campaigns through Thesi…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <label className="settings-toggle">
            <span className="settings-toggle-copy">
              <strong>Add to CRM</strong>
              <span>Create a prospect brand in your CRM for each invite.</span>
            </span>
            <input type="checkbox" checked={addToCrm} onChange={(e) => setAddToCrm(e.target.checked)} />
          </label>

          <div className="invite-external-sent">
            <div className="invite-external-sent-header">
              <span>Invited brands</span>
              <span className="workspace-hint">{sentInvites.length}</span>
            </div>
            {sentInvites.length === 0 ? (
              <p className="workspace-hint invite-external-sent-empty">No brand invites sent yet.</p>
            ) : (
              <ul className="invite-external-sent-list">
                {sentInvites.map((invite) => (
                  <li key={invite.id} className="invite-external-sent-row">
                    <span className="invite-external-sent-email">{invite.brandEmail}</span>
                    <span className="invite-external-sent-name">{invite.brandName}</span>
                    <span className="invite-external-sent-status">{invite.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {feedback && (
            <p className="workspace-hint" style={{ color: "var(--ink)", marginTop: 16 }}>
              {feedback}
            </p>
          )}
        </div>

        <div className="crm-drawer-footer">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="crm-btn-primary" disabled={!canSend || sending} onClick={handleSend}>
            {sending ? "Sending…" : "Send invites"}
          </button>
        </div>
      </aside>
    </>
  );
}

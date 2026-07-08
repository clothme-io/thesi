"use client";

import { useEffect, useMemo, useState } from "react";
import { CREATOR_DIRECTORY } from "@/lib/creators/directory";
import { matchCreatorsToCampaign } from "@/lib/invites/matching";
import { sendCampaignInvite } from "@/lib/invites/send-campaign-invite";
import { getInvitesForCampaign, loadInviteData } from "@/lib/invites/storage";
import type { CampaignInviteCriteria } from "@/lib/invites/types";

type DrawerTab = "matched" | "external";

export interface InviteCreatorDrawerProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  brandName: string;
  criteria: CampaignInviteCriteria;
  onInvited?: () => void;
}

function parseExternalLines(raw: string): { name: string; email: string }[] {
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

export function InviteCreatorDrawer({
  open,
  onClose,
  campaignId,
  campaignName,
  brandName,
  criteria,
  onInvited,
}: InviteCreatorDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("matched");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [externalRaw, setExternalRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteTick, setInviteTick] = useState(0);

  const matched = useMemo(
    () => matchCreatorsToCampaign(CREATOR_DIRECTORY, criteria),
    [criteria],
  );

  const alreadyInvitedEmails = useMemo(() => {
    if (!open) return new Set<string>();
    const data = loadInviteData();
    return new Set(getInvitesForCampaign(data, campaignId).map((i) => i.creatorEmail.toLowerCase()));
  }, [open, campaignId, inviteTick]);

  useEffect(() => {
    if (!open) {
      setTab("matched");
      setSelectedIds(new Set());
      setExternalRaw("");
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

  const toggleCreator = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    setSending(true);
    setFeedback(null);
    let sent = 0;

    try {
      if (tab === "matched") {
        const creators = matched.filter((c) => selectedIds.has(c.id));
        for (const creator of creators) {
          if (alreadyInvitedEmails.has(creator.email.toLowerCase())) continue;
          await sendCampaignInvite({
            campaignId,
            campaignName,
            brandName,
            creatorId: creator.id,
            creatorEmail: creator.email,
            creatorName: creator.name,
            external: false,
          });
          sent += 1;
        }
      } else {
        const externals = parseExternalLines(externalRaw);
        for (const entry of externals) {
          if (alreadyInvitedEmails.has(entry.email.toLowerCase())) continue;
          await sendCampaignInvite({
            campaignId,
            campaignName,
            brandName,
            creatorEmail: entry.email,
            creatorName: entry.name,
            external: true,
          });
          sent += 1;
        }
      }
      setFeedback(sent > 0 ? `Sent ${sent} invite${sent === 1 ? "" : "s"}.` : "No new invites sent.");
      setInviteTick((t) => t + 1);
      onInvited?.();
      if (tab === "matched") setSelectedIds(new Set());
      else setExternalRaw("");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    tab === "matched" ? selectedIds.size > 0 : parseExternalLines(externalRaw).length > 0;

  return (
    <>
      <div className="crm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="crm-drawer invite-drawer" role="dialog" aria-modal="true" aria-label="Invite creators">
        <div className="crm-drawer-header">
          <div>
            <h2>Invite creators</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              {campaignName}
            </p>
          </div>
          <button type="button" className="crm-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="invite-drawer-tabs">
          <button
            type="button"
            className={tab === "matched" ? "invite-drawer-tab invite-drawer-tab--active" : "invite-drawer-tab"}
            onClick={() => setTab("matched")}
          >
            Matched ({matched.length})
          </button>
          <button
            type="button"
            className={tab === "external" ? "invite-drawer-tab invite-drawer-tab--active" : "invite-drawer-tab"}
            onClick={() => setTab("external")}
          >
            External emails
          </button>
        </div>

        <div className="crm-drawer-body">
          {tab === "matched" ? (
            <>
              <p className="workspace-hint" style={{ marginTop: 0 }}>
                Creators matching your campaign criteria (niche, platform, followers, location).
              </p>
              {matched.length === 0 ? (
                <p>No creators match these criteria yet. Try broadening requirements or use external invites.</p>
              ) : (
                <ul className="invite-creator-list">
                  {matched.map((creator) => {
                    const invited = alreadyInvitedEmails.has(creator.email.toLowerCase());
                    return (
                      <li key={creator.id} className="invite-creator-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(creator.id)}
                            disabled={invited}
                            onChange={() => toggleCreator(creator.id)}
                          />
                          <span className="invite-creator-info">
                            <strong>{creator.name}</strong>
                            <span>{creator.email}</span>
                            <span className="invite-creator-meta">
                              {creator.niches.join(", ")} · {creator.platforms.join(", ")} ·{" "}
                              {creator.followerRange} · {creator.location}
                            </span>
                          </span>
                          {invited && <span className="crm-tag">Invited</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="workspace-hint" style={{ marginTop: 0 }}>
                Paste names and emails (one per line). External invites trigger email only — TODO: wire Novu.
              </p>
              <label className="crm-form-field">
                <span>Emails</span>
                <textarea
                  rows={8}
                  placeholder={"Alex Rivera, alex@creator.dev\njane@example.com"}
                  value={externalRaw}
                  onChange={(e) => setExternalRaw(e.target.value)}
                />
              </label>
            </>
          )}

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
          <button
            type="button"
            className="crm-btn-primary"
            disabled={!canSend || sending}
            onClick={handleSend}
          >
            {sending ? "Sending…" : "Send invites"}
          </button>
        </div>
      </aside>
    </>
  );
}

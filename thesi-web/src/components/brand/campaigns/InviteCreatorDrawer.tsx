"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  sortCreatorsWithFavoritesFirst,
  toDirectoryEntries,
  useBrandCreatorFavorites,
  useCreatorsDirectory,
} from "@/lib/brand-creators/storage";
import { matchCreatorsToCampaign } from "@/lib/invites/matching";
import { sendCampaignInvite } from "@/lib/invites/send-campaign-invite";
import { getInvitesForCampaign, useInvites } from "@/lib/invites/storage";
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
  const { authenticatedRequest } = useAuth();
  const { creators, ready: creatorsReady } = useCreatorsDirectory(authenticatedRequest);
  const { data: favData, ready: favoritesReady } =
    useBrandCreatorFavorites(authenticatedRequest);
  const { data: inviteData, ready: invitesReady, reload: reloadInvites } =
    useInvites(authenticatedRequest);
  const [tab, setTab] = useState<DrawerTab>("matched");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [externalRaw, setExternalRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const matched = useMemo(() => {
    const results = matchCreatorsToCampaign(toDirectoryEntries(creators), criteria);
    return sortCreatorsWithFavoritesFirst(results, favData.favoriteCreatorIds);
  }, [criteria, creators, favData.favoriteCreatorIds]);

  const campaignInvites = useMemo(
    () => getInvitesForCampaign(inviteData, campaignId),
    [inviteData, campaignId],
  );

  const alreadyInvitedEmails = useMemo(() => {
    if (!open) return new Set<string>();
    return new Set(campaignInvites.map((i) => i.creatorEmail.toLowerCase()));
  }, [open, campaignInvites]);

  const favoriteIds = useMemo(() => {
    if (!open) return new Set<string>();
    return new Set(favData.favoriteCreatorIds);
  }, [open, favData.favoriteCreatorIds]);

  const externalInvites = useMemo(() => {
    if (!open) return [];
    return campaignInvites
      .filter((invite) => invite.external)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [open, campaignInvites]);

  useEffect(() => {
    if (!open) {
      setTab("matched");
      setSelectedIds(new Set());
      setExternalRaw("");
      setFeedback(null);
      return;
    }
    void reloadInvites(campaignId);
  }, [open, campaignId, reloadInvites]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (!creatorsReady || !favoritesReady || !invitesReady) return null;

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
        const selected = matched.filter((c) => selectedIds.has(c.id));
        for (const creator of selected) {
          if (alreadyInvitedEmails.has(creator.email.toLowerCase())) continue;
          await sendCampaignInvite(
            {
              campaignId,
              campaignName,
              brandName,
              creatorId: creator.id,
              creatorEmail: creator.email,
              creatorName: creator.name,
              external: false,
            },
            authenticatedRequest,
          );
          sent += 1;
        }
      } else {
        const externals = parseExternalLines(externalRaw);
        for (const entry of externals) {
          if (alreadyInvitedEmails.has(entry.email.toLowerCase())) continue;
          await sendCampaignInvite(
            {
              campaignId,
              campaignName,
              brandName,
              creatorEmail: entry.email,
              creatorName: entry.name,
              external: true,
            },
            authenticatedRequest,
          );
          sent += 1;
        }
      }
      await reloadInvites(campaignId);
      setFeedback(sent > 0 ? `Sent ${sent} invite${sent === 1 ? "" : "s"}.` : "No new invites sent.");
      onInvited?.();
      if (tab === "matched") setSelectedIds(new Set());
      else setExternalRaw("");
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Could not send invites",
      );
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
                Creators matching your campaign criteria. Favorites appear at the top.
              </p>
              {matched.length === 0 ? (
                <p>No creators match these criteria yet. Try broadening requirements or use external invites.</p>
              ) : (
                <ul className="invite-creator-list">
                  {matched.map((creator) => {
                    const invited = alreadyInvitedEmails.has(creator.email.toLowerCase());
                    const isFav = favoriteIds.has(creator.id);
                    return (
                      <li key={creator.id} className={`invite-creator-row ${isFav ? "invite-creator-row--fav" : ""}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(creator.id)}
                            disabled={invited}
                            onChange={() => toggleCreator(creator.id)}
                          />
                          <span className="invite-creator-info">
                            <strong>
                              {creator.name}
                              {isFav && (
                                <span className="crm-tag" style={{ marginLeft: 8 }}>
                                  ★ Favorite
                                </span>
                              )}
                            </strong>
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
                Paste names and emails (one per line). External invites are emailed via Novu; on-platform creators also get an inbox thread.
              </p>
              <label className="crm-form-field">
                <span>Emails</span>
                <textarea
                  rows={6}
                  placeholder={"Alex Rivera, alex@creator.dev\njane@example.com"}
                  value={externalRaw}
                  onChange={(e) => setExternalRaw(e.target.value)}
                />
              </label>

              <div className="invite-external-sent">
                <div className="invite-external-sent-header">
                  <span>Invited emails</span>
                  <span className="workspace-hint">{externalInvites.length}</span>
                </div>
                {externalInvites.length === 0 ? (
                  <p className="workspace-hint invite-external-sent-empty">No external invites sent yet.</p>
                ) : (
                  <ul className="invite-external-sent-list">
                    {externalInvites.map((invite) => (
                      <li key={invite.id} className="invite-external-sent-row">
                        <span className="invite-external-sent-email">{invite.creatorEmail}</span>
                        {invite.creatorName !== invite.creatorEmail.split("@")[0] && (
                          <span className="invite-external-sent-name">{invite.creatorName}</span>
                        )}
                        <span className="invite-external-sent-status">{invite.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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

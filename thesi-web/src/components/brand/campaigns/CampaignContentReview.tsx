"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";

type ReviewStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected";

type ReviewEvent = {
  id: string;
  type: "submitted" | "comment" | "changes_requested" | "approved" | "rejected";
  comment: string;
  actorName: string;
  version: number;
  createdAt: string;
};

export type CampaignContentReviewItem = {
  id: string;
  campaignId: string;
  creatorUserId: string;
  creatorName: string;
  deliverableLabel: string;
  title: string;
  status: ReviewStatus;
  version: number;
  originalName: string;
  sizeLabel: string;
  contentType: string;
  mediaKind: "video" | "image";
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  events?: ReviewEvent[];
};

type Props = {
  campaignId: string;
  canSubmit: boolean;
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

const EVENT_LABELS: Record<ReviewEvent["type"], string> = {
  submitted: "Submitted",
  comment: "Comment",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

export function CampaignContentReview({ campaignId, canSubmit }: Props) {
  const { authenticatedRequest, authenticatedBinaryRequest, session } = useAuth();
  const isBrand = session?.user.role === "brand";
  const [items, setItems] = useState<CampaignContentReviewItem[]>([]);
  const [selected, setSelected] = useState<CampaignContentReviewItem | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [deliverableLabel, setDeliverableLabel] = useState("");

  const load = useCallback(async () => {
    const next = await authenticatedRequest<{ items?: CampaignContentReviewItem[] }>(
      `/api/campaigns/${campaignId}/submissions`,
      { method: "GET" },
    );
    setItems(next?.items ?? []);
  }, [authenticatedRequest, campaignId]);

  useEffect(() => {
    void load().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load drafts",
      );
    });
  }, [load]);

  useEffect(() => {
    if (!selected?.id) {
      setMediaUrl("");
      return;
    }
    let active = true;
    let objectUrl = "";
    void authenticatedBinaryRequest(
      `/api/campaigns/${campaignId}/submissions/${selected.id}/media`,
    )
      .then((result) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(result.blob);
        setMediaUrl(objectUrl);
      })
      .catch(() => {
        if (active) setMediaUrl("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authenticatedBinaryRequest, campaignId, selected?.id]);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await work();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setBusy("");
    }
  };

  const openItem = (item: CampaignContentReviewItem) => {
    void run(`open-${item.id}`, async () => {
      const next = await authenticatedRequest<{ item: CampaignContentReviewItem }>(
        `/api/campaigns/${campaignId}/submissions/${item.id}`,
        { method: "GET" },
      );
      setSelected(next.item);
      setItems((prev) =>
        prev.map((row) => (row.id === next.item.id ? next.item : row)),
      );
    });
  };

  const uploadFile = async (file: File, reviseId?: string) => {
    const body = new FormData();
    body.append("file", file);
    if (title.trim()) body.append("title", title.trim());
    if (!reviseId && deliverableLabel.trim()) {
      body.append("deliverableLabel", deliverableLabel.trim());
    }
    if (reviseId && comment.trim()) body.append("comment", comment.trim());
    const path = reviseId
      ? `/api/campaigns/${campaignId}/submissions/${reviseId}/revisions`
      : `/api/campaigns/${campaignId}/submissions`;
    const next = await authenticatedRequest<{ item: CampaignContentReviewItem }>(
      path,
      { method: "POST", body },
    );
    setSelected(next.item);
    setComment("");
    await load();
  };

  return (
    <section className={isBrand ? undefined : "marketplace-panel"} style={isBrand ? { marginTop: 8 } : undefined}>
      <h3>Content review</h3>
      <p className="workspace-hint" style={{ marginTop: 0 }}>
        {canSubmit
          ? "Upload a draft video or image for the brand to watch and approve before you post anywhere."
          : "Watch creator drafts in Thesi and approve, reject, or request changes. This is before social posting."}
      </p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {canSubmit ? (
        <div className="workspace-grid" style={{ marginBottom: 16 }}>
          <label className="workspace-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fit check reel"
            />
          </label>
          <label className="workspace-field">
            <span>Deliverable</span>
            <input
              value={deliverableLabel}
              onChange={(e) => setDeliverableLabel(e.target.value)}
              placeholder="TikTok 1"
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Draft file</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) {
                  void run("upload", () => uploadFile(file));
                }
              }}
            />
            <span className="workspace-hint">
              MP4, MOV, WebM, or image up to 100MB. Thesi does not post this.
            </span>
          </label>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="workspace-hint">
          {canSubmit
            ? "No drafts yet. Upload a file, then submit it for review."
            : "No drafts submitted yet."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selected ? "minmax(0, 1fr) minmax(280px, 1fr)" : "1fr",
            gap: 16,
          }}
          className="campaign-review-split"
        >
          <div>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="crm-btn-secondary"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 8,
                  borderColor:
                    selected?.id === item.id ? "var(--ink)" : undefined,
                }}
                onClick={() => openItem(item)}
              >
                <strong>
                  {item.title || item.originalName}
                  {item.deliverableLabel ? ` · ${item.deliverableLabel}` : ""}
                </strong>
                <span className="workspace-hint" style={{ display: "block", margin: 0 }}>
                  {isBrand ? `${item.creatorName} · ` : ""}
                  {STATUS_LABELS[item.status]} · v{item.version} · {item.sizeLabel}
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div>
              <div
                style={{
                  background: "#111",
                  borderRadius: 12,
                  overflow: "hidden",
                  minHeight: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!mediaUrl ? (
                  <p className="workspace-hint" style={{ color: "#ddd" }}>
                    Loading preview…
                  </p>
                ) : selected.mediaKind === "video" ? (
                  <video
                    key={mediaUrl}
                    src={mediaUrl}
                    controls
                    playsInline
                    style={{ width: "100%", maxHeight: 420, display: "block" }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl}
                    alt={selected.title || selected.originalName}
                    style={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
                  />
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <span
                  className={`crm-status ${
                    selected.status === "approved" ? "crm-status--active" : ""
                  }`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
                <p className="workspace-hint">
                  {selected.creatorName} · {selected.originalName} · version{" "}
                  {selected.version}
                </p>
              </div>

              {canSubmit &&
              (selected.status === "draft" ||
                selected.status === "changes_requested") ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("submit", async () => {
                        const next = await authenticatedRequest<{
                          item: CampaignContentReviewItem;
                        }>(
                          `/api/campaigns/${campaignId}/submissions/${selected.id}/submit`,
                          { method: "POST" },
                        );
                        setSelected(next.item);
                        await load();
                      })
                    }
                  >
                    {busy === "submit" ? "Submitting…" : "Submit for review"}
                  </button>
                  <label className="crm-btn-secondary" style={{ cursor: "pointer" }}>
                    Replace file
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      disabled={Boolean(busy)}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) {
                          void run("revise", () => uploadFile(file, selected.id));
                        }
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {isBrand && selected.status === "in_review" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("approve", async () => {
                        const next = await authenticatedRequest<{
                          item: CampaignContentReviewItem;
                        }>(
                          `/api/campaigns/${campaignId}/submissions/${selected.id}/approve`,
                          { method: "POST", body: { comment } },
                        );
                        setSelected(next.item);
                        setComment("");
                        await load();
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    disabled={Boolean(busy) || !comment.trim()}
                    onClick={() =>
                      void run("changes", async () => {
                        const next = await authenticatedRequest<{
                          item: CampaignContentReviewItem;
                        }>(
                          `/api/campaigns/${campaignId}/submissions/${selected.id}/request-changes`,
                          { method: "POST", body: { comment } },
                        );
                        setSelected(next.item);
                        setComment("");
                        await load();
                      })
                    }
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    disabled={Boolean(busy) || !comment.trim()}
                    onClick={() =>
                      void run("reject", async () => {
                        const next = await authenticatedRequest<{
                          item: CampaignContentReviewItem;
                        }>(
                          `/api/campaigns/${campaignId}/submissions/${selected.id}/reject`,
                          { method: "POST", body: { comment } },
                        );
                        setSelected(next.item);
                        setComment("");
                        await load();
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              ) : null}

              <label className="workspace-field workspace-field--full">
                <span>Feedback</span>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    isBrand
                      ? "Required for change requests and rejections"
                      : "Optional note with a revision"
                  }
                />
              </label>
              <button
                type="button"
                className="crm-btn-secondary"
                disabled={Boolean(busy) || !comment.trim()}
                onClick={() =>
                  void run("comment", async () => {
                    const next = await authenticatedRequest<{
                      item: CampaignContentReviewItem;
                    }>(
                      `/api/campaigns/${campaignId}/submissions/${selected.id}/comments`,
                      { method: "POST", body: { comment } },
                    );
                    setSelected(next.item);
                    setComment("");
                  })
                }
              >
                Add comment
              </button>

              <div style={{ marginTop: 16 }}>
                {(selected.events ?? []).map((event) => (
                  <div key={event.id} style={{ marginBottom: 10 }}>
                    <strong>
                      {event.actorName} · {EVENT_LABELS[event.type]}
                    </strong>
                    {event.comment ? <p style={{ margin: "4px 0 0" }}>{event.comment}</p> : null}
                    <span className="workspace-hint">
                      v{event.version} · {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

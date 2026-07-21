"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import type {
  BrandCampaignGoalType,
  BrandCampaignPaymentModel,
  BrandCampaignStatus,
  BrandCampaignType,
} from "@/lib/brand-campaigns/types";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES,
} from "@/lib/brand-campaigns/types";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";
import { publishCampaignToMarketplace } from "@/lib/marketplace/publish-from-campaign";
import {
  calculatePlatformFeeCents,
  formatCents,
  PLATFORM_FEE_CAP_CENTS,
} from "@/lib/platform-fee";

const CAMPAIGN_TYPE_OPTIONS: {
  label: string;
  value: BrandCampaignGoalType;
}[] = (
  Object.keys(BRAND_CAMPAIGN_GOAL_TYPE_LABELS) as BrandCampaignGoalType[]
).map((value) => ({
  value,
  label: BRAND_CAMPAIGN_GOAL_TYPE_LABELS[value],
}));

const CONTENT_TYPE_OPTIONS: { label: string; value: BrandCampaignType }[] = [
  { label: "TikTok", value: "tiktok" },
  { label: "Instagram Reels", value: "instagram_reels" },
  { label: "YouTube Shorts", value: "youtube_shorts" },
  { label: "UGC Photos", value: "ugc_photos" },
  { label: "Mixed Bundle", value: "mixed_bundle" },
  { label: "Long Form", value: "long_form" },
];

const PAYMENT_OPTIONS: { label: string; value: BrandCampaignPaymentModel }[] = [
  { label: "Flat Rate", value: "flat_rate" },
  { label: "Milestone", value: "milestone" },
  { label: "Royalty", value: "royalty" },
  { label: "Hybrid", value: "hybrid" },
];

function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMoneyToCents(raw: string): number {
  const num = Number(raw.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

const defaultDates = () => {
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

export function CampaignCreateContent() {
  const router = useRouter();
  const { session, authenticatedRequest } = useAuth();
  const { ready, createCampaign, updateCampaign, uploadCampaignFile, error: loadError } =
    useBrandCampaigns(authenticatedRequest);
  const dates = defaultDates();

  const [name, setName] = useState("");
  const [campaignType, setCampaignType] =
    useState<BrandCampaignGoalType>("experience");
  const [type, setType] = useState<BrandCampaignType>("tiktok");
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [brief, setBrief] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [exampleVideoLinks, setExampleVideoLinks] = useState<string[]>([""]);
  const [niches, setNiches] = useState("Fitness, Lifestyle");
  const [minFollowersRange, setMinFollowersRange] = useState("5k+");
  const [location, setLocation] = useState("US");
  const [platforms, setPlatforms] = useState("TikTok, Instagram");
  const [paymentModel, setPaymentModel] = useState<BrandCampaignPaymentModel>("flat_rate");
  const [flatAmount, setFlatAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [postToMarketplace, setPostToMarketplace] = useState(true);
  const [inviteContext, setInviteContext] = useState<{ id: string; name: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ id: string; name: string; sizeLabel: string }>
  >([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const draftRef = useRef<{ id: string; name: string } | null>(null);

  if (!ready) return null;

  const brandName = session?.user.fullName ?? "Your Brand";
  const payoutCents = parseMoneyToCents(flatAmount);
  const feeCents = calculatePlatformFeeCents(payoutCents);
  const feeCapped = feeCents === PLATFORM_FEE_CAP_CENTS && payoutCents > 0;

  const buildCampaignPayload = (status: BrandCampaignStatus) => ({
    name: name.trim() || "Untitled campaign",
    campaignType,
    type,
    status,
    startDate,
    endDate,
    brief,
    deliverables,
    exampleVideoLinks: exampleVideoLinks.map((link) => link.trim()).filter(Boolean),
    requirements: {
      niches: parseList(niches),
      minFollowersRange,
      location,
      platforms: parseList(platforms),
    },
    files: [],
    payment: {
      model: paymentModel,
      flatRateCents: parseMoneyToCents(flatAmount),
      notes: paymentNotes || undefined,
    },
    postToMarketplace,
  });

  const flushPendingUploads = async (campaignId: string) => {
    if (pendingFiles.length === 0) return [] as Array<{ id: string; name: string; sizeLabel: string }>;
    const uploaded: Array<{ id: string; name: string; sizeLabel: string }> = [];
    for (const file of pendingFiles) {
      uploaded.push(await uploadCampaignFile(campaignId, file));
    }
    setAttachedFiles((prev) => [...uploaded, ...prev]);
    setPendingFiles([]);
    return uploaded;
  };

  const saveDraft = async (): Promise<{ id: string; name: string }> => {
    if (draftRef.current) {
      await flushPendingUploads(draftRef.current.id);
      return draftRef.current;
    }
    const campaign = await createCampaign(buildCampaignPayload("draft"));
    const context = { id: campaign.id, name: campaign.name };
    draftRef.current = context;
    setInviteContext(context);
    await flushPendingUploads(campaign.id);
    return context;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError("");
    try {
      await saveDraft();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save draft",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    const payload = buildCampaignPayload("active");
    const userId = session?.user.id ?? "dev-user-1";

    try {
      if (inviteContext) {
        const campaign = await updateCampaign(inviteContext.id, payload);
        const uploaded = await flushPendingUploads(campaign.id);
        await publishCampaignToMarketplace(
          {
            ...campaign,
            files: [...uploaded, ...campaign.files],
          },
          userId,
          brandName,
          authenticatedRequest,
        );
        router.push(`/app/campaigns/${campaign.id}`);
        return;
      }
      const campaign = await createCampaign(payload);
      const uploaded = await flushPendingUploads(campaign.id);
      await publishCampaignToMarketplace(
        {
          ...campaign,
          files: [...uploaded, ...campaign.files],
        },
        userId,
        brandName,
        authenticatedRequest,
      );
      router.push(`/app/campaigns/${campaign.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create campaign",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    setSaving(true);
    setError("");
    try {
      const context = await saveDraft();
      setInviteContext(context);
      setInviteOpen(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not prepare invite draft",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href="/app/campaigns" className="auth-link" style={{ fontSize: 13 }}>
            ← Campaigns
          </Link>
          <h1 style={{ marginTop: 4 }}>New campaign</h1>
        </div>
        <button
          className="crm-btn-primary"
          type="button"
          onClick={handleSaveDraft}
          disabled={saving}
        >
          Save draft
        </button>
      </header>
      <div className="app-content">
        {(error || loadError) && (
          <p className="workspace-hint">{error || loadError}</p>
        )}
        <div className="workspace-form">
          <section className="workspace-section">
            <h3>Campaign basics</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Name</span>
                <input type="text" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="workspace-field">
                <span>Campaign type</span>
                <select
                  value={campaignType}
                  onChange={(e) =>
                    setCampaignType(e.target.value as BrandCampaignGoalType)
                  }
                >
                  {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="workspace-hint" style={{ marginTop: 6 }}>
                  {BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES[campaignType]}
                </span>
              </label>
              <label className="workspace-field">
                <span>Content type</span>
                <select value={type} onChange={(e) => setType(e.target.value as BrandCampaignType)}>
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="workspace-hint" style={{ marginTop: 6 }}>
                  Applies to all campaign types.
                </span>
              </label>
              <label className="workspace-field">
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="workspace-field">
                <span>End date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Brief</span>
                <textarea
                  rows={4}
                  placeholder="Describe campaign goals, concept, and success criteria."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Deliverables</span>
                <textarea
                  rows={3}
                  placeholder="List deliverables expected from creators."
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                />
              </label>
              <div className="workspace-field workspace-field--full">
                <span>Example video links</span>
                <p className="workspace-hint" style={{ marginTop: 4 }}>
                  Optional reference examples for creators.
                </p>
                {exampleVideoLinks.map((link, index) => (
                  <div
                    key={`example-link-${index}`}
                    style={{ display: "flex", gap: 8, marginTop: 8 }}
                  >
                    <input
                      type="url"
                      placeholder="https://"
                      value={link}
                      onChange={(e) => {
                        const next = [...exampleVideoLinks];
                        next[index] = e.target.value;
                        setExampleVideoLinks(next);
                      }}
                      style={{ flex: 1 }}
                    />
                    {exampleVideoLinks.length > 1 ? (
                      <button
                        type="button"
                        className="inbox-btn-text"
                        onClick={() =>
                          setExampleVideoLinks((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="inbox-btn-text"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setExampleVideoLinks((prev) => [...prev, ""])
                  }
                >
                  + Add another link
                </button>
              </div>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Creator criteria</h3>
            <p className="workspace-hint">Used to match creators when you invite from Thesi.</p>
            <div className="workspace-grid">
              <label className="workspace-field workspace-field--full">
                <span>Niches (comma-separated)</span>
                <input type="text" value={niches} onChange={(e) => setNiches(e.target.value)} />
              </label>
              <label className="workspace-field">
                <span>Min followers</span>
                <input
                  type="text"
                  placeholder="e.g. 10k+"
                  value={minFollowersRange}
                  onChange={(e) => setMinFollowersRange(e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Location</span>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Platforms (comma-separated)</span>
                <input type="text" value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Payment model</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Payment type</span>
                <select
                  value={paymentModel}
                  onChange={(e) => setPaymentModel(e.target.value as BrandCampaignPaymentModel)}
                >
                  {PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Base/flat amount</span>
                <input
                  type="text"
                  placeholder="$0.00"
                  value={flatAmount}
                  onChange={(e) => setFlatAmount(e.target.value)}
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Payment notes</span>
                <textarea
                  rows={2}
                  placeholder="Milestone notes, royalty terms, payout timeline..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Platform fee</h3>
            <div className="brand-billing-plan">
              <div>
                <strong>
                  {feeCents > 0 ? formatCents(feeCents) : "No fee"}
                </strong>
                <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                  {feeCents > 0
                    ? feeCapped
                      ? `Capped at ${formatCents(PLATFORM_FEE_CAP_CENTS)} (2% of creator payout).`
                      : `2% of estimated creator payout (${formatCents(payoutCents)}).`
                    : "Set a creator payout amount to calculate the activation fee."}
                </p>
                <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                  Charged from your default card when you create/activate or post
                  to the marketplace. Drafts are free.
                </p>
              </div>
              <span className="crm-tag">Due on activate</span>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Distribution & files</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Post to marketplace</span>
                <select
                  value={postToMarketplace ? "yes" : "no"}
                  onChange={(e) => setPostToMarketplace(e.target.value === "yes")}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No (invite only)</option>
                </select>
              </label>
              <label className="workspace-field">
                <span>Upload files</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (selected.length === 0) return;
                    setPendingFiles((prev) => [...prev, ...selected]);
                    e.target.value = "";
                  }}
                />
              </label>
              {(pendingFiles.length > 0 || attachedFiles.length > 0) && (
                <div className="workspace-field workspace-field--full">
                  <span>Selected files</span>
                  <ul className="workspace-hint" style={{ margin: 0, paddingLeft: 18 }}>
                    {attachedFiles.map((file) => (
                      <li key={file.id}>
                        {file.name} ({file.sizeLabel})
                      </li>
                    ))}
                    {pendingFiles.map((file) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                        {file.name} (pending upload)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <div className="workspace-form-footer">
            <button
              className="crm-btn-secondary"
              type="button"
              onClick={handleInvite}
              disabled={saving}
            >
              Invite creators
            </button>
            <button
              className="crm-btn-primary"
              type="button"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving
                ? "Working…"
                : feeCents > 0
                  ? `Pay ${formatCents(feeCents)} & create`
                  : "Create campaign"}
            </button>
          </div>
        </div>
      </div>

      {inviteContext && (
        <InviteCreatorDrawer
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          campaignId={inviteContext.id}
          campaignName={inviteContext.name}
          brandName={brandName}
          criteria={{
            niches: parseList(niches),
            minFollowersRange,
            location,
            platforms: parseList(platforms),
          }}
        />
      )}
    </>
  );
}

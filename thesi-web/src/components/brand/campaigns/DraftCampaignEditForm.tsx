"use client";

import { useEffect, useState } from "react";
import { toDateInputValue } from "@/lib/brand-campaigns/date";
import type { CampaignInput } from "@/lib/brand-campaigns/storage";
import {
  buildCampaignPayment,
  centsToInput,
  formPayoutCents,
  milestonesToFormRows,
  seedMilestonesIfNeeded,
  type MilestoneFormRow,
} from "@/lib/brand-campaigns/payment-form";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES,
  formatMoney,
  type BrandCampaign,
  type BrandCampaignGoalType,
  type BrandCampaignPaymentModel,
  type BrandCampaignType,
} from "@/lib/brand-campaigns/types";
import { MilestoneBuilder } from "./MilestoneBuilder";
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

export type DraftCampaignFormState = {
  name: string;
  campaignType: BrandCampaignGoalType;
  type: BrandCampaignType;
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  exampleVideoLinks: string[];
  niches: string;
  minFollowersRange: string;
  location: string;
  platforms: string;
  paymentModel: BrandCampaignPaymentModel;
  flatAmount: string;
  milestones: MilestoneFormRow[];
  paymentNotes: string;
  postToMarketplace: boolean;
};

export function draftFormFromCampaign(
  campaign: BrandCampaign,
): DraftCampaignFormState {
  return {
    name: campaign.name,
    campaignType: campaign.campaignType,
    type: campaign.type,
    startDate: toDateInputValue(campaign.startDate),
    endDate: toDateInputValue(campaign.endDate),
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    exampleVideoLinks:
      campaign.exampleVideoLinks.length > 0
        ? [...campaign.exampleVideoLinks]
        : [""],
    niches: campaign.requirements.niches.join(", "),
    minFollowersRange: campaign.requirements.minFollowersRange,
    location: campaign.requirements.location,
    platforms: campaign.requirements.platforms.join(", "),
    paymentModel: campaign.payment.model,
    flatAmount: centsToInput(campaign.payment.flatRateCents),
    milestones: milestonesToFormRows(campaign.payment.milestones),
    paymentNotes: campaign.payment.notes ?? "",
    postToMarketplace: campaign.postToMarketplace,
  };
}

export function draftFormToInput(form: DraftCampaignFormState): CampaignInput {
  return {
    name: form.name.trim() || "Untitled campaign",
    campaignType: form.campaignType,
    type: form.type,
    status: "draft",
    startDate: form.startDate,
    endDate: form.endDate,
    brief: form.brief,
    deliverables: form.deliverables,
    exampleVideoLinks: form.exampleVideoLinks
      .map((link) => link.trim())
      .filter(Boolean),
    requirements: {
      niches: parseList(form.niches),
      minFollowersRange: form.minFollowersRange,
      location: form.location,
      platforms: parseList(form.platforms),
    },
    files: [],
    payment: buildCampaignPayment({
      model: form.paymentModel,
      flatAmount: form.flatAmount,
      notes: form.paymentNotes,
      milestones: form.milestones,
    }),
    postToMarketplace: form.postToMarketplace,
  };
}

type Props = {
  campaign: BrandCampaign;
  form: DraftCampaignFormState;
  onChange: (next: DraftCampaignFormState) => void;
  pendingFiles: File[];
  onPendingFiles: (files: File[]) => void;
};

export function DraftCampaignEditForm({
  campaign,
  form,
  onChange,
  pendingFiles,
  onPendingFiles,
}: Props) {
  const payoutCents = formPayoutCents(
    form.paymentModel,
    form.flatAmount,
    form.milestones,
  );
  const feeCents = calculatePlatformFeeCents(payoutCents);
  const feeCapped = feeCents === PLATFORM_FEE_CAP_CENTS && payoutCents > 0;

  const set = <K extends keyof DraftCampaignFormState>(
    key: K,
    value: DraftCampaignFormState[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <div className="workspace-form">
      <section className="workspace-section">
        <h3>Campaign basics</h3>
        <div className="workspace-grid">
          <label className="workspace-field">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Campaign type</span>
            <select
              value={form.campaignType}
              onChange={(e) =>
                set("campaignType", e.target.value as BrandCampaignGoalType)
              }
            >
              {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="workspace-hint" style={{ marginTop: 6 }}>
              {BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES[form.campaignType]}
            </span>
          </label>
          <label className="workspace-field">
            <span>Content type</span>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as BrandCampaignType)}
            >
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace-field">
            <span>Start date</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>End date</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Brief</span>
            <textarea
              rows={4}
              value={form.brief}
              onChange={(e) => set("brief", e.target.value)}
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Deliverables</span>
            <textarea
              rows={3}
              value={form.deliverables}
              onChange={(e) => set("deliverables", e.target.value)}
            />
          </label>
          <div className="workspace-field workspace-field--full">
            <span>Example video links</span>
            {form.exampleVideoLinks.map((link, index) => (
              <div
                key={`example-link-${index}`}
                style={{ display: "flex", gap: 8, marginTop: 8 }}
              >
                <input
                  type="url"
                  placeholder="https://"
                  value={link}
                  onChange={(e) => {
                    const next = [...form.exampleVideoLinks];
                    next[index] = e.target.value;
                    set("exampleVideoLinks", next);
                  }}
                  style={{ flex: 1 }}
                />
                {form.exampleVideoLinks.length > 1 ? (
                  <button
                    type="button"
                    className="inbox-btn-text"
                    onClick={() =>
                      set(
                        "exampleVideoLinks",
                        form.exampleVideoLinks.filter((_, i) => i !== index),
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
                set("exampleVideoLinks", [...form.exampleVideoLinks, ""])
              }
            >
              + Add another link
            </button>
          </div>
        </div>
      </section>

      <section className="workspace-section">
        <h3>Creator criteria</h3>
        <div className="workspace-grid">
          <label className="workspace-field workspace-field--full">
            <span>Niches (comma-separated)</span>
            <input
              type="text"
              value={form.niches}
              onChange={(e) => set("niches", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Min followers</span>
            <input
              type="text"
              value={form.minFollowersRange}
              onChange={(e) => set("minFollowersRange", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Location</span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Platforms (comma-separated)</span>
            <input
              type="text"
              value={form.platforms}
              onChange={(e) => set("platforms", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="workspace-section">
        <h3>Payment model</h3>
        <div className="workspace-grid">
          <label className="workspace-field">
            <span>Payment type</span>
            <select
              value={form.paymentModel}
              onChange={(e) => {
                const next = e.target.value as BrandCampaignPaymentModel;
                onChange({
                  ...form,
                  paymentModel: next,
                  milestones: seedMilestonesIfNeeded(next, form.milestones),
                });
              }}
            >
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {form.paymentModel === "milestone" ? (
            <MilestoneBuilder
              rows={form.milestones}
              onChange={(milestones) => onChange({ ...form, milestones })}
            />
          ) : (
            <label className="workspace-field">
              <span>Base/flat amount</span>
              <input
                type="text"
                placeholder="$0.00"
                value={form.flatAmount}
                onChange={(e) => set("flatAmount", e.target.value)}
              />
            </label>
          )}
          <label className="workspace-field workspace-field--full">
            <span>Payment notes</span>
            <textarea
              rows={2}
              value={form.paymentNotes}
              onChange={(e) => set("paymentNotes", e.target.value)}
            />
          </label>
        </div>
        <p className="workspace-hint" style={{ marginTop: 8 }}>
          Fee preview only — payment is off for now; Publish will not charge.
          {feeCents > 0
            ? ` Estimated ${formatCents(feeCents)}${feeCapped ? " (capped)" : ""}.`
            : ""}
          {payoutCents > 0 ? ` · payout ${formatMoney(payoutCents)}` : ""}
        </p>
      </section>

      <section className="workspace-section">
        <h3>Distribution & files</h3>
        <div className="workspace-grid">
          <label className="workspace-field">
            <span>Post to marketplace</span>
            <select
              value={form.postToMarketplace ? "yes" : "no"}
              onChange={(e) =>
                set("postToMarketplace", e.target.value === "yes")
              }
            >
              <option value="yes">Yes (when published)</option>
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
                onPendingFiles([...pendingFiles, ...selected]);
                e.target.value = "";
              }}
            />
          </label>
          {(pendingFiles.length > 0 || campaign.files.length > 0) && (
            <div className="workspace-field workspace-field--full">
              <span>
                Files ({campaign.files.length + pendingFiles.length})
              </span>
              <ul className="campaign-file-list">
                {campaign.files.map((file) => (
                  <li key={file.id} className="campaign-file-item">
                    <div>
                      <strong>{file.name}</strong>
                      <span className="workspace-hint">
                        {" "}
                        · {file.sizeLabel}
                      </span>
                    </div>
                    <span className="crm-tag">Uploaded</span>
                  </li>
                ))}
                {pendingFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="campaign-file-item campaign-file-item--pending"
                  >
                    <div>
                      <strong>{file.name}</strong>
                      <span className="workspace-hint">
                        {" "}
                        · {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <span className="crm-tag">Ready to upload</span>
                      <button
                        type="button"
                        className="inbox-btn-text"
                        onClick={() =>
                          onPendingFiles(
                            pendingFiles.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Keeps draft form state in sync when the loaded campaign identity/revision changes. */
export function useDraftForm(campaign: BrandCampaign | null) {
  const [form, setForm] = useState<DraftCampaignFormState | null>(null);
  const syncKey =
    campaign && campaign.status === "draft"
      ? `${campaign.id}:${campaign.updatedAt}`
      : "";

  useEffect(() => {
    if (!syncKey || !campaign || campaign.status !== "draft") {
      setForm(null);
      return;
    }
    setForm(draftFormFromCampaign(campaign));
    // Re-sync only when campaign id/updatedAt change so in-progress edits are kept.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [syncKey]);

  return { form, setForm };
}

"use client";

import { useEffect, useState } from "react";
import { toDateInputValue } from "@/lib/brand-campaigns/date";
import type { CampaignInput } from "@/lib/brand-campaigns/storage";
import {
  buildCampaignPayment,
  centsToInput,
  DEFAULT_MILESTONE_STRUCTURE,
  formPayoutCents,
  milestonesToFormRows,
  seedMilestonesIfNeeded,
  type MilestoneFormRow,
} from "@/lib/brand-campaigns/payment-form";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES,
  EMPTY_CONTENT_RIGHTS,
  EMPTY_CREATOR_BENEFITS,
  formatMoney,
  type BrandCampaign,
  type BrandCampaignContentRights,
  type BrandCampaignCreatorBenefits,
  type BrandCampaignGoalType,
  type BrandCampaignMilestoneStructure,
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

const PLATFORM_OPTIONS = ["TikTok", "Instagram", "YouTube"] as const;

const MILESTONE_STRUCTURE_OPTIONS: Array<{
  label: string;
  value: BrandCampaignMilestoneStructure;
}> = [
  { label: "Cumulative milestones", value: "cumulative" },
  { label: "Highest milestone achieved", value: "highest_achieved" },
];

const BENEFIT_FLAG_OPTIONS: Array<{
  key: keyof Omit<
    BrandCampaignCreatorBenefits,
    "guaranteedPaymentCents" | "customBenefits"
  >;
  label: string;
}> = [
  { key: "productsKept", label: "Products are theirs to keep" },
  { key: "foundingCreatorRecognition", label: "Founding Creator campaign participation" },
  { key: "portfolioUse", label: "Portfolio-ready UGC experience" },
  { key: "priorityFutureCampaigns", label: "Priority consideration for upcoming campaigns" },
  { key: "creatorPoolEligibility", label: "Eligibility for future Creator Pool campaigns" },
  { key: "bonusEligibility", label: "Performance bonus eligibility" },
  { key: "brandOpportunityAccess", label: "Future brand and boutique opportunities" },
];

const CONTENT_RIGHTS_OPTIONS: Array<{
  key: keyof Omit<BrandCampaignContentRights, "duration">;
  label: string;
}> = [
  { key: "organicUsage", label: "Organic social usage" },
  { key: "websiteAppUsage", label: "Website and app usage" },
  { key: "paidAdsUsage", label: "Paid ads usage" },
  { key: "rawContentAccess", label: "Raw content access" },
];

function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToRows(raw: string): string[] {
  return raw
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleArrayItem<T>(items: T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item];
}

function paymentInputFromCents(cents?: number): string {
  if (!cents) return "";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

function centsFromPaymentInput(value: string): number | undefined {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100)
    : undefined;
}

export type DraftCampaignFormState = {
  name: string;
  campaignType: BrandCampaignGoalType;
  contentTypes: BrandCampaignType[];
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  exampleVideoLinks: string[];
  niches: string;
  minFollowersRange: string;
  location: string;
  platforms: string[];
  requiredTasks: string;
  productsProvided: string;
  creatorCapacity: string;
  creatorBenefits: BrandCampaignCreatorBenefits;
  contentRights: BrandCampaignContentRights;
  paymentModel: BrandCampaignPaymentModel;
  milestoneStructure: BrandCampaignMilestoneStructure;
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
    contentTypes: campaign.contentTypes ?? [],
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
    platforms: campaign.requirements.platforms,
    requiredTasks: (campaign.requiredTasks ?? []).map((task) => task.title).join("\n"),
    productsProvided: (campaign.productsProvided ?? []).map((product) => product.name).join("\n"),
    creatorCapacity: campaign.creatorCapacity ? String(campaign.creatorCapacity) : "",
    creatorBenefits: campaign.creatorBenefits ?? { ...EMPTY_CREATOR_BENEFITS },
    contentRights: campaign.contentRights ?? { ...EMPTY_CONTENT_RIGHTS },
    paymentModel: campaign.payment.model,
    milestoneStructure:
      campaign.payment.milestoneStructure ?? DEFAULT_MILESTONE_STRUCTURE,
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
    contentTypes: form.contentTypes,
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
      platforms: form.platforms,
    },
    files: [],
    payment: buildCampaignPayment({
      model: form.paymentModel,
      flatAmount: form.flatAmount,
      milestoneStructure: form.milestoneStructure,
      notes: form.paymentNotes,
      milestones: form.milestones,
    }),
    requiredTasks: listToRows(form.requiredTasks).map((title, index) => ({
      id: `task-${index + 1}`,
      title,
      required: true,
    })),
    creatorBenefits: {
      ...form.creatorBenefits,
      customBenefits: listToRows(form.creatorBenefits.customBenefits.join("\n")),
    },
    contentRights: form.contentRights,
    productsProvided: listToRows(form.productsProvided).map((name, index) => ({
      id: `product-${index + 1}`,
      name,
      creatorKeeps: form.creatorBenefits.productsKept,
    })),
    ...(form.creatorCapacity.trim()
      ? { creatorCapacity: Number(form.creatorCapacity) }
      : {}),
    postToMarketplace: form.postToMarketplace,
  };
}

type Props = {
  campaign: BrandCampaign;
  form: DraftCampaignFormState;
  onChange: (next: DraftCampaignFormState) => void;
  pendingFiles: File[];
  onPendingFiles: (files: File[]) => void;
  onDeleteFile: (fileId: string) => Promise<void>;
};

export function DraftCampaignEditForm({
  campaign,
  form,
  onChange,
  pendingFiles,
  onPendingFiles,
  onDeleteFile,
}: Props) {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const payoutCents = formPayoutCents(
    form.paymentModel,
    form.flatAmount,
    form.milestones,
    form.milestoneStructure,
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
              id="campaign-name"
              name="campaignName"
              data-testid="campaign-name-input"
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Campaign type</span>
            <select
              id="campaign-goal-type"
              name="campaignGoalType"
              data-testid="campaign-goal-type-select"
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
          <div className="workspace-field">
            <span>Content type</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    name="campaignContentTypes"
                    data-testid={`campaign-content-type-${opt.value}`}
                    type="checkbox"
                    checked={form.contentTypes.includes(opt.value)}
                    onChange={() =>
                      set("contentTypes", toggleArrayItem(form.contentTypes, opt.value))
                    }
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="workspace-field">
            <span>Start date</span>
            <input
              id="campaign-start-date"
              name="campaignStartDate"
              data-testid="campaign-start-date-input"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>End date</span>
            <input
              id="campaign-end-date"
              name="campaignEndDate"
              data-testid="campaign-end-date-input"
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Brief</span>
            <textarea
              id="campaign-brief"
              name="campaignBrief"
              data-testid="campaign-brief-textarea"
              rows={4}
              value={form.brief}
              onChange={(e) => set("brief", e.target.value)}
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Deliverables</span>
            <textarea
              id="campaign-deliverables"
              name="campaignDeliverables"
              data-testid="campaign-deliverables-textarea"
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
                  id={`campaign-example-link-${index}`}
                  name={`campaignExampleLink${index + 1}`}
                  data-testid={`campaign-example-link-${index}`}
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
              id="campaign-niches"
              name="campaignNiches"
              data-testid="campaign-niches-input"
              type="text"
              value={form.niches}
              onChange={(e) => set("niches", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Min followers</span>
            <input
              id="campaign-min-followers"
              name="campaignMinFollowers"
              data-testid="campaign-min-followers-input"
              type="text"
              value={form.minFollowersRange}
              onChange={(e) => set("minFollowersRange", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Location</span>
            <input
              id="campaign-location"
              name="campaignLocation"
              data-testid="campaign-location-input"
              type="text"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
          <div className="workspace-field workspace-field--full">
            <span>Platforms</span>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {PLATFORM_OPTIONS.map((platform) => (
                <label key={platform} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    name="campaignPlatforms"
                    data-testid={`campaign-platform-${platform.toLowerCase()}`}
                    type="checkbox"
                    checked={form.platforms.includes(platform)}
                    onChange={() =>
                      set("platforms", toggleArrayItem(form.platforms, platform))
                    }
                  />
                  <span>{platform}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-section">
        <h3>Creator work</h3>
        <div className="workspace-grid">
          <label className="workspace-field workspace-field--full">
            <span>Required tasks</span>
            <textarea
              id="campaign-required-tasks"
              name="campaignRequiredTasks"
              data-testid="campaign-required-tasks-textarea"
              rows={4}
              value={form.requiredTasks}
              onChange={(e) => set("requiredTasks", e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Creator capacity</span>
            <input
              id="campaign-creator-capacity"
              name="campaignCreatorCapacity"
              data-testid="campaign-creator-capacity-input"
              type="number"
              min="1"
              value={form.creatorCapacity}
              onChange={(e) => set("creatorCapacity", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="workspace-section">
        <h3>Creator benefits</h3>
        <div className="workspace-grid">
          <label className="workspace-field">
            <span>Guaranteed payment</span>
            <input
              id="campaign-guaranteed-payment"
              name="campaignGuaranteedPayment"
              data-testid="campaign-guaranteed-payment-input"
              type="text"
              inputMode="decimal"
              value={paymentInputFromCents(form.creatorBenefits.guaranteedPaymentCents)}
              onChange={(e) =>
                set("creatorBenefits", {
                  ...form.creatorBenefits,
                  guaranteedPaymentCents: centsFromPaymentInput(e.target.value),
                })
              }
            />
          </label>
          <label className="workspace-field workspace-field--full">
            <span>Products provided</span>
            <textarea
              id="campaign-products-provided"
              name="campaignProductsProvided"
              data-testid="campaign-products-provided-textarea"
              rows={3}
              value={form.productsProvided}
              onChange={(e) => set("productsProvided", e.target.value)}
            />
          </label>
          <div className="workspace-field workspace-field--full">
            <span>Benefit flags</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {BENEFIT_FLAG_OPTIONS.map(({ key, label }) => (
                <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.creatorBenefits[key]}
                    onChange={() =>
                      set("creatorBenefits", {
                        ...form.creatorBenefits,
                        [key]: !form.creatorBenefits[key],
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="workspace-field workspace-field--full">
            <span>Custom benefits</span>
            <textarea
              id="campaign-custom-benefits"
              name="campaignCustomBenefits"
              data-testid="campaign-custom-benefits-textarea"
              rows={3}
              value={form.creatorBenefits.customBenefits.join("\n")}
              onChange={(e) =>
                set("creatorBenefits", {
                  ...form.creatorBenefits,
                  customBenefits: listToRows(e.target.value),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="workspace-section">
        <h3>Content rights</h3>
        <div className="workspace-grid">
          <div className="workspace-field workspace-field--full">
            <span>Usage rights</span>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {CONTENT_RIGHTS_OPTIONS.map(({ key, label }) => (
                <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.contentRights[key]}
                    onChange={() =>
                      set("contentRights", {
                        ...form.contentRights,
                        [key]: !form.contentRights[key],
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="workspace-field">
            <span>Usage duration</span>
            <input
              id="campaign-content-rights-duration"
              name="campaignContentRightsDuration"
              data-testid="campaign-content-rights-duration-input"
              type="text"
              value={form.contentRights.duration}
              onChange={(e) =>
                set("contentRights", {
                  ...form.contentRights,
                  duration: e.target.value,
                })
              }
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
              id="campaign-payment-model"
              name="campaignPaymentModel"
              data-testid="campaign-payment-model-select"
              value={form.paymentModel}
              onChange={(e) => {
                const next = e.target.value as BrandCampaignPaymentModel;
                onChange({
                  ...form,
                  paymentModel: next,
                  milestones: seedMilestonesIfNeeded(next, form.milestones),
                  milestoneStructure:
                    next === "milestone"
                      ? form.milestoneStructure
                      : DEFAULT_MILESTONE_STRUCTURE,
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
            <>
              <div className="workspace-field workspace-field--full">
                <span>Milestone structure</span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {MILESTONE_STRUCTURE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="radio"
                        name="campaignMilestoneStructure"
                        value={option.value}
                        checked={form.milestoneStructure === option.value}
                        onChange={() =>
                          set("milestoneStructure", option.value)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <MilestoneBuilder
                rows={form.milestones}
                onChange={(milestones) => onChange({ ...form, milestones })}
              />
            </>
          ) : (
            <label className="workspace-field">
              <span>Base/flat amount</span>
              <input
                id="campaign-flat-amount"
                name="campaignFlatAmount"
                data-testid="campaign-flat-amount-input"
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
              id="campaign-payment-notes"
              name="campaignPaymentNotes"
              data-testid="campaign-payment-notes-textarea"
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
              id="campaign-post-to-marketplace"
              name="campaignPostToMarketplace"
              data-testid="campaign-post-to-marketplace-select"
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
              id="campaign-files"
              name="campaignFiles"
              data-testid="campaign-files-input"
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="crm-tag">Uploaded</span>
                      <button
                        type="button"
                        className="inbox-btn-text"
                        disabled={deletingFileId === file.id}
                        onClick={async () => {
                          setDeletingFileId(file.id);
                          try {
                            await onDeleteFile(file.id);
                          } finally {
                            setDeletingFileId(null);
                          }
                        }}
                      >
                        {deletingFileId === file.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
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

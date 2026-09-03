"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getCampaignById, useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import {
  buildCampaignPayment,
  formPayoutCents,
  milestonesToFormRows,
  newMilestoneId,
  seedMilestonesIfNeeded,
  paymentFormError,
  type MilestoneFormRow,
} from "@/lib/brand-campaigns/payment-form";
import type {
  BrandCampaignCreatorBenefits,
  BrandCampaignGoalType,
  BrandCampaignPaymentModel,
  BrandCampaignStatus,
  BrandCampaignType,
} from "@/lib/brand-campaigns/types";
import { EMPTY_CREATOR_BENEFITS } from "@/lib/brand-campaigns/types";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";
import { MilestoneBuilder } from "./MilestoneBuilder";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES,
} from "@/lib/brand-campaigns/types";
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

const PLATFORM_OPTIONS = ["TikTok", "Instagram", "YouTube"] as const;

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
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams.get("from");
  const { session, authenticatedRequest } = useAuth();
  const { data, ready, createCampaign, updateCampaign, uploadCampaignFile, error: loadError } =
    useBrandCampaigns(authenticatedRequest);
  const dates = defaultDates();
  const hydratedRef = useRef(false);

  const [name, setName] = useState("");
  const [campaignType, setCampaignType] =
    useState<BrandCampaignGoalType>("experience");
  const [contentTypes, setContentTypes] = useState<BrandCampaignType[]>(["tiktok"]);
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [brief, setBrief] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [exampleVideoLinks, setExampleVideoLinks] = useState<string[]>([""]);
  const [niches, setNiches] = useState("Fitness, Lifestyle");
  const [minFollowersRange, setMinFollowersRange] = useState("5k+");
  const [location, setLocation] = useState("US");
  const [platforms, setPlatforms] = useState<string[]>(["TikTok", "Instagram"]);
  const [requiredTasks, setRequiredTasks] = useState("");
  const [productsProvided, setProductsProvided] = useState("");
  const [creatorCapacity, setCreatorCapacity] = useState("");
  const [creatorBenefits, setCreatorBenefits] = useState({
    ...EMPTY_CREATOR_BENEFITS,
    productsKept: true,
    portfolioUse: true,
  });
  const [paymentModel, setPaymentModel] = useState<BrandCampaignPaymentModel>("flat_rate");
  const [flatAmount, setFlatAmount] = useState("");
  const [milestones, setMilestones] = useState<MilestoneFormRow[]>([]);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [postToMarketplace, setPostToMarketplace] = useState(true);
  const [inviteContext, setInviteContext] = useState<{ id: string; name: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ id: string; name: string; sizeLabel: string }>
  >([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const draftRef = useRef<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!ready || !duplicateFromId || hydratedRef.current) return;
    const source = getCampaignById(data, duplicateFromId);
    if (!source) {
      setError("Could not find campaign to duplicate.");
      hydratedRef.current = true;
      return;
    }
    hydratedRef.current = true;
    setName(`${source.name} (copy)`);
    setCampaignType(source.campaignType);
    setContentTypes(source.contentTypes);
    setStartDate(source.startDate.slice(0, 10));
    setEndDate(source.endDate.slice(0, 10));
    setBrief(source.brief);
    setDeliverables(source.deliverables);
    setExampleVideoLinks(
      source.exampleVideoLinks.length > 0 ? source.exampleVideoLinks : [""],
    );
    setNiches(source.requirements.niches.join(", "));
    setMinFollowersRange(source.requirements.minFollowersRange);
    setLocation(source.requirements.location);
    setPlatforms(source.requirements.platforms);
    setPaymentModel(source.payment.model);
    setFlatAmount(
      source.payment.flatRateCents
        ? String(source.payment.flatRateCents / 100)
        : "",
    );
    setMilestones(
      milestonesToFormRows(source.payment.milestones).map((row) => ({
        ...row,
        id: newMilestoneId(),
      })),
    );
    setPaymentNotes(source.payment.notes ?? "");
    setRequiredTasks(source.requiredTasks.map((task) => task.title).join("\n"));
    setProductsProvided(source.productsProvided.map((product) => product.name).join("\n"));
    setCreatorCapacity(source.creatorCapacity ? String(source.creatorCapacity) : "");
    setCreatorBenefits(source.creatorBenefits);
    setPostToMarketplace(source.postToMarketplace);
  }, [ready, duplicateFromId, data]);

  if (!ready) return null;

  const brandName = session?.user.fullName ?? "Your Brand";
  const payoutCents = formPayoutCents(paymentModel, flatAmount, milestones);
  const feeCents = calculatePlatformFeeCents(payoutCents);
  const feeCapped = feeCents === PLATFORM_FEE_CAP_CENTS && payoutCents > 0;

  const buildCampaignPayload = (status: BrandCampaignStatus) => ({
    name: name.trim() || "Untitled campaign",
    campaignType,
    contentTypes,
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
      platforms,
    },
    files: [],
    payment: buildCampaignPayment({
      model: paymentModel,
      flatAmount,
      notes: paymentNotes,
      milestones,
    }),
    requiredTasks: listToRows(requiredTasks).map((title, index) => ({
      id: `task-${index + 1}`,
      title,
      required: true,
    })),
    creatorBenefits: {
      ...creatorBenefits,
      customBenefits: listToRows(creatorBenefits.customBenefits.join("\n")),
    },
    productsProvided: listToRows(productsProvided).map((product, index) => ({
      id: `product-${index + 1}`,
      name: product,
      creatorKeeps: creatorBenefits.productsKept,
    })),
    ...(creatorCapacity.trim()
      ? { creatorCapacity: Number(creatorCapacity) }
      : {}),
    postToMarketplace,
  });

  const requireMilestonePayment = (): string | null =>
    paymentFormError(paymentModel, milestones);

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

  const saveDraft = async (): Promise<{
    id: string;
    name: string;
    fileUploadFailed: boolean;
  }> => {
    const payload = buildCampaignPayload("draft");
    const campaign = draftRef.current
      ? await updateCampaign(draftRef.current.id, payload)
      : await createCampaign(payload);
    const context = { id: campaign.id, name: campaign.name };
    draftRef.current = context;
    setInviteContext(context);
    let fileUploadFailed = false;
    try {
      await flushPendingUploads(campaign.id);
    } catch {
      fileUploadFailed = true;
    }
    return { ...context, fileUploadFailed };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const context = await saveDraft();
      setSaveMessage(
        context.fileUploadFailed
          ? `Draft saved — ${context.name}. Some files could not be uploaded.`
          : `Draft saved — ${context.name}`,
      );
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

  const handlePublish = async () => {
    setSaving(true);
    setError("");
    setSaveMessage("");
    const milestoneError = requireMilestonePayment();
    if (milestoneError) {
      setError(milestoneError);
      setSaving(false);
      return;
    }
    const payload = buildCampaignPayload("active");
    const userId = session?.user.id ?? "dev-user-1";

    try {
      const existingId = draftRef.current?.id ?? inviteContext?.id;
      const campaign = existingId
        ? await updateCampaign(existingId, payload)
        : await createCampaign(payload);
      const context = { id: campaign.id, name: campaign.name };
      draftRef.current = context;
      setInviteContext(context);
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
          : "Could not publish campaign",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const context = await saveDraft();
      setInviteContext(context);
      if (context.fileUploadFailed) {
        setSaveMessage(
          `Draft saved — ${context.name}. Some files could not be uploaded.`,
        );
      }
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
          <h1 style={{ marginTop: 4 }}>
            {duplicateFromId ? "Duplicate campaign" : "New campaign"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="crm-btn-secondary"
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="crm-btn-primary"
            type="button"
            onClick={handlePublish}
            disabled={saving}
          >
            {saving ? "Working…" : "Publish"}
          </button>
        </div>
      </header>
      <div className="app-content">
        {(error || loadError) && (
          <p className="workspace-hint" role="alert">
            {error || loadError}
          </p>
        )}
        {saveMessage && !error && (
          <p className="workspace-hint" role="status">
            {saveMessage}
          </p>
        )}
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
                  placeholder="Campaign name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Campaign type</span>
                <select
                  id="campaign-goal-type"
                  name="campaignGoalType"
                  data-testid="campaign-goal-type-select"
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
              <div className="workspace-field">
                <span>Content type</span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        name="campaignContentTypes"
                        data-testid={`campaign-content-type-${opt.value}`}
                        type="checkbox"
                        checked={contentTypes.includes(opt.value)}
                        onChange={() =>
                          setContentTypes((prev) => toggleArrayItem(prev, opt.value))
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <span className="workspace-hint" style={{ marginTop: 6 }}>
                  Select every format creators may produce.
                </span>
              </div>
              <label className="workspace-field">
                <span>Start date</span>
                <input
                  id="campaign-start-date"
                  name="campaignStartDate"
                  data-testid="campaign-start-date-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>End date</span>
                <input
                  id="campaign-end-date"
                  name="campaignEndDate"
                  data-testid="campaign-end-date-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Brief</span>
                <textarea
                  id="campaign-brief"
                  name="campaignBrief"
                  data-testid="campaign-brief-textarea"
                  rows={4}
                  placeholder="Describe campaign goals, concept, and success criteria."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Deliverables</span>
                <textarea
                  id="campaign-deliverables"
                  name="campaignDeliverables"
                  data-testid="campaign-deliverables-textarea"
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
                      id={`campaign-example-link-${index}`}
                      name={`campaignExampleLink${index + 1}`}
                      data-testid={`campaign-example-link-${index}`}
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
                <input
                  id="campaign-niches"
                  name="campaignNiches"
                  data-testid="campaign-niches-input"
                  type="text"
                  value={niches}
                  onChange={(e) => setNiches(e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Min followers</span>
                <input
                  id="campaign-min-followers"
                  name="campaignMinFollowers"
                  data-testid="campaign-min-followers-input"
                  type="text"
                  placeholder="e.g. 10k+"
                  value={minFollowersRange}
                  onChange={(e) => setMinFollowersRange(e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Location</span>
                <input
                  id="campaign-location"
                  name="campaignLocation"
                  data-testid="campaign-location-input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
                        checked={platforms.includes(platform)}
                        onChange={() =>
                          setPlatforms((prev) => toggleArrayItem(prev, platform))
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
                  placeholder="Download ClothME&#10;Create Fit Profile&#10;Test products&#10;Complete feedback"
                  value={requiredTasks}
                  onChange={(e) => setRequiredTasks(e.target.value)}
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
                  placeholder="20"
                  value={creatorCapacity}
                  onChange={(e) => setCreatorCapacity(e.target.value)}
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
                  placeholder="$300"
                  value={
                    creatorBenefits.guaranteedPaymentCents
                      ? String(creatorBenefits.guaranteedPaymentCents / 100)
                      : ""
                  }
                  onChange={(e) =>
                    setCreatorBenefits((prev) => ({
                      ...prev,
                      guaranteedPaymentCents: e.target.value.trim()
                        ? Math.round(Number(e.target.value.replace(/[^0-9.]/g, "")) * 100)
                        : undefined,
                    }))
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
                  placeholder="T-shirt&#10;Pants&#10;Pyjamas"
                  value={productsProvided}
                  onChange={(e) => setProductsProvided(e.target.value)}
                />
              </label>
              <div className="workspace-field workspace-field--full">
                <span>Benefit flags</span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {BENEFIT_FLAG_OPTIONS.map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={creatorBenefits[key]}
                        onChange={() =>
                          setCreatorBenefits((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
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
                  placeholder="Future opportunities with participating fashion brands and boutiques"
                  value={creatorBenefits.customBenefits.join("\n")}
                  onChange={(e) =>
                    setCreatorBenefits((prev) => ({
                      ...prev,
                      customBenefits: listToRows(e.target.value),
                    }))
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
                  value={paymentModel}
                  onChange={(e) => {
                    const next = e.target.value as BrandCampaignPaymentModel;
                    setPaymentModel(next);
                    setMilestones((prev) => seedMilestonesIfNeeded(next, prev));
                  }}
                >
                  {PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              {paymentModel === "milestone" ? (
                <MilestoneBuilder rows={milestones} onChange={setMilestones} />
              ) : (
                <label className="workspace-field">
                  <span>Base/flat amount</span>
                  <input
                    id="campaign-flat-amount"
                    name="campaignFlatAmount"
                    data-testid="campaign-flat-amount-input"
                    type="text"
                    placeholder="$0.00"
                    value={flatAmount}
                    onChange={(e) => setFlatAmount(e.target.value)}
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
                  placeholder="Royalty terms, payout timeline..."
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
                      ? `Preview: capped at ${formatCents(PLATFORM_FEE_CAP_CENTS)} (2% of creator payout).`
                      : `Preview: 2% of estimated creator payout (${formatCents(payoutCents)}).`
                    : "Set a creator payout amount to preview the future activation fee."}
                </p>
                <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                  Payment is turned off for now — Publish will not charge your
                  card.
                </p>
              </div>
              <span className="crm-tag">Not charged yet</span>
            </div>
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
                  id="campaign-files"
                  name="campaignFiles"
                  data-testid="campaign-files-input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (selected.length === 0) return;
                    setPendingFiles((prev) => [...prev, ...selected]);
                    setSaveMessage(
                      selected.length === 1
                        ? `Added ${selected[0].name} — save or publish to upload`
                        : `Added ${selected.length} files — save or publish to upload`,
                    );
                    e.target.value = "";
                  }}
                />
              </label>
              {(pendingFiles.length > 0 || attachedFiles.length > 0) && (
                <div className="workspace-field workspace-field--full">
                  <span>
                    Files ({attachedFiles.length + pendingFiles.length})
                  </span>
                  <ul className="campaign-file-list">
                    {attachedFiles.map((file) => (
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
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span className="crm-tag">Ready to upload</span>
                          <button
                            type="button"
                            className="inbox-btn-text"
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter((_, i) => i !== index),
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
              className="crm-btn-secondary"
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              className="crm-btn-primary"
              type="button"
              onClick={handlePublish}
              disabled={saving}
            >
              {saving ? "Working…" : "Publish"}
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
            platforms,
          }}
        />
      )}
    </>
  );
}

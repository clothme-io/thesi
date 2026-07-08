"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { createBrandCampaign, useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import type {
  BrandCampaignPaymentModel,
  BrandCampaignStatus,
  BrandCampaignType,
} from "@/lib/brand-campaigns/types";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";

const TYPE_OPTIONS: { label: string; value: BrandCampaignType }[] = [
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
  const { session } = useAuth();
  const { data, ready, persist } = useBrandCampaigns();
  const dates = defaultDates();

  const [name, setName] = useState("");
  const [type, setType] = useState<BrandCampaignType>("tiktok");
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [brief, setBrief] = useState("");
  const [deliverables, setDeliverables] = useState("");
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
  const draftRef = useRef<{ id: string; name: string } | null>(null);

  if (!ready) return null;

  const brandName = session?.user.fullName ?? "Your Brand";

  const buildCampaignPayload = (status: BrandCampaignStatus) => ({
    name: name.trim() || "Untitled campaign",
    type,
    status,
    startDate,
    endDate,
    brief,
    deliverables,
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

  const saveDraft = (): { id: string; name: string } => {
    if (draftRef.current) {
      return draftRef.current;
    }
    const { data: next, campaign } = createBrandCampaign(data, buildCampaignPayload("draft"));
    persist(next);
    const context = { id: campaign.id, name: campaign.name };
    draftRef.current = context;
    setInviteContext(context);
    return context;
  };

  const handleSaveDraft = () => {
    saveDraft();
  };

  const handleCreate = () => {
    const payload = buildCampaignPayload("active");
    if (inviteContext) {
      const next = {
        campaigns: data.campaigns.map((c) =>
          c.id === inviteContext.id ? { ...c, ...payload, status: "active" as const } : c,
        ),
      };
      persist(next);
      router.push(`/app/campaigns/${inviteContext.id}`);
      return;
    }
    const { data: next, campaign } = createBrandCampaign(data, payload);
    persist(next);
    router.push(`/app/campaigns/${campaign.id}`);
  };

  const handleInvite = () => {
    const context = saveDraft();
    setInviteContext(context);
    setInviteOpen(true);
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
        <button className="crm-btn-primary" type="button" onClick={handleSaveDraft}>
          Save draft
        </button>
      </header>
      <div className="app-content">
        <div className="workspace-form">
          <section className="workspace-section">
            <h3>Campaign basics</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Name</span>
                <input type="text" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="workspace-field">
                <span>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value as BrandCampaignType)}>
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                <input type="file" multiple />
              </label>
            </div>
          </section>

          <div className="workspace-form-footer">
            <button className="crm-btn-secondary" type="button" onClick={handleInvite}>
              Invite creators
            </button>
            <button className="crm-btn-primary" type="button" onClick={handleCreate}>
              Create campaign
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

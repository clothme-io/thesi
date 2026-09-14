"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { CampaignFundingPanel } from "@/components/brand/campaigns/CampaignFundingPanel";
import { CommissionSettlementPanel } from "@/components/brand/campaigns/CommissionSettlementPanel";
import { selectWorkspace } from "@/lib/brand-workspace-storage";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";
import "../app-shell.css";
import "./demo.css";
type Demo = {
  campaignId: string;
  saleCampaignId: string;
  lineId: string;
  workspace: string;
  provider: string;
  database: string;
  earnedCents: number;
  totals: {
    reserved: number;
    creatorPaid: number;
    creatorRecovered: number;
    vendorReturned: number;
    vendorRecovered: number;
    refundOffset: number;
  };
};
export function LocalPaymentsDemo() {
  const { updateSession, authenticatedRequest } = useAuth();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [campaign, setCampaign] = useState<BrandCampaign | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    updateSession({
      accessToken: "local-demo-only",
      refreshToken: "local-demo-only",
      user: {
        id: "demo-brand",
        email: "demo-brand@example.test",
        fullName: "Demo Brand",
        role: "brand",
        mustChangePassword: false,
        onboardingCompleted: true,
        onboardingStep: "complete",
      },
    });
  }, [updateSession]);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/local-payments");
      const b = await r.json();
      if (!r.ok) throw new Error(b.error?.message ?? "Demo unavailable");
      const d = b.data as Demo;
      selectWorkspace("demo-brand", d.workspace);
      setDemo(d);
      const list = await authenticatedRequest<{ campaigns: BrandCampaign[] }>(
        "/api/campaigns",
      );
      setCampaign(list.campaigns.find((c) => c.id === d.campaignId) ?? null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load demo");
    }
  }, [authenticatedRequest]);
  useEffect(() => {
    void load();
  }, [load, refresh]);
  async function action(path: string) {
    try {
      await authenticatedRequest(`/api/local-payments/${path}`, {
        method: "POST",
        body: {},
      });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo action failed");
    }
  }
  async function status(status: "active" | "completed") {
    if (!campaign) return;
    try {
      await authenticatedRequest(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        body: { ...campaign, status },
      });
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update campaign");
    }
  }
  return (
    <main className="local-payments-demo"
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "36px 24px",
        fontFamily: "var(--font-geist-sans),sans-serif",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          background: "#fff1cc",
          color: "#604700",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        LOCAL DEMO · Simulated money · Docker PostgreSQL · No live accounts or
        payments
      </div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ letterSpacing: 2, fontSize: 12 }}>THESI × CLOTHME</p>
          <h1>Campaign payments, end to end</h1>
          <p>
            Review the same funding and settlement services against isolated
            local data.
          </p>
        </div>
        <button onClick={() => setRefresh((n) => n + 1)}>Refresh all</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {demo && campaign ? (
        <>
          <section
            style={{
              margin: "28px 0",
              padding: 24,
              border: "1px solid #ddd",
              borderRadius: 16,
            }}
          >
            <h2>1. Optional base payment</h2>
            <p>
              $100 per creator × 3 slots. Fund the deposit, publish, accept two
              creators, then accept their work or close to refund the empty
              slot.
            </p>
            <p>
              <strong>{campaign.name}</strong> · {campaign.status}
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <button
                onClick={() => void status("active")}
                disabled={campaign.status !== "draft"}
              >
                Publish funded campaign
              </button>
              <button
                disabled={campaign.status !== "active"}
                onClick={() => void action("accept-creators")}
              >
                Simulate two creator acceptances
              </button>
              <button
                disabled={campaign.status === "completed"}
                onClick={() => void status("completed")}
              >
                Close campaign / refund unused slot
              </button>
              <Link href={`/app/campaigns/${campaign.id}`}>
                Open campaign in Thesi
              </Link>
            </div>
            <CampaignFundingPanel key={`base-${refresh}`} campaign={campaign} />
          </section>
          <section
            style={{
              margin: "28px 0",
              padding: 24,
              border: "1px solid #ddd",
              borderRadius: 16,
            }}
          >
            <h2>2. Commission funded by sales</h2>
            <p>
              A $500 qualifying merchandise sale at 10% reserves $50 from the
              brand’s sale proceeds. No campaign deposit is required.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <button onClick={() => void action("refund")}>
                Simulate $100 merchandise refund
              </button>
              <button onClick={() => void action("fail-next")}>
                Lose next transfer response
              </button>
              <button onClick={() => void action("dispute")}>
                Toggle payment dispute
              </button>
              <Link href="/app/commission-earnings">
                Open earnings in Thesi
              </Link>
            </div>
            <CommissionSettlementPanel
              key={`sales-${refresh}`}
              orderLineId={demo.lineId}
            />
          </section>
        </>
      ) : (
        <p>Preparing the local walkthrough…</p>
      )}
    </main>
  );
}

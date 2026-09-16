"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";

type SocialProvider = "youtube" | "tiktok" | "instagram";

type SocialAccountStatus = {
  provider: SocialProvider;
  status: "disconnected" | "connected" | "error" | "needs_setup";
  configured: boolean;
  handle: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

type SocialAccountsResponse = {
  accounts: SocialAccountStatus[];
  youtubeConfigured: boolean;
};

const LABELS: Record<SocialProvider, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

const SETUP_COPY: Record<SocialProvider, string> = {
  youtube:
    "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI. Connect uses Google OAuth with youtube.readonly — Thesi never posts.",
  tiktok:
    "Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET. Redirect URI should match TIKTOK_REDIRECT_URI (default http://localhost:5010/v1/social/tiktok/callback).",
  instagram:
    "Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET for Instagram Login. Redirect URI should match INSTAGRAM_REDIRECT_URI. A professional Instagram account is required.",
};

const STATUS_LABELS: Record<SocialAccountStatus["status"], string> = {
  connected: "Verified",
  disconnected: "Not connected",
  error: "Error",
  needs_setup: "Needs setup",
};

export function CreatorSocialAccountsContent() {
  const { authenticatedRequest, session } = useAuth();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SocialAccountsResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  const connectedFlash = searchParams.get("connected");
  const oauthError = searchParams.get("error");

  const load = useCallback(async () => {
    if (session?.user.role !== "creator") return;
    const next = await authenticatedRequest<SocialAccountsResponse>(
      "/api/social/accounts",
      { method: "GET" },
    );
    setData(next);
  }, [authenticatedRequest, session?.user.role]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((error) => {
        if (!cancelled) {
          setActionError(
            error instanceof Error
              ? error.message
              : "Could not load connected accounts",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!ready) return null;

  if (session?.user.role !== "creator") {
    return (
      <div className="app-content">
        <p className="workspace-hint">Creator account required.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-content">
        {actionError ? (
          <p className="auth-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    );
  }

  const run = async (key: string, work: () => Promise<SocialAccountsResponse>) => {
    setBusy(key);
    setActionError("");
    try {
      setData(await work());
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Request failed",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href="/app/settings" className="auth-link" style={{ fontSize: 13 }}>
            ← Settings
          </Link>
          <h1 style={{ marginTop: 4 }}>Verified accounts</h1>
          <span className="workspace-subtitle">
            Official APIs only — views, likes, and comments. Thesi never posts.
          </span>
        </div>
      </header>

      <div className="app-content">
        {(actionError || oauthError) && (
          <p className="auth-error" role="alert">
            {actionError || oauthError}
          </p>
        )}
        {connectedFlash && (
          <p className="workspace-save-notice" role="status">
            {LABELS[connectedFlash as SocialProvider] || connectedFlash} connected.
          </p>
        )}

        <p className="workspace-hint" style={{ marginTop: 0 }}>
          Connect YouTube, TikTok, and Instagram with official login. Ownership
          is required before stats or post metrics appear. Nothing is posted or
          scheduled.
        </p>

        <div className="crm-brand-grid" style={{ marginTop: 20 }}>
          {data.accounts.map((account) => {
            const label = LABELS[account.provider];
            const needsSetup = account.status === "needs_setup";
            const connected = account.status === "connected";
            const syncing = busy === `${account.provider}-sync`;
            const connecting = busy === `${account.provider}-connect`;
            const disconnecting = busy === `${account.provider}-disconnect`;
            return (
              <div key={account.provider} className="crm-brand-card">
                <span
                  className={`crm-status ${connected ? "crm-status--active" : ""}`}
                >
                  {STATUS_LABELS[account.status]}
                </span>
                <h3>{label}</h3>
                <p>
                  {account.handle ? `@${account.handle.replace(/^@/, "")}` : "Not connected"}
                  {account.lastSyncAt
                    ? ` · Synced ${new Date(account.lastSyncAt).toLocaleString()}`
                    : ""}
                </p>
                {account.lastError ? (
                  <p className="workspace-hint">{account.lastError}</p>
                ) : null}
                {needsSetup ? (
                  <p className="workspace-hint">{SETUP_COPY[account.provider]}</p>
                ) : null}
                {account.provider === "youtube" ? (
                  <p className="workspace-hint">
                    Google may round subscriber counts above 1,000.
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    type="button"
                    className="crm-btn-primary"
                    disabled={needsSetup || Boolean(busy)}
                    onClick={() =>
                      void run(`${account.provider}-connect`, async () => {
                        const { url } = await authenticatedRequest<{
                          url: string;
                        }>(`/api/social/${account.provider}/connect`, {
                          method: "GET",
                        });
                        window.location.href = url;
                        return data;
                      })
                    }
                  >
                    {connecting
                      ? "Redirecting…"
                      : connected
                        ? "Reconnect"
                        : `Connect ${label}`}
                  </button>
                  {connected && (
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(`${account.provider}-sync`, () =>
                          authenticatedRequest<SocialAccountsResponse>(
                            `/api/social/${account.provider}/sync`,
                            { method: "POST" },
                          ),
                        )
                      }
                    >
                      {syncing ? "Syncing…" : "Sync"}
                    </button>
                  )}
                  {connected && (
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(`${account.provider}-disconnect`, () =>
                          authenticatedRequest<SocialAccountsResponse>(
                            `/api/social/${account.provider}/disconnect`,
                            { method: "POST" },
                          ),
                        )
                      }
                    >
                      {disconnecting ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

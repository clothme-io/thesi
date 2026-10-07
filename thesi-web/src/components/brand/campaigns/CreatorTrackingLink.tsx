"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
export function CreatorTrackingLink({
  campaignId,
  productId,
  productTitle,
  install,
  initialUrl,
}: {
  campaignId: string;
  productId?: string;
  productTitle?: string;
  install?: boolean;
  initialUrl?: string;
}) {
  const { authenticatedRequest } = useAuth();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (initialUrl || url) return;
    let active = true;
    setBusy(true);
    authenticatedRequest<{ url: string }>("/api/creator-tracking/links", {
      method: "POST",
      body: { campaignId, ...(productId ? { productId } : {}) },
    })
      .then((result) => {
        if (active) setUrl(result.url);
      })
      .catch((e) => {
        if (active)
          setMessage(
            e instanceof Error ? e.message : "Could not create your link",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, campaignId, initialUrl, productId, url]);
  return (
    <div style={{ marginTop: 16 }}>
      <p className="workspace-hint">
        {install
          ? "Share this ClothME install link. Attribution follows the accepted campaign terms."
          : "Share this ClothME product link. Shopper attribution follows the accepted campaign terms."}
      </p>
      {url ? (
        <>
          <label className="workspace-field">
            <span>
              {productTitle
                ? `Promote link for ${productTitle}`
                : install
                  ? "App install link"
                  : "Product link"}
            </span>
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage("Creator link copied");
              } catch {
                setMessage("Select and copy the link above.");
              }
            }}
          >
            Copy link
          </button>
        </>
      ) : (
        <p>{busy ? "Creating link…" : message || "Link is not ready yet."}</p>
      )}
      {message && url && <p role="status">{message}</p>}
    </div>
  );
}

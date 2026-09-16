"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
export function CreatorTrackingLink({
  campaignId,
  productId,
  productTitle,
}: {
  campaignId: string;
  productId?: string;
  productTitle?: string;
}) {
  const { authenticatedRequest } = useAuth();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div style={{ marginTop: 16 }}>
      <p className="workspace-hint">
        Share your personal product link for this commission. Shopper attribution
        follows the accepted campaign terms.
      </p>
      {!url ? (
        <button
          type="button"
          className="crm-btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const result = await authenticatedRequest<{ url: string }>(
                "/api/creator-tracking/links",
                {
                  method: "POST",
                  body: { campaignId, ...(productId ? { productId } : {}) },
                },
              );
              setUrl(result.url);
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "Could not create your link",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating link…" : "Get my creator link"}
        </button>
      ) : (
        <>
          <label className="workspace-field">
            <span>
              {productTitle
                ? `Commission link for ${productTitle}`
                : "Personal product link"}
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
            Copy creator link
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

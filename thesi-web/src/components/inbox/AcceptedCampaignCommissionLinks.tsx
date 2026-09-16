"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import type { PromotedProduct } from "@/lib/brand-campaigns/types";
import { campaignProducts } from "@/components/brand/campaigns/CampaignProductSelection";
import { PromotedProductDetails } from "@/components/brand/campaigns/PromotedProductDetails";

type Snapshot = {
  campaignId: string;
  paymentSnapshot: {
    model: string;
    promotedProduct?: PromotedProduct;
    promotedProducts?: PromotedProduct[];
  };
};

export function AcceptedCampaignCommissionLinks({
  campaignId,
}: {
  campaignId: string;
}) {
  const { authenticatedRequest } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CREATOR_TRACKING_ENABLED !== "true") return;
    let active = true;
    authenticatedRequest<{ snapshot: Snapshot | null }>(
      `/api/invites/campaign/acceptance-snapshot?campaignId=${encodeURIComponent(campaignId)}`,
    )
      .then((data) => {
        if (active) setSnapshot(data.snapshot);
      })
      .catch(() => {
        if (active) setSnapshot(null);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, campaignId]);
  if (
    process.env.NEXT_PUBLIC_CREATOR_TRACKING_ENABLED !== "true" ||
    snapshot?.paymentSnapshot.model !== "commission"
  )
    return null;
  const products = campaignProducts(snapshot.paymentSnapshot);
  if (!products.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      {products.map((product) => (
        <PromotedProductDetails
          key={product.productId}
          product={product}
          trackingCampaignId={snapshot.campaignId}
        />
      ))}
    </div>
  );
}

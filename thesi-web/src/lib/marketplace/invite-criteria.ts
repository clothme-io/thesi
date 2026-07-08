import type { CampaignInviteCriteria } from "@/lib/invites/types";
import type { MarketplaceListing } from "./types";

const TYPE_PLATFORMS: Record<MarketplaceListing["type"], string[]> = {
  tiktok: ["TikTok"],
  instagram_reels: ["Instagram"],
  youtube_shorts: ["YouTube"],
  ugc_photos: ["Instagram"],
  mixed_bundle: ["TikTok", "Instagram"],
  long_form: ["YouTube"],
};

const NICHE_KEYWORDS = [
  "Fashion",
  "Fitness",
  "Beauty",
  "Skincare",
  "Food",
  "Lifestyle",
  "Sportswear",
];

export function listingToInviteCriteria(listing: MarketplaceListing): CampaignInviteCriteria {
  const reqText = listing.requirements.join(" ");
  const followerMatch = reqText.match(/\d+k\+?/i);

  const niches = NICHE_KEYWORDS.filter((niche) =>
    listing.requirements.some((req) => req.toLowerCase().includes(niche.toLowerCase())),
  );

  return {
    niches,
    minFollowersRange: followerMatch?.[0] ?? "",
    location: listing.remoteOk ? listing.location || "Remote" : listing.location,
    platforms: TYPE_PLATFORMS[listing.type] ?? [],
  };
}

export function listingInviteCampaignId(listingId: string): string {
  return `listing-${listingId}`;
}

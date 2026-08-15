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
  const niches: string[] = [];
  let minFollowersRange = "";
  let location = listing.remoteOk ? listing.location || "Remote" : listing.location;
  let platforms = TYPE_PLATFORMS[listing.type] ?? [];

  for (const req of listing.requirements) {
    const labeled = req.match(/^([^:]+):\s*(.+)$/);
    if (labeled) {
      const label = labeled[1].trim().toLowerCase();
      const value = labeled[2].trim();
      if (label.startsWith("niche")) {
        niches.push(
          ...value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean),
        );
      } else if (label.includes("follower")) {
        minFollowersRange = value;
      } else if (label.startsWith("platform")) {
        platforms = value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      } else if (label.startsWith("location")) {
        location = value;
      }
      continue;
    }

    const followerMatch = req.match(/(\d+k?\+?)\s*followers?/i);
    if (followerMatch) {
      minFollowersRange = followerMatch[1];
      continue;
    }

    const matchedNiche = NICHE_KEYWORDS.find((niche) =>
      req.toLowerCase().includes(niche.toLowerCase()),
    );
    if (matchedNiche) niches.push(matchedNiche);
  }

  return {
    niches,
    minFollowersRange,
    location,
    platforms,
  };
}

export function listingInviteCampaignId(listing: MarketplaceListing): string {
  return listing.campaignId ?? `listing-${listing.id}`;
}

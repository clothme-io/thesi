import type { CreatorDirectoryEntry } from "@/lib/creators/types";
import type { CampaignInviteCriteria } from "./types";

function parseFollowerMin(range: string): number {
  const match = range.match(/(\d+)\s*k/i);
  if (!match) return 0;
  return Number(match[1]) * 1000;
}

function locationMatches(campaignLocation: string, creatorLocation: string): boolean {
  const c = campaignLocation.trim().toLowerCase();
  const cr = creatorLocation.trim().toLowerCase();
  if (!c || c === "remote" || c === "us") return true;
  if (cr === "remote" || cr === "us") return true;
  return cr.includes(c) || c.includes(cr);
}

export function matchCreatorsToCampaign(
  creators: CreatorDirectoryEntry[],
  criteria: CampaignInviteCriteria,
): CreatorDirectoryEntry[] {
  const minFollowers = parseFollowerMin(criteria.minFollowersRange);

  return creators.filter((creator) => {
    if (criteria.niches.length > 0) {
      const nicheHit = criteria.niches.some((n) =>
        creator.niches.some((cn) => cn.toLowerCase() === n.toLowerCase()),
      );
      if (!nicheHit) return false;
    }

    if (criteria.platforms.length > 0) {
      const platformHit = criteria.platforms.some((p) =>
        creator.platforms.some((cp) => cp.toLowerCase() === p.toLowerCase()),
      );
      if (!platformHit) return false;
    }

    if (minFollowers > 0 && parseFollowerMin(creator.followerRange) < minFollowers) {
      return false;
    }

    if (criteria.location && !locationMatches(criteria.location, creator.location)) {
      return false;
    }

    return true;
  });
}

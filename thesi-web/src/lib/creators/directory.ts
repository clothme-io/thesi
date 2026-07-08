import { CREATOR_PROFILES } from "./seed";
import type { CreatorDirectoryEntry, CreatorProfile } from "./types";

export type { CreatorDirectoryEntry, CreatorProfile } from "./types";
export { formatCount, formatPercent } from "./types";

/** Seed creators on Thesi for invite matching (v1). */
export const CREATOR_DIRECTORY: CreatorDirectoryEntry[] = CREATOR_PROFILES.map(
  ({ id, name, email, niches, location, platforms, followerRange }) => ({
    id,
    name,
    email,
    niches,
    location,
    platforms,
    followerRange,
  }),
);

export function getCreatorById(id: string): CreatorProfile | undefined {
  return CREATOR_PROFILES.find((c) => c.id === id);
}

export function getAllCreators(): CreatorProfile[] {
  return CREATOR_PROFILES;
}

import { describe, expect, it } from "vitest";
import { matchCreatorsToCampaign, parseFollowerMin } from "./matching";
import type { CreatorDirectoryEntry } from "@/lib/creators/types";

function creator(
  overrides: Partial<CreatorDirectoryEntry> = {},
): CreatorDirectoryEntry {
  return {
    id: "c1",
    name: "Ava",
    email: "ava@example.com",
    niches: ["Fashion"],
    location: "US",
    platforms: ["Instagram"],
    followerRange: "5k+",
    ...overrides,
  };
}

describe("invite follower matching", () => {
  it("reads the lower bound from application-style ranges", () => {
    expect(parseFollowerMin("5k+")).toBe(5000);
    expect(parseFollowerMin("5K+")).toBe(5000);
    expect(parseFollowerMin("1k-5k")).toBe(1000);
    expect(parseFollowerMin("500-1k")).toBe(500);
    expect(parseFollowerMin("0-500")).toBe(0);
  });

  it("keeps 5k+ creators for campaigns that require 5k+", () => {
    const matched = matchCreatorsToCampaign(
      [
        creator({ id: "low", followerRange: "1k-5k" }),
        creator({ id: "high", followerRange: "5k+" }),
      ],
      {
        niches: [],
        platforms: [],
        location: "",
        minFollowersRange: "5k+",
      },
    );
    expect(matched.map((row) => row.id)).toEqual(["high"]);
  });
});

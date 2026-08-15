import { describe, expect, it } from "vitest";
import {
  buildLabeledRequirements,
  toRequirementRows,
} from "./requirements";

describe("marketplace requirements", () => {
  it("builds labeled requirement lines", () => {
    expect(
      buildLabeledRequirements({
        niches: ["Fashion App"],
        minFollowersRange: "500",
        platforms: ["TikTok", "Instagram"],
        location: "US & CAD",
      }),
    ).toEqual([
      "Niches: Fashion App",
      "Minimum followers: 500",
      "Platforms: TikTok, Instagram",
      "Location: US & CAD",
    ]);
  });

  it("parses labeled lines for the detail UI", () => {
    expect(
      toRequirementRows([
        "Niches: Fashion App",
        "Minimum followers: 500",
        "Platforms: TikTok, Instagram",
      ]),
    ).toEqual([
      { label: "Niches", value: "Fashion App" },
      { label: "Minimum followers", value: "500" },
      { label: "Platforms", value: "TikTok, Instagram" },
    ]);
  });

  it("interprets legacy unlabeled requirement lists", () => {
    expect(
      toRequirementRows([
        "Fashion App",
        "500 followers",
        "TikTok",
        "Instagram",
        "US & CAD",
      ]),
    ).toEqual([
      { label: "Niches", value: "Fashion App" },
      { label: "Minimum followers", value: "500" },
      { label: "Platforms", value: "TikTok, Instagram" },
      { label: "Location", value: "US & CAD" },
    ]);
  });
});

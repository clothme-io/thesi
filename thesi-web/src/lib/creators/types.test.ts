import { describe, expect, it } from "vitest";
import { formatFollowers, formatStatCount, formatStatPercent } from "./types";

describe("creator stat display", () => {
  it("shows the range when an exact follower count is missing", () => {
    expect(formatFollowers(0, "5k+")).toBe("5k+");
    expect(formatFollowers(6800, "5k+")).toBe("6.8K");
    expect(formatFollowers(0, "")).toBe("—");
  });

  it("hides empty views and engagement as dashes", () => {
    expect(formatStatCount(0)).toBe("—");
    expect(formatStatCount(1500)).toBe("1.5K");
    expect(formatStatPercent(0)).toBe("—");
    expect(formatStatPercent(4.2)).toBe("4.2%");
  });
});

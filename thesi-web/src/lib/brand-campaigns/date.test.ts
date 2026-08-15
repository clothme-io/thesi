import { describe, expect, it } from "vitest";
import { toDateInputValue } from "./date";

describe("toDateInputValue", () => {
  it("keeps YYYY-MM-DD values", () => {
    expect(toDateInputValue("2026-08-14")).toBe("2026-08-14");
  });

  it("strips time from ISO timestamps", () => {
    expect(toDateInputValue("2026-08-14T00:00:00.000Z")).toBe("2026-08-14");
  });
});

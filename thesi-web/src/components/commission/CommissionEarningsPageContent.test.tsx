import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommissionEarningsPageContent } from "./CommissionEarningsPageContent";

const request = vi.fn();
vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({ authenticatedRequest: request }),
}));

afterEach(() => {
  cleanup();
  request.mockReset();
});

it("renders sale and install event lines returned by the report", async () => {
  request.mockResolvedValue({
    totals: [
      {
        currency: "USD",
        attributedLines: 1,
        reversedLines: 0,
        heldLines: 0,
        underReviewCents: "250",
        heldCents: "0",
      },
    ],
    installTotals: [
      {
        currency: "USD",
        installEvents: 1,
        heldEvents: 0,
        reversedEvents: 0,
        underReviewCents: "200",
        heldCents: "0",
      },
    ],
    settlementTotals: [],
    baseTotals: [],
    lines: [
      {
        orderLineId: "order-1",
        campaignId: "sale-campaign",
        currency: "USD",
        accruedCents: "250",
        state: "under_review",
        reasons: ["qualified_sale_pending_review"],
        updatedAt: "2026-10-01T12:00:00.000Z",
      },
    ],
    installLines: [
      {
        eventId: "install-1",
        campaignId: "install-campaign",
        currency: "USD",
        accruedCents: "200",
        state: "under_review",
        reasons: ["qualified_install_pending_review"],
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
    ],
    notice: "Estimates only.",
  });
  render(<CommissionEarningsPageContent />);
  expect(await screen.findByText("sale-campaign")).toBeTruthy();
  expect(screen.getByText("install-campaign")).toBeTruthy();
  expect(screen.getAllByText("Under review").length).toBeGreaterThan(0);
  expect(screen.getByText("qualified_sale_pending_review")).toBeTruthy();
  expect(screen.getByText("qualified_install_pending_review")).toBeTruthy();
});

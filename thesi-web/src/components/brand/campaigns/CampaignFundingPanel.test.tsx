import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampaignFundingPanel } from "./CampaignFundingPanel";
import { SEED_BRAND_CAMPAIGN_DATA } from "@/lib/brand-campaigns/seed";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({ authenticatedRequest: request }),
}));
const campaign = {
  ...SEED_BRAND_CAMPAIGN_DATA.campaigns[0],
  id: "fixture",
  status: "draft" as const,
};
const data = {
  plan: { baseCents: 10000, slots: 3, depositCents: 30000 },
  fund: null,
  depositedCents: 0,
  releasedCents: 0,
  refundedCents: 0,
  heldCents: 0,
  unfilledSlotCents: 30000,
  obligations: [],
  operations: [],
};
afterEach(cleanup);
beforeEach(() => request.mockReset());
it("requires a separate exact-amount deposit confirmation", async () => {
  request.mockResolvedValue(data);
  render(<CampaignFundingPanel campaign={campaign} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Review base deposit" }),
  );
  expect(request.mock.calls.every((c: unknown[]) => !c[1])).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm $300.00 deposit" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/api/campaign-funding/fixture/deposit",
      { method: "POST", body: { expectedAmountCents: 30000 } },
    ),
  );
});
it("requires a work acceptance note and releases only the selected creator obligation", async () => {
  request.mockResolvedValue({
    ...data,
    fund: { state: "funded" },
    obligations: [
      {
        id: "ob1",
        creatorName: "Ada",
        amountCents: "10000",
        acceptedWorkAt: null,
        payoutState: null,
      },
    ],
  });
  render(<CampaignFundingPanel campaign={{ ...campaign, status: "active" }} />);
  const button = await screen.findByRole("button", {
    name: "Accept work and release $100.00",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Work accepted for Ada" }),
    { target: { value: "Accepted the agreed product video" } },
  );
  fireEvent.click(button);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/api/campaign-funding/fixture/accept-work",
      {
        method: "POST",
        body: {
          obligationId: "ob1",
          note: "Accepted the agreed product video",
        },
      },
    ),
  );
});

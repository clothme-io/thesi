import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignContentReview } from "./CampaignContentReview";

const request = vi.fn();
vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    session: { user: { role: "brand" } },
    authenticatedRequest: request,
    authenticatedBinaryRequest: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  request.mockReset();
});

describe("CampaignContentReview loading state", () => {
  it("does not claim there are no drafts when the request fails", async () => {
    request.mockRejectedValueOnce(new Error("Workspace selection is unavailable for this request"));
    render(<CampaignContentReview campaignId="campaign-1" canSubmit={false} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Workspace selection is unavailable for this request");
    expect(screen.queryByText("No drafts submitted yet.")).not.toBeInTheDocument();
  });

  it("shows the empty state only after a successful request", async () => {
    request.mockResolvedValueOnce({ items: [] });
    render(<CampaignContentReview campaignId="campaign-1" canSubmit={false} />);

    expect(await screen.findByText("No drafts submitted yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

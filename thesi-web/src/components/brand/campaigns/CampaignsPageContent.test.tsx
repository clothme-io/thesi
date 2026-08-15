import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (event: React.MouseEvent) => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    authenticatedRequest: vi.fn(),
  }),
}));

const draftCampaign: BrandCampaign = {
  id: "campaign-draft-1",
  name: "Monthly Retainer",
  campaignType: "product",
  type: "mixed_bundle",
  status: "draft",
  startDate: "2026-08-14",
  endDate: "2026-09-14",
  brief: "Brief",
  deliverables: "Videos",
  exampleVideoLinks: [],
  requirements: {
    niches: ["Fitness"],
    minFollowersRange: "5k+",
    location: "US",
    platforms: ["TikTok"],
  },
  files: [],
  payment: { model: "flat_rate", flatRateCents: 0 },
  postToMarketplace: true,
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};

vi.mock("@/lib/brand-campaigns/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brand-campaigns/storage")>();
  return {
    ...actual,
    useBrandCampaigns: () => ({
      data: { campaigns: [draftCampaign] },
      ready: true,
      error: "",
    }),
  };
});

describe("CampaignsPageContent row navigation", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    push.mockReset();
  });

  it("navigates when clicking the campaign row", async () => {
    const { CampaignsPageContent } = await import("./CampaignsPageContent");
    const user = userEvent.setup();
    render(<CampaignsPageContent />);

    await user.click(
      screen.getByRole("link", { name: "Open campaign Monthly Retainer" }),
    );

    expect(push).toHaveBeenCalledWith("/app/campaigns/campaign-draft-1");
  });

  it("shows When published for draft marketplace campaigns", async () => {
    const { CampaignsPageContent } = await import("./CampaignsPageContent");
    render(<CampaignsPageContent />);
    expect(screen.getByText("When published")).toBeInTheDocument();
  });
});

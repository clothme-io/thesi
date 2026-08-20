import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";

const updateCampaign = vi.fn();
const authenticatedRequest = vi.fn().mockResolvedValue({ payouts: [] });

let activeCampaign: BrandCampaign;

function buildCampaign(
  overrides: Partial<BrandCampaign> = {},
): BrandCampaign {
  return {
    id: "campaign-1",
    name: "Summer Drop",
    campaignType: "experience",
    type: "tiktok",
    status: "active",
    startDate: "2026-07-01",
    endDate: "2026-08-01",
    brief: "Brief",
    deliverables: "1 video",
    exampleVideoLinks: [],
    requirements: {
      niches: ["Fitness"],
      minFollowersRange: "10k+",
      location: "Remote",
      platforms: ["TikTok"],
    },
    files: [],
    payment: { model: "flat_rate", flatRateCents: 50000 },
    postToMarketplace: true,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "campaign-1" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    session: {
      user: { fullName: "Northwind Apparel", role: "brand" },
    },
    authenticatedRequest,
    authenticatedBinaryRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/brand-campaigns/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/brand-campaigns/storage")
  >("@/lib/brand-campaigns/storage");
  return {
    ...actual,
    useBrandCampaigns: () => ({
      data: { campaigns: [activeCampaign] },
      ready: true,
      error: "",
      updateCampaign,
      reload: vi.fn(),
      createCampaign: vi.fn(),
      uploadCampaignFile: vi.fn().mockResolvedValue({
        id: "file-1",
        name: "brief.pdf",
        sizeLabel: "1 KB",
      }),
      deleteCampaignFile: vi.fn(),
    }),
  };
});

vi.mock("@/lib/invites/storage", () => ({
  useInvites: () => ({
    data: { invites: campaignInvites },
    ready: true,
    reload: vi.fn(),
  }),
  getInvitesForCampaign: () => campaignInvites,
}));

vi.mock("./InviteCreatorDrawer", () => ({
  InviteCreatorDrawer: () => null,
}));

type TestInvite = {
  id: string;
  campaignId: string;
  creatorId?: string;
  creatorName: string;
  external: boolean;
  status: "sent" | "accepted" | "declined";
};

let campaignInvites: TestInvite[] = [];

describe("CampaignDetailContent lifecycle buttons", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    updateCampaign.mockReset();
    updateCampaign.mockResolvedValue(undefined);
    authenticatedRequest.mockReset();
    authenticatedRequest.mockResolvedValue({ payouts: [] });
    activeCampaign = buildCampaign();
    campaignInvites = [];
  });

  it("pauses an active marketplace campaign", async () => {
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    await user.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({
          status: "paused",
          postToMarketplace: true,
        }),
      );
    });
  });

  it("resumes a paused campaign", async () => {
    activeCampaign = buildCampaign({ status: "paused" });
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pause" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({ status: "active" }),
      );
    });
  });

  it("marks a campaign complete and can unpublish", async () => {
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    await user.click(screen.getByRole("button", { name: "Mark complete" }));
    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({ status: "completed" }),
      );
    });

    updateCampaign.mockClear();
    await user.click(screen.getByRole("button", { name: "Unpublish" }));
    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({ postToMarketplace: false }),
      );
    });
  });

  it("publishes a draft campaign to the marketplace", async () => {
    activeCampaign = buildCampaign({
      status: "draft",
      postToMarketplace: false,
    });
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({
          status: "active",
          postToMarketplace: true,
        }),
      );
    });
  });

  it("saves edited draft fields", async () => {
    activeCampaign = buildCampaign({
      status: "draft",
      name: "Monthly Retainer",
      brief: "Old brief",
      postToMarketplace: true,
    });
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    const nameInput = await screen.findByDisplayValue("Monthly Retainer");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Retainer");

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(updateCampaign).toHaveBeenCalledWith(
        "campaign-1",
        expect.objectContaining({
          status: "draft",
          name: "Updated Retainer",
          brief: "Old brief",
        }),
      );
    });
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
  });

  it("pays an accepted creator invite", async () => {
    campaignInvites = [
      {
        id: "invite-1",
        campaignId: "campaign-1",
        creatorId: "creator-1",
        creatorName: "Alex Creator",
        external: false,
        status: "accepted",
      },
    ];
    authenticatedRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("/payouts") && options?.method !== "POST") {
        return { payouts: [] };
      }
      if (path.includes("/pay-creator")) {
        return {
          id: "payout-1",
          creatorUserId: "creator-1",
          amountCents: 50000,
          status: "transferred",
        };
      }
      return { payouts: [] };
    });

    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    const user = userEvent.setup();
    render(<CampaignDetailContent />);

    expect(await screen.findByText("Alex Creator")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay creator" }));

    await waitFor(() => {
      expect(authenticatedRequest).toHaveBeenCalledWith(
        "/api/campaigns/campaign-1/pay-creator",
        expect.objectContaining({
          method: "POST",
          body: { creatorUserId: "creator-1" },
        }),
      );
    });
  });

  it("hides pay creator until the invite is accepted", async () => {
    campaignInvites = [
      {
        id: "invite-1",
        campaignId: "campaign-1",
        creatorId: "creator-1",
        creatorName: "Alex Creator",
        external: false,
        status: "sent",
      },
    ];
    const { CampaignDetailContent } = await import("./CampaignDetailContent");
    render(<CampaignDetailContent />);

    expect(await screen.findByText("Alex Creator")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pay creator" }),
    ).not.toBeInTheDocument();
  });
});

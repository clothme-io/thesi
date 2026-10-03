import { EMPTY_CREATOR_BENEFITS } from "@/lib/brand-campaigns/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandCampaign, CampaignInput } from "@/lib/brand-campaigns/types";

const createCampaign = vi.fn();
const createDraftCampaign = vi.fn();
const updateCampaign = vi.fn();
const updateDraftCampaign = vi.fn();
const uploadCampaignFile = vi.fn();
const deleteCampaignFile = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
      user: { id: "brand-user-1", fullName: "ClothME", role: "brand" },
    },
    authenticatedRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/brand-campaigns/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/brand-campaigns/storage")
  >("@/lib/brand-campaigns/storage");
  return {
    ...actual,
    useBrandCampaigns: () => ({
      data: { campaigns: [] },
      ready: true,
      error: "",
      createCampaign,
      createDraftCampaign,
      updateCampaign,
      updateDraftCampaign,
      uploadCampaignFile,
      deleteCampaignFile,
    }),
  };
});

vi.mock("./InviteCreatorDrawer", () => ({
  InviteCreatorDrawer: () => null,
}));

function campaignFromInput(input: CampaignInput): BrandCampaign {
  return {
    id: "campaign-new-1",
    name: input.name,
    description: input.description ?? null,
    campaignType: input.campaignType,
    contentTypes: input.contentTypes,
    status: input.status,
    startDate: input.startDate,
    endDate: input.endDate,
    brief: input.brief,
    deliverables: input.deliverables,
    exampleVideoLinks: input.exampleVideoLinks,
    requirements: input.requirements,
    files: [],
    requiredTasks: input.requiredTasks,
    creatorBenefits: {
      ...EMPTY_CREATOR_BENEFITS,
      ...input.creatorBenefits,
    },
    contentRights: input.contentRights,
    productsProvided: input.productsProvided,
    creatorCapacity: input.creatorCapacity,
    creatorDisclosureEnabled: input.creatorDisclosureEnabled,
    postToMarketplace: input.postToMarketplace,
    payment: input.payment,
    createdAt: "2026-10-03T00:00:00.000Z",
    updatedAt: "2026-10-03T00:00:00.000Z",
  };
}

describe("CampaignCreateContent draft save", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createCampaign.mockReset();
    createDraftCampaign.mockReset();
    updateCampaign.mockReset();
    updateDraftCampaign.mockReset();
    uploadCampaignFile.mockReset();
    deleteCampaignFile.mockReset();
    createCampaign.mockImplementation(async (input: CampaignInput) =>
      campaignFromInput(input),
    );
    createDraftCampaign.mockImplementation(async (input: CampaignInput) =>
      campaignFromInput(input),
    );
  });

  it("saves a draft with only a campaign name", async () => {
    const { CampaignCreateContent } = await import("./CampaignCreateContent");
    const user = userEvent.setup();
    render(<CampaignCreateContent />);

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "A");
    await user.click(screen.getAllByRole("button", { name: "Save draft" })[0]);

    await waitFor(() => {
      expect(createDraftCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "A",
          status: "draft",
        }),
      );
    });
    expect(createCampaign).not.toHaveBeenCalled();
    expect(await screen.findByText("Draft saved — A")).toBeInTheDocument();
  });

  it("defaults start date to today and keeps end date one month after start date", async () => {
    const { CampaignCreateContent } = await import("./CampaignCreateContent");
    render(<CampaignCreateContent />);

    const startDate = screen.getByLabelText("Start date");
    const endDate = screen.getByLabelText("End date");
    const today = new Date();
    const todayValue = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    expect(startDate).toHaveValue(todayValue);
    expect(startDate).toHaveAttribute("min", todayValue);
    expect(endDate).toHaveAttribute("readonly");

    fireEvent.change(startDate, { target: { value: "2026-12-10" } });

    expect(startDate).toHaveValue("2026-12-10");
    expect(endDate).toHaveValue("2027-01-10");
  });
});

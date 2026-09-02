import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MarketplaceBrandApplication,
  MarketplaceListing,
} from "@/lib/marketplace/types";

const authenticatedRequest = vi.fn();
const fetchListingApplicationsMock = vi.fn();
const respondToListingApplicationMock = vi.fn();

const listing: MarketplaceListing = {
  id: "listing-1",
  name: "Summer Drop",
  brandName: "Acme",
  ownerUserId: "brand-1",
  campaignId: "campaign-1",
  campaignType: "experience",
  type: "tiktok",
  status: "open",
  startDate: "2026-07-01",
  endDate: "2099-08-01",
  applicationDeadline: "2099-07-01",
  brief: "Brief",
  deliverables: "1 video",
  exampleVideoLinks: [],
  requirements: ["Fitness"],
  files: [],
  payment: { structure: "flat_rate", currency: "USD", flatAmountCents: 50000 },
  location: "Remote",
  remoteOk: true,
  slots: 5,
  applicantsCount: 1,
  postedAt: "2026-07-01T00:00:00.000Z",
};

const pendingApplicant: MarketplaceBrandApplication = {
  id: "app-1",
  listingId: "listing-1",
  pitch: "I am a great fit",
  appliedAt: "2026-07-02T00:00:00.000Z",
  addedToCrm: true,
  status: "pending",
  creatorUserId: "creator-1",
  creatorName: "Alex Creator",
  creatorEmail: "alex@example.com",
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "listing-1" }),
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
  }),
}));

vi.mock("@/lib/marketplace/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/marketplace/storage")>(
    "@/lib/marketplace/storage",
  );
  return {
    ...actual,
    useMarketplace: () => ({
      data: {
        customListings: [listing],
        listings: [listing],
        applications: [],
        crmLinkedListingIds: [],
      },
      ready: true,
      error: "",
      applyToListing: vi.fn(),
      linkListingToCrm: vi.fn(),
      reload: vi.fn(),
    }),
    fetchListingApplications: (...args: unknown[]) =>
      fetchListingApplicationsMock(...args),
    respondToListingApplication: (...args: unknown[]) =>
      respondToListingApplicationMock(...args),
  };
});

vi.mock("@/lib/invites/storage", () => ({
  useInvites: () => ({
    data: { invites: [] },
    ready: true,
    reload: vi.fn(),
  }),
  getInvitesForCampaign: () => [],
}));

vi.mock("@/components/brand/campaigns/InviteCreatorDrawer", () => ({
  InviteCreatorDrawer: () => null,
}));

describe("MarketplaceDetailContent applicant actions", () => {
  let applicants: MarketplaceBrandApplication[];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    applicants = [{ ...pendingApplicant, status: "pending" }];
    fetchListingApplicationsMock.mockReset();
    respondToListingApplicationMock.mockReset();
    fetchListingApplicationsMock.mockImplementation(async () =>
      applicants.map((application) => ({ ...application })),
    );
    respondToListingApplicationMock.mockImplementation(
      async (_request, _listingId, applicationId, decision) => {
        const updated = {
          ...applicants.find((application) => application.id === applicationId)!,
          status: decision as "accepted" | "rejected",
        };
        applicants = applicants.map((application) =>
          application.id === applicationId ? updated : application,
        );
        return updated;
      },
    );
  });

  it("loads applicants and accepts a pending application", async () => {
    const { MarketplaceDetailContent } = await import(
      "./MarketplaceDetailContent"
    );
    const user = userEvent.setup();
    render(<MarketplaceDetailContent />);

    expect(await screen.findByText("Alex Creator")).toBeInTheDocument();
    expect(screen.getByText("I am a great fit")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(respondToListingApplicationMock).toHaveBeenCalledWith(
        authenticatedRequest,
        "listing-1",
        "app-1",
        "accepted",
      );
    });
    expect(await screen.findByText("Application accepted.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Accept" }),
      ).not.toBeInTheDocument();
    });
  });

  it("rejects a pending application", async () => {
    const { MarketplaceDetailContent } = await import(
      "./MarketplaceDetailContent"
    );
    const user = userEvent.setup();
    render(<MarketplaceDetailContent />);

    await screen.findByText("Alex Creator");
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(respondToListingApplicationMock).toHaveBeenCalledWith(
        authenticatedRequest,
        "listing-1",
        "app-1",
        "rejected",
      );
    });
    expect(await screen.findByText("Application rejected.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Rejected")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Reject" }),
      ).not.toBeInTheDocument();
    });
  });

});

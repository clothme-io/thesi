import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreatorLinksPageContent } from "./CreatorLinksPageContent";

const request = vi.fn();
vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({ authenticatedRequest: request }),
}));

afterEach(() => {
  cleanup();
  request.mockReset();
});

it("lists issued sale and install links instead of redirecting away", async () => {
  request.mockResolvedValue({
    enabled: true,
    campaigns: [
      {
        campaignId: "sale",
        name: "Summer shirt",
        productTitle: "Linen shirt",
        productId: "p1",
        commissionType: "percentage_of_sale",
        linkType: "sale",
        url: "https://thesi.test/r/" + "a".repeat(43),
      },
      {
        campaignId: "install",
        name: "App install",
        productTitle: null,
        productId: null,
        commissionType: "fixed_amount_per_install",
        linkType: "install",
        url: "https://thesi.test/i/" + "b".repeat(43),
      },
    ],
  });
  render(<CreatorLinksPageContent />);
  expect(await screen.findByRole("heading", { name: "Summer shirt" })).toBeTruthy();
  expect(screen.getByLabelText("Promote link for Linen shirt")).toHaveValue(
    "https://thesi.test/r/" + "a".repeat(43),
  );
  expect(screen.getByLabelText("App install link")).toHaveValue(
    "https://thesi.test/i/" + "b".repeat(43),
  );
});

it("shows a copiable link for each product under the same campaign", async () => {
  request.mockResolvedValue({
    enabled: true,
    campaigns: [
      {
        campaignId: "summer",
        name: "Summer drop",
        productTitle: "Linen shirt",
        productId: "p1",
        commissionType: "percentage_of_sale",
        linkType: "sale",
        url: "https://thesi.test/r/" + "a".repeat(43),
      },
      {
        campaignId: "summer",
        name: "Summer drop",
        productTitle: "Linen pants",
        productId: "p2",
        commissionType: "percentage_of_sale",
        linkType: "sale",
        url: "https://thesi.test/r/" + "c".repeat(43),
      },
    ],
  });
  render(<CreatorLinksPageContent />);
  expect(
    await screen.findAllByRole("heading", { name: "Summer drop" }),
  ).toHaveLength(1);
  expect(screen.getByLabelText("Promote link for Linen shirt")).toHaveValue(
    "https://thesi.test/r/" + "a".repeat(43),
  );
  expect(screen.getByLabelText("Promote link for Linen pants")).toHaveValue(
    "https://thesi.test/r/" + "c".repeat(43),
  );
});

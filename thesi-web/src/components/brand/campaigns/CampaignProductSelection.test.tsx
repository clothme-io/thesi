import { useState } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  CampaignProductSelection,
  productInput,
  type ProductSelection,
} from "./CampaignProductSelection";
const request = vi.fn();
vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({ authenticatedRequest: request }),
}));
const first = {
  productId: "shirt",
  brandId: "brand",
  vendorId: "vendor",
  workspaceId: "workspace",
  linkId: "link",
  title: "Shirt",
  description: "Linen",
  brandName: "Studio",
  imageUrl: null,
  previewUrl: "https://test/preview",
  verifiedAt: "2026-09-13",
  variants: [
    {
      id: "blue-m",
      color: "Blue",
      size: "M",
      priceCents: 3000,
      currency: "USD",
    },
    {
      id: "blue-l",
      color: "Blue",
      size: "L",
      priceCents: 3500,
      currency: "USD",
    },
  ],
};
const second = {
  ...first,
  productId: "trousers",
  title: "Trousers",
  variants: [
    {
      id: "black-l",
      color: "Black",
      size: "L",
      priceCents: 6000,
      currency: "USD",
    },
  ],
};
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED", "true");
  request.mockReset();
  request.mockResolvedValue({
    enabled: true,
    products: [first, second],
    nextOffset: null,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe("campaign product agreement editor", () => {
  it("selects multiple products and explicit eligible variants without sending client prices", async () => {
    function Form() {
      const [value, setValue] = useState<ProductSelection[]>([]);
      return (
        <>
          <CampaignProductSelection value={value} onChange={setValue} />
          <output data-testid="payload">
            {JSON.stringify(productInput(value))}
          </output>
        </>
      );
    }
    render(<Form />);
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Shirt — Studio" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Trousers — Studio" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Blue / L — $35.00" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Blue / M — $30.00" }),
    ).toBeDisabled();
    expect(JSON.parse(screen.getByTestId("payload").textContent!)).toEqual({
      merchantProducts: [
        { productId: "shirt", variantIds: ["blue-m"] },
        { productId: "trousers", variantIds: ["black-l"] },
      ],
    });
  });
  it("preserves selections during a catalog outage", async () => {
    request.mockRejectedValue(new Error("Catalog unavailable"));
    const changed = vi.fn();
    render(
      <CampaignProductSelection
        initial={[first]}
        value={[{ productId: "shirt", variantIds: ["blue-m"] }]}
        onChange={changed}
      />,
    );
    await screen.findByRole("alert");
    expect(changed).not.toHaveBeenCalled();
    expect(
      screen.getByRole("checkbox", { name: "Shirt — Studio" }),
    ).toBeDisabled();
  });
  it.each([true, false])(
    "keeps accepted prices read-only when feature enabled=%s",
    (enabled) => {
      vi.stubEnv(
        "NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED",
        String(enabled),
      );
      render(
        <CampaignProductSelection
          initial={[first, second]}
          locked
          value={[]}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText("Shirt")).toBeInTheDocument();
      expect(screen.getByText("Trousers")).toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("keeps an existing single-product v2 agreement read-only while selection is paused", () => {
    vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED", "false");
    render(
      <CampaignProductSelection
        initial={[first]}
        value={[{ productId: "shirt", variantIds: ["blue-m"] }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});

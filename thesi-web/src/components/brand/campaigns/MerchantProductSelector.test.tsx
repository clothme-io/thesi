import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MerchantProductSelector } from "./MerchantProductSelector";
import { PromotedProductDetails } from "./PromotedProductDetails";
import { ProductPreviewView } from "@/app/product-preview/ProductPreviewView";
const request = vi.fn();
vi.mock("@/context/AuthProvider", () => ({ useAuth: () => ({ authenticatedRequest: request }) }));
const product = { productId: "product", brandId: "brand", vendorId: "vendor", workspaceId: "workspace", linkId: "link", title: "Linen shirt", description: "A linen shirt", imageUrl: null, brandName: "Studio", previewUrl: "javascript:alert(1)", verifiedAt: "2026-01-01" };
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_PRODUCTS_ENABLED", "true"); request.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe("Merchant product selection", () => {
  it("shows eligible products and submits only the selected product ID", async () => {
    request.mockResolvedValue({ enabled: true, products: [product], nextOffset: null }); const changed = vi.fn();
    render(<MerchantProductSelector value={null} onChange={changed} />);
    await screen.findByRole("option", { name: "Linen shirt — Studio" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "product" } }); expect(changed).toHaveBeenCalledWith("product");
  });
  it("does not drop a previously selected product when loading fails", async () => {
    request.mockRejectedValue(new Error("Connect this brand to Merchant Hub")); const changed = vi.fn();
    render(<MerchantProductSelector value="product" initial={product} onChange={changed} />);
    await screen.findByRole("alert"); expect(changed).not.toHaveBeenCalled(); expect(screen.getByRole("combobox")).toBeDisabled();
  });
  it("keeps published product details read-only and does not reload their snapshot", () => {
    render(<MerchantProductSelector value="product" initial={product} onChange={vi.fn()} locked />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument(); expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "View product demo" })).toHaveAttribute("href", "/product-preview/brand/product");
  });
  it("hides the selector when the API feature is disabled", async () => {
    request.mockResolvedValue({ enabled: false, products: [], nextOffset: null });
    render(<MerchantProductSelector value={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
  });
  it("labels preview links as untracked and ignores arbitrary stored destinations", () => {
    render(<PromotedProductDetails product={product} />);
    expect(screen.getByText(/does not track sales or earn commission/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/product-preview/brand/product");
  });
  it("clearly identifies the sample page and offers no purchase action", () => {
    render(<ProductPreviewView sample product={product} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Linen shirt");
    expect(screen.getByText(/Sample brand and product/)).toBeInTheDocument();
    expect(screen.getByText(/Purchasing is not available/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /buy|checkout/i })).not.toBeInTheDocument();
  });
});

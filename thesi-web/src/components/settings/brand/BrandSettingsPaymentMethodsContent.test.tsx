import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    authenticatedRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/settings/brand-billing-storage", () => ({
  useBrandBilling: () => ({
    data: { paymentMethods: [] },
    ready: true,
    error: "",
    setDefaultPaymentMethod: vi.fn(),
    createSetupIntent: vi.fn(),
    refreshBilling: vi.fn(),
  }),
}));

vi.mock("@/lib/stripe/publishable-key", () => ({
  getStripePublishableKey: () => "",
}));

vi.mock("./AddPaymentMethodModal", () => ({
  AddPaymentMethodModal: () => null,
}));

describe("BrandSettingsPaymentMethodsContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows payment methods as coming soon with card setup disabled", async () => {
    const { BrandSettingsPaymentMethodsContent } = await import(
      "./BrandSettingsPaymentMethodsContent"
    );

    render(<BrandSettingsPaymentMethodsContent />);

    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(
      screen.getByText(/Campaign publishing and creator applications do not charge a card/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Payment methods coming soon" }),
    ).toBeDisabled();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { billingMock, publishableKeyMock } = vi.hoisted(() => ({
  billingMock: {
    data: { paymentMethods: [] },
    ready: true,
    error: "",
    setDefaultPaymentMethod: vi.fn(),
    createSetupIntent: vi.fn(),
    refreshBilling: vi.fn(),
  },
  publishableKeyMock: vi.fn(() => ""),
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    authenticatedRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/settings/brand-billing-storage", () => ({
  useBrandBilling: () => billingMock,
}));

vi.mock("@/lib/stripe/publishable-key", () => ({
  getStripePublishableKey: publishableKeyMock,
}));

vi.mock("./AddPaymentMethodModal", () => ({
  AddPaymentMethodModal: ({ clientSecret }: { clientSecret: string }) => (
    <div role="dialog">Add card modal {clientSecret}</div>
  ),
}));

describe("BrandSettingsPaymentMethodsContent", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    billingMock.data = { paymentMethods: [] };
    billingMock.ready = true;
    billingMock.error = "";
    billingMock.setDefaultPaymentMethod.mockReset();
    billingMock.createSetupIntent.mockReset();
    billingMock.refreshBilling.mockReset();
    publishableKeyMock.mockReset();
    publishableKeyMock.mockReturnValue("");
  });

  it("shows live Stripe card setup and explains missing web configuration", async () => {
    const { BrandSettingsPaymentMethodsContent } = await import(
      "./BrandSettingsPaymentMethodsContent"
    );

    render(<BrandSettingsPaymentMethodsContent />);

    expect(screen.getByText("Stripe card setup")).toBeInTheDocument();
    expect(
      screen.getByText(/saved for off-session campaign funding/),
    ).toBeInTheDocument();
    const addButton = screen.getByRole("button", { name: "+ Add payment method" });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);

    expect(
      await screen.findByText(/Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/),
    ).toBeInTheDocument();
    expect(billingMock.createSetupIntent).not.toHaveBeenCalled();
  });

  it("opens Stripe Elements when setup intent is configured", async () => {
    publishableKeyMock.mockReturnValue("pk_test_123");
    billingMock.createSetupIntent.mockResolvedValue({
      clientSecret: "seti_secret_123",
      setupIntentId: "seti_123",
      stripeConfigured: true,
    });
    const { BrandSettingsPaymentMethodsContent } = await import(
      "./BrandSettingsPaymentMethodsContent"
    );

    render(<BrandSettingsPaymentMethodsContent />);

    fireEvent.click(screen.getByRole("button", { name: "+ Add payment method" }));

    await waitFor(() =>
      expect(billingMock.createSetupIntent).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText("Add card modal seti_secret_123")).toBeInTheDocument();
  });
});

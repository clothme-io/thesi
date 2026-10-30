import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { billingMock } = vi.hoisted(() => ({
  billingMock: {
    data: { paymentMethods: [] },
    ready: true,
    error: "",
    setDefaultPaymentMethod: vi.fn(),
    createSetupIntent: vi.fn(),
    refreshBilling: vi.fn(),
  },
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({
    authenticatedRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/settings/brand-billing-storage", () => ({
  useBrandBilling: () => billingMock,
}));

vi.mock("./AddPaymentMethodModal", () => ({
  AddPaymentMethodModal: ({ clientSecret, publishableKey }: { clientSecret: string; publishableKey: string }) => (
    <div role="dialog">Add card modal {clientSecret} {publishableKey}</div>
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
  });

  it("shows Stripe card setup and explains missing API configuration", async () => {
    billingMock.createSetupIntent.mockResolvedValue({
      clientSecret: null,
      setupIntentId: "seti_local_123",
      stripeConfigured: false,
      publishableKey: null,
    });
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
      await screen.findByText(/Stripe is not configured on the API/),
    ).toBeInTheDocument();
    expect(billingMock.createSetupIntent).toHaveBeenCalledTimes(1);
  });

  it("opens Stripe Elements when setup intent is configured", async () => {
    billingMock.createSetupIntent.mockResolvedValue({
      clientSecret: "seti_secret_123",
      setupIntentId: "seti_123",
      stripeConfigured: true,
      publishableKey: "pk_test_123",
    });
    const { BrandSettingsPaymentMethodsContent } = await import(
      "./BrandSettingsPaymentMethodsContent"
    );

    render(<BrandSettingsPaymentMethodsContent />);

    fireEvent.click(screen.getByRole("button", { name: "+ Add payment method" }));

    await waitFor(() =>
      expect(billingMock.createSetupIntent).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText("Add card modal seti_secret_123 pk_test_123")).toBeInTheDocument();
  });

  it("does not claim the API key is missing when setup returns no client secret", async () => {
    billingMock.createSetupIntent.mockResolvedValue({
      clientSecret: null,
      setupIntentId: "seti_local_123",
      stripeConfigured: true,
      publishableKey: "pk_test_123",
    });
    const { BrandSettingsPaymentMethodsContent } = await import(
      "./BrandSettingsPaymentMethodsContent"
    );

    render(<BrandSettingsPaymentMethodsContent />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add payment method" }));

    expect(await screen.findByText(/could not start card setup/)).toBeInTheDocument();
    expect(screen.queryByText(/STRIPE_SECRET_KEY/)).not.toBeInTheDocument();
  });
});

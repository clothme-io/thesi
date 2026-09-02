import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createInvoice = vi.fn();

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
    authenticatedRequest: vi.fn(),
    authenticatedBinaryRequest: vi.fn(),
  }),
}));

vi.mock("@/lib/creator-crm/storage", () => ({
  useCreatorCrm: () => ({
    ready: true,
    error: "",
    createInvoice,
    updateInvoice: vi.fn(),
    data: {
      brands: [{ id: "brand-1", name: "QA Brand" }],
      jobs: [],
      payments: [],
    },
  }),
}));

describe("InvoicesPageContent field handles", () => {
  afterEach(() => {
    cleanup();
    createInvoice.mockReset();
  });

  it("exposes stable names and submits the selected due date", async () => {
    const { InvoicesPageContent } = await import("./InvoicesPageContent");
    const user = userEvent.setup();
    createInvoice.mockResolvedValue(undefined);

    render(<InvoicesPageContent />);

    await user.click(screen.getByRole("button", { name: "+ New invoice" }));

    const dueDate = screen.getByLabelText("Due date");
    expect(dueDate).toHaveAttribute("name", "invoiceDueDate");
    expect(dueDate).toHaveAttribute("data-testid", "invoice-due-date-input");

    await user.selectOptions(screen.getByLabelText("Brand"), "brand-1");
    await user.type(screen.getByLabelText("Amount (USD)"), "125");
    fireEvent.change(dueDate, { target: { value: "2026-09-30" } });
    await user.click(screen.getByRole("button", { name: "Create invoice" }));

    expect(createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: "brand-1",
        amountCents: 12500,
        dueDate: "2026-09-30",
      }),
    );
  });
});

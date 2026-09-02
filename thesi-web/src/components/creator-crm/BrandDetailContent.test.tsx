import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreatorCrmData } from "@/lib/creator-crm/types";

const authenticatedRequest = vi.fn();
const emptyBrandData: CreatorCrmData = {
  brands: [
    {
      id: "brand-1",
      name: "QA Brand",
      contactName: "QA Contact",
      email: "qa@example.com",
      phone: "",
      website: "",
      relationshipStage: "prospect",
      tags: [],
      notes: "",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
  ],
  people: [],
  deals: [],
  jobs: [],
  contracts: [],
  payments: [],
  calendarEvents: [],
  tasks: [],
  activities: [],
  customObjects: [],
  customFields: [],
  customRecords: [],
  entityFieldValues: [],
  workflows: [],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "brand-1" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/AuthProvider", () => ({
  useAuth: () => ({ authenticatedRequest }),
}));

vi.mock("@/lib/creator-crm/storage", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/creator-crm/storage")
  >("@/lib/creator-crm/storage");

  return {
    ...actual,
    useCreatorCrm: () => ({
      data: emptyBrandData,
      ready: true,
      updateBrandNotes: vi.fn(),
      createBrandPerson: vi.fn(),
      deleteBrandPerson: vi.fn(),
      upsertEntityFieldValues: vi.fn(),
    }),
  };
});

describe("BrandDetailContent empty related tabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows useful empty states for deals, jobs, and payments", async () => {
    const { BrandDetailContent } = await import("./BrandDetailContent");
    const user = userEvent.setup();

    render(<BrandDetailContent />);

    await user.click(screen.getByRole("button", { name: "Deals" }));
    expect(screen.getByText(/No deals yet for QA Brand/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open pipeline →" })).toHaveAttribute(
      "href",
      "/app/crm/pipeline",
    );

    await user.click(screen.getByRole("button", { name: "Jobs" }));
    expect(screen.getByText(/No jobs yet for QA Brand/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open pipeline →" })).toHaveAttribute(
      "href",
      "/app/crm/pipeline",
    );

    await user.click(screen.getByRole("button", { name: "Payments" }));
    expect(screen.getByText(/No payments yet for QA Brand/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open invoices →" })).toHaveAttribute(
      "href",
      "/app/tools/invoices",
    );
  });
});

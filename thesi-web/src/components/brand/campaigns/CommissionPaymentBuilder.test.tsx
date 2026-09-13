import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommissionPaymentBuilder } from "./CommissionPaymentBuilder";
import { CommissionPaymentDetails } from "./CommissionPaymentDetails";
import {
  defaultHybridPaymentForm,
  buildCampaignPayment,
  paymentFormError,
} from "@/lib/brand-campaigns/payment-form";

function Form() {
  const [value, onChange] = useState(defaultHybridPaymentForm);
  const payment = paymentFormError("commission", [], value)
    ? undefined
    : buildCampaignPayment({
        model: "commission",
        flatAmount: "",
        milestoneStructure: "highest_achieved",
        notes: "",
        milestones: [],
        hybrid: value,
      });
  return (
    <>
      <CommissionPaymentBuilder value={value} onChange={onChange} />
      <CommissionPaymentDetails payment={payment?.hybrid} />
    </>
  );
}

describe("commission form and creator terms", () => {
  it("updates the base, rate and calculation basis with labelled controls", () => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText("Base payment per creator (USD)"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Commission rate (%)"), {
      target: { value: "12.25" },
    });
    fireEvent.change(screen.getByLabelText("Commission calculated on"), {
      target: { value: "percentage_of_platform_commission" },
    });
    fireEvent.change(
      screen.getByLabelText("Commission eligibility and settlement terms"),
      { target: { value: "Net revenue after refunds. Paid monthly." } },
    );
    expect(
      screen.getByText(
        "$200.00 base per creator + 12.25% of platform commission from attributed sales",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Attribution window: 30 days/)).toHaveTextContent(
      "Net revenue after refunds. Paid monthly.",
    );
    expect(
      screen.queryByLabelText("Performance milestones"),
    ).not.toBeInTheDocument();
  });
});

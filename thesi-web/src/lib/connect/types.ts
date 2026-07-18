export type ConnectStatus = {
  stripeConfigured: boolean;
  status: "not_started" | "pending" | "complete" | "unavailable";
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  readyForPayouts: boolean;
};

export const CONNECT_STATUS_LABELS: Record<ConnectStatus["status"], string> = {
  not_started: "Not started",
  pending: "Setup incomplete",
  complete: "Ready for payouts",
  unavailable: "Stripe not configured",
};

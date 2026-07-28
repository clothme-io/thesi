import type { InviteStatus } from "./types";

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

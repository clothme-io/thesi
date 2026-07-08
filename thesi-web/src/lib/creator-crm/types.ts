export type DealStage =
  | "lead"
  | "contacted"
  | "pitched"
  | "negotiating"
  | "contract_sent"
  | "won"
  | "lost";

export type JobStatus = "active" | "in_review" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "invoice_sent" | "paid" | "overdue";
export type ContractStatus = "draft" | "sent" | "signed" | "expired";
export type TaskStatus = "pending" | "done";
export type RelationshipStage = "prospect" | "active" | "partner" | "inactive";

export type CalendarEventType =
  | "shoot"
  | "draft_due"
  | "submission"
  | "posting"
  | "campaign_launch"
  | "payment_due";

export type ActivityType =
  | "note_added"
  | "status_changed"
  | "payment_marked_paid"
  | "contract_uploaded"
  | "deliverable_submitted"
  | "deal_moved"
  | "job_created";

export interface Brand {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  relationshipStage: RelationshipStage;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  brandId: string;
  title: string;
  valueCents: number;
  stage: DealStage;
  expectedCloseDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  brandId: string;
  dealId: string;
  title: string;
  deliverables: string;
  deadline: string;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  contractId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  brandId: string;
  jobId?: string;
  title: string;
  status: ContractStatus;
  fileName?: string;
  signedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  brandId: string;
  jobId: string;
  amountCents: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  invoiceNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  brandId?: string;
  jobId?: string;
  title: string;
  type: CalendarEventType;
  date: string;
  notes: string;
}

export interface Task {
  id: string;
  brandId?: string;
  jobId?: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  createdAt: string;
}

export interface Activity {
  id: string;
  brandId?: string;
  jobId?: string;
  dealId?: string;
  type: ActivityType;
  message: string;
  createdAt: string;
}

export interface CreatorCrmData {
  brands: Brand[];
  deals: Deal[];
  jobs: Job[];
  contracts: Contract[];
  payments: Payment[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  activities: Activity[];
}

export const DEAL_STAGES: DealStage[] = [
  "lead",
  "contacted",
  "pitched",
  "negotiating",
  "contract_sent",
  "won",
  "lost",
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  pitched: "Pitched",
  negotiating: "Negotiating",
  contract_sent: "Contract Sent",
  won: "Won",
  lost: "Lost",
};

export const RELATIONSHIP_STAGE_LABELS: Record<RelationshipStage, string> = {
  prospect: "Prospect",
  active: "Active",
  partner: "Partner",
  inactive: "Inactive",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Active",
  in_review: "In Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  invoice_sent: "Invoice Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export const CONTRACT_STATUSES: ContractStatus[] = ["draft", "sent", "signed", "expired"];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  expired: "Expired",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  done: "Done",
};

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

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
  | "job_created"
  | "workflow_ran"
  | "email_received"
  | "email_sent"
  | "meeting_synced";

export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";
export type FieldTargetType = "brand" | "deal" | "job" | "custom_object";
export type WorkflowTriggerType =
  | "deal_stage_changed"
  | "deal_created"
  | "payment_status_changed"
  | "task_created"
  | "custom_record_created";
export type WorkflowActionType =
  | "create_task"
  | "create_activity"
  | "set_entity_field";

export interface CustomObject {
  id: string;
  name: string;
  apiName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomField {
  id: string;
  targetType: FieldTargetType;
  targetObjectId?: string;
  name: string;
  apiName: string;
  fieldType: CustomFieldType;
  options: string[];
  required: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityFieldValues {
  id: string;
  entityType: "brand" | "deal" | "job";
  entityId: string;
  values: Record<string, string | number | boolean | null>;
  updatedAt: string;
}

export interface CustomRecord {
  id: string;
  objectId: string;
  title: string;
  values: Record<string, string | number | boolean | null>;
  brandId?: string;
  dealId?: string;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowAction {
  id: string;
  workflowId: string;
  position: number;
  actionType: WorkflowActionType;
  actionConfig: Record<string, unknown>;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

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

export interface BrandPerson {
  id: string;
  brandId: string;
  name: string;
  email: string;
  phone: string;
  roleTitle: string;
  isPrimary: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  brandId: string;
  primaryContactId?: string;
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
  description?: string;
  sentAt?: string;
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
  body: string;
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
  people: BrandPerson[];
  deals: Deal[];
  jobs: Job[];
  contracts: Contract[];
  payments: Payment[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  activities: Activity[];
  customObjects: CustomObject[];
  customFields: CustomField[];
  customRecords: CustomRecord[];
  entityFieldValues: EntityFieldValues[];
  workflows: Workflow[];
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

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note_added: "Note",
  status_changed: "Status",
  payment_marked_paid: "Payment",
  contract_uploaded: "Contract",
  deliverable_submitted: "Deliverable",
  deal_moved: "Deal",
  job_created: "Job",
  workflow_ran: "Workflow",
  email_received: "Email in",
  email_sent: "Email out",
  meeting_synced: "Meeting",
};

export const WORKFLOW_TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  deal_stage_changed: "Deal stage changed",
  deal_created: "Deal created",
  payment_status_changed: "Payment status changed",
  task_created: "Task created",
  custom_record_created: "Custom record created",
};

export const WORKFLOW_ACTION_LABELS: Record<WorkflowActionType, string> = {
  create_task: "Create task",
  create_activity: "Add activity note",
  set_entity_field: "Set custom field",
};

export const FIELD_TARGET_LABELS: Record<FieldTargetType, string> = {
  brand: "Brand",
  deal: "Deal",
  job: "Job",
  custom_object: "Custom object",
};

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

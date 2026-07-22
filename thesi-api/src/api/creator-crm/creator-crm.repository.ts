export const CREATOR_CRM_REPOSITORY = Symbol('CREATOR_CRM_REPOSITORY');

export type CrmUser = {
  id: string;
  role: string;
  email?: string;
  fullName?: string;
};

export type CrmBrandRecord = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  relationshipStage: 'prospect' | 'active' | 'partner' | 'inactive';
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmDealRecord = {
  id: string;
  brandId: string;
  title: string;
  valueCents: number;
  stage:
    | 'lead'
    | 'contacted'
    | 'pitched'
    | 'negotiating'
    | 'contract_sent'
    | 'won'
    | 'lost';
  expectedCloseDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmJobRecord = {
  id: string;
  brandId: string;
  dealId: string;
  title: string;
  deliverables: string;
  deadline: string;
  status: 'active' | 'in_review' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'invoice_sent' | 'paid' | 'overdue';
  amountCents: number;
  contractId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmContractRecord = {
  id: string;
  brandId: string;
  jobId?: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  fileName?: string;
  storageProvider?: 'local' | 'bunny';
  storageKey?: string;
  contentType?: string;
  sizeBytes?: number;
  signedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmPaymentRecord = {
  id: string;
  brandId: string;
  jobId: string;
  amountCents: number;
  status: 'unpaid' | 'invoice_sent' | 'paid' | 'overdue';
  dueDate: string;
  paidAt?: string;
  invoiceNumber?: string;
  description: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmCalendarEventRecord = {
  id: string;
  brandId?: string;
  jobId?: string;
  title: string;
  type:
    | 'shoot'
    | 'draft_due'
    | 'submission'
    | 'posting'
    | 'campaign_launch'
    | 'payment_due';
  date: string;
  notes: string;
};

export type CrmTaskRecord = {
  id: string;
  brandId?: string;
  jobId?: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'done';
  createdAt: string;
};

export type CrmActivityRecord = {
  id: string;
  brandId?: string;
  jobId?: string;
  dealId?: string;
  type:
    | 'note_added'
    | 'status_changed'
    | 'payment_marked_paid'
    | 'contract_uploaded'
    | 'deliverable_submitted'
    | 'deal_moved'
    | 'job_created';
  message: string;
  createdAt: string;
};

export type CreatorCrmAggregate = {
  brands: CrmBrandRecord[];
  deals: CrmDealRecord[];
  jobs: CrmJobRecord[];
  contracts: CrmContractRecord[];
  payments: CrmPaymentRecord[];
  calendarEvents: CrmCalendarEventRecord[];
  tasks: CrmTaskRecord[];
  activities: CrmActivityRecord[];
};

export type MarketplaceListingForCrm = {
  id: string;
  name: string;
  brandName: string;
  ownerUserId: string;
  type: string;
  applicationDeadline: string;
  brief: string;
  payment: {
    structure: string;
    flatAmountCents?: number;
    milestones?: Array<{ amountCents: number }>;
    royaltyMinimumCents?: number;
    hybridFlatCents?: number;
  };
};

export interface CreatorCrmRepository {
  getUser(userId: string): Promise<CrmUser | null>;
  getAggregate(creatorUserId: string): Promise<CreatorCrmAggregate>;
  findBrandByEmail(
    creatorUserId: string,
    email: string,
  ): Promise<CrmBrandRecord | null>;
  createBrand(input: {
    creatorUserId: string;
    name: string;
    contactName: string;
    email: string;
    phone?: string;
    website?: string;
    relationshipStage?: CrmBrandRecord['relationshipStage'];
    tags?: string[];
    notes?: string;
  }): Promise<CrmBrandRecord>;
  getDeal(creatorUserId: string, dealId: string): Promise<CrmDealRecord | null>;
  updateDealStage(
    creatorUserId: string,
    dealId: string,
    stage: CrmDealRecord['stage'],
  ): Promise<CrmDealRecord | null>;
  getTask(creatorUserId: string, taskId: string): Promise<CrmTaskRecord | null>;
  updateTaskStatus(
    creatorUserId: string,
    taskId: string,
    status: CrmTaskRecord['status'],
  ): Promise<CrmTaskRecord | null>;
  createActivity(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    dealId?: string | null;
    type: CrmActivityRecord['type'];
    message: string;
  }): Promise<CrmActivityRecord>;
  findDealByListing(
    creatorUserId: string,
    listingId: string,
  ): Promise<CrmDealRecord | null>;
  getMarketplaceListing(
    listingId: string,
  ): Promise<MarketplaceListingForCrm | null>;
  createDeal(input: {
    creatorUserId: string;
    brandId: string;
    marketplaceListingId?: string | null;
    title: string;
    valueCents: number;
    stage: CrmDealRecord['stage'];
    expectedCloseDate?: string | null;
    notes?: string;
  }): Promise<CrmDealRecord>;
  getBrand(
    creatorUserId: string,
    brandId: string,
  ): Promise<CrmBrandRecord | null>;
  getJob(creatorUserId: string, jobId: string): Promise<CrmJobRecord | null>;
  getPayment(
    creatorUserId: string,
    paymentId: string,
  ): Promise<CrmPaymentRecord | null>;
  findDealForBrand(
    creatorUserId: string,
    brandId: string,
  ): Promise<CrmDealRecord | null>;
  createJob(input: {
    creatorUserId: string;
    brandId: string;
    dealId: string;
    title: string;
    amountCents: number;
    deadline?: string | null;
    paymentStatus?: CrmJobRecord['paymentStatus'];
    notes?: string;
  }): Promise<CrmJobRecord>;
  updateJobPaymentStatus(
    creatorUserId: string,
    jobId: string,
    paymentStatus: CrmJobRecord['paymentStatus'],
  ): Promise<CrmJobRecord | null>;
  nextInvoiceNumber(creatorUserId: string): Promise<string>;
  createPayment(input: {
    creatorUserId: string;
    brandId: string;
    jobId: string;
    amountCents: number;
    status: CrmPaymentRecord['status'];
    dueDate: string;
    invoiceNumber: string;
    description: string;
    sentAt?: string | null;
    paidAt?: string | null;
  }): Promise<CrmPaymentRecord>;
  updatePayment(
    creatorUserId: string,
    paymentId: string,
    patch: {
      status?: CrmPaymentRecord['status'];
      amountCents?: number;
      dueDate?: string;
      description?: string;
      sentAt?: string | null;
      paidAt?: string | null;
    },
  ): Promise<CrmPaymentRecord | null>;
  updateBrandNotes(
    creatorUserId: string,
    brandId: string,
    notes: string,
  ): Promise<CrmBrandRecord | null>;
  updateJobNotes(
    creatorUserId: string,
    jobId: string,
    notes: string,
  ): Promise<CrmJobRecord | null>;
  createTask(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    dueDate?: string | null;
    status?: CrmTaskRecord['status'];
  }): Promise<CrmTaskRecord>;
  createCalendarEvent(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    type: CrmCalendarEventRecord['type'];
    date: string;
    notes?: string;
  }): Promise<CrmCalendarEventRecord>;
  createContract(input: {
    creatorUserId: string;
    brandId: string;
    jobId?: string | null;
    title: string;
    status?: CrmContractRecord['status'];
    fileName?: string | null;
    storageProvider?: 'local' | 'bunny' | null;
    storageKey?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
    expiresAt?: string | null;
  }): Promise<CrmContractRecord>;
  getContract(
    creatorUserId: string,
    contractId: string,
  ): Promise<CrmContractRecord | null>;
}

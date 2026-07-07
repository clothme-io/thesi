export type ContactStatus = "lead" | "active" | "client" | "inactive";

export interface CrmContact {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  status: ContactStatus;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CrmContactInput = Omit<CrmContact, "id" | "createdAt" | "updatedAt">;

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  lead: "Lead",
  active: "Active",
  client: "Client",
  inactive: "Inactive",
};

export const CONTACT_STATUSES: ContactStatus[] = ["lead", "active", "client", "inactive"];

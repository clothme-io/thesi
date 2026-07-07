import type { CrmContact, CrmContactInput } from "./crm-types";

const STORAGE_KEY = "thesi_crm_contacts";

const SEED_CONTACTS: CrmContact[] = [
  {
    id: "contact-1",
    name: "Sarah Chen",
    email: "sarah@lumibrand.co",
    company: "Lumi Brand",
    phone: "+1 415 555 0142",
    status: "client",
    tags: ["UGC", "Fashion"],
    notes: "Completed 2 campaigns. Prefers milestone payments.",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-15T14:30:00.000Z",
  },
  {
    id: "contact-2",
    name: "Marcus Reid",
    email: "marcus@freshfit.io",
    company: "FreshFit",
    phone: "+1 646 555 0198",
    status: "active",
    tags: ["Lifestyle"],
    notes: "Interested in Q3 product launch content.",
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-20T11:00:00.000Z",
  },
  {
    id: "contact-3",
    name: "Elena Voss",
    email: "elena@northline.app",
    company: "Northline",
    phone: "",
    status: "lead",
    tags: ["Beauty"],
    notes: "Met at creator event. Follow up next week.",
    createdAt: "2026-06-28T16:00:00.000Z",
    updatedAt: "2026-06-28T16:00:00.000Z",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadContacts(): CrmContact[] {
  if (typeof window === "undefined") return SEED_CONTACTS;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONTACTS));
    return SEED_CONTACTS;
  }

  try {
    return JSON.parse(raw) as CrmContact[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONTACTS));
    return SEED_CONTACTS;
  }
}

export function saveContacts(contacts: CrmContact[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function createContact(input: CrmContactInput): CrmContact {
  const timestamp = nowIso();
  return {
    ...input,
    id: generateId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateContact(contacts: CrmContact[], id: string, input: CrmContactInput): CrmContact[] {
  const timestamp = nowIso();
  return contacts.map((contact) =>
    contact.id === id ? { ...input, id, createdAt: contact.createdAt, updatedAt: timestamp } : contact,
  );
}

export function deleteContact(contacts: CrmContact[], id: string): CrmContact[] {
  return contacts.filter((contact) => contact.id !== id);
}

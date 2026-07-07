"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContactStatus, CrmContact, CrmContactInput } from "@/lib/crm-types";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/lib/crm-types";
import {
  createContact,
  deleteContact,
  loadContacts,
  saveContacts,
  updateContact,
} from "@/lib/crm-storage";

const EMPTY_FORM: CrmContactInput = {
  name: "",
  email: "",
  company: "",
  phone: "",
  status: "lead",
  tags: [],
  notes: "",
};

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTags(tags: string[]) {
  return tags.join(", ");
}

interface ContactDrawerProps {
  contact: CrmContact | null;
  mode: "view" | "create" | "edit";
  onClose: () => void;
  onSave: (input: CrmContactInput) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function ContactDrawer({ contact, mode, onClose, onSave, onEdit, onDelete }: ContactDrawerProps) {
  const [form, setForm] = useState<CrmContactInput>(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    if (contact && mode !== "create") {
      setForm({
        name: contact.name,
        email: contact.email,
        company: contact.company,
        phone: contact.phone,
        status: contact.status,
        tags: contact.tags,
        notes: contact.notes,
      });
      setTagsInput(formatTags(contact.tags));
    } else {
      setForm(EMPTY_FORM);
      setTagsInput("");
    }
  }, [contact, mode]);

  const isEditing = mode === "create" || mode === "edit";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      tags: parseTags(tagsInput),
    });
  }

  const title =
    mode === "create" ? "Add contact" : mode === "edit" ? "Edit contact" : contact?.name || "Contact";

  return (
    <>
      <div className="crm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="crm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="crm-drawer-header">
          <h2>{title}</h2>
          <button type="button" className="crm-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="crm-drawer-body">
            <div className="crm-form-field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="crm-form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="crm-form-field">
              <label htmlFor="company">Company</label>
              <input
                id="company"
                value={form.company}
                onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              />
            </div>
            <div className="crm-form-field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="crm-form-field">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value as ContactStatus }))
                }
              >
                {CONTACT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CONTACT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="crm-form-field">
              <label htmlFor="tags">Tags (comma-separated)</label>
              <input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="UGC, Fashion"
              />
            </div>
            <div className="crm-form-field">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="crm-drawer-footer">
              <button type="button" className="crm-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="crm-btn-primary">
                Save contact
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="crm-drawer-body">
              <p>
                <span className={`crm-status crm-status--${contact?.status}`}>
                  {contact ? CONTACT_STATUS_LABELS[contact.status] : ""}
                </span>
              </p>
              <p>
                <strong>Email:</strong> {contact?.email}
              </p>
              <p>
                <strong>Company:</strong> {contact?.company || "—"}
              </p>
              <p>
                <strong>Phone:</strong> {contact?.phone || "—"}
              </p>
              <p>
                <strong>Tags:</strong>
              </p>
              <div className="crm-tags">
                {contact?.tags.length ? (
                  contact.tags.map((tag) => (
                    <span key={tag} className="crm-tag">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="crm-contact-sub">No tags</span>
                )}
              </div>
              <p style={{ marginTop: 20 }}>
                <strong>Notes</strong>
              </p>
              <p className="crm-contact-sub">{contact?.notes || "No notes yet."}</p>
            </div>
            <div className="crm-drawer-footer">
              {onDelete && (
                <button type="button" className="crm-btn-danger" onClick={onDelete}>
                  Delete
                </button>
              )}
              <button type="button" className="crm-btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="crm-btn-primary" onClick={onEdit}>
                Edit
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export function CrmPageContent() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "create" | "edit" | null>(null);

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const matchesQuery =
        !query ||
        contact.name.toLowerCase().includes(query) ||
        contact.email.toLowerCase().includes(query) ||
        contact.company.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [contacts, search, statusFilter]);

  const stats = useMemo(() => {
    return CONTACT_STATUSES.reduce(
      (acc, status) => {
        acc[status] = contacts.filter((contact) => contact.status === status).length;
        return acc;
      },
      {} as Record<ContactStatus, number>,
    );
  }, [contacts]);

  function persist(next: CrmContact[]) {
    setContacts(next);
    saveContacts(next);
  }

  function openCreate() {
    setSelected(null);
    setDrawerMode("create");
  }

  function openView(contact: CrmContact) {
    setSelected(contact);
    setDrawerMode("view");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelected(null);
  }

  function handleSave(input: CrmContactInput) {
    if (drawerMode === "create") {
      persist([createContact(input), ...contacts]);
      closeDrawer();
      return;
    }

    if (drawerMode === "edit" && selected) {
      persist(updateContact(contacts, selected.id, input));
      closeDrawer();
    }
  }

  function handleEdit() {
    setDrawerMode("edit");
  }

  function handleDelete() {
    if (!selected) return;
    persist(deleteContact(contacts, selected.id));
    closeDrawer();
  }

  return (
    <>
      <header className="app-topbar">
        <h1>CRM</h1>
        <button type="button" className="crm-btn-primary" onClick={openCreate}>
          + Add contact
        </button>
      </header>

      <div className="app-content">
        <div className="crm-stats">
          {CONTACT_STATUSES.map((status) => (
            <div key={status} className="crm-stat">
              <span>{CONTACT_STATUS_LABELS[status]}</span>
              <strong>{stats[status]}</strong>
            </div>
          ))}
        </div>

        <div className="crm-toolbar">
          <div className="crm-toolbar-left">
            <input
              className="crm-search"
              type="search"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="crm-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ContactStatus | "all")}
            >
              <option value="all">All statuses</option>
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CONTACT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="crm-table-wrap">
          {filtered.length === 0 ? (
            <div className="crm-empty">No contacts match your search.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr key={contact.id} onClick={() => openView(contact)}>
                    <td>
                      <span className="crm-contact-name">{contact.name}</span>
                      <span className="crm-contact-sub">
                        {contact.company || contact.email}
                      </span>
                    </td>
                    <td>
                      <span className={`crm-status crm-status--${contact.status}`}>
                        {CONTACT_STATUS_LABELS[contact.status]}
                      </span>
                    </td>
                    <td>
                      <div className="crm-tags">
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="crm-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{new Date(contact.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {drawerMode && (
        <ContactDrawer
          contact={selected}
          mode={drawerMode === "view" ? "view" : drawerMode === "edit" ? "edit" : "create"}
          onClose={closeDrawer}
          onSave={handleSave}
          onEdit={handleEdit}
          onDelete={drawerMode === "view" ? handleDelete : undefined}
        />
      )}
    </>
  );
}

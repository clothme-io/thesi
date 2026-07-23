"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCreatorCrm,
  getBrandById,
  getDealsForBrand,
  getJobsForBrand,
  getPaymentsForBrand,
  getContractsForBrand,
  getActivitiesForBrand,
  getPeopleForBrand,
} from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  formatMoney,
  RELATIONSHIP_STAGE_LABELS,
  DEAL_STAGE_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
} from "@/lib/creator-crm/types";
import { ActivityTimeline } from "./ActivityTimeline";
import { CustomFieldsEditor } from "./CustomFieldsEditor";

const TABS = [
  "Overview",
  "People",
  "Deals",
  "Jobs",
  "Payments",
  "Notes",
  "Files",
  "Messages",
] as const;

export function BrandDetailContent() {
  const params = useParams();
  const brandId = params.id as string;
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    updateBrandNotes,
    createBrandPerson,
    deleteBrandPerson,
    upsertEntityFieldValues,
  } = useCreatorCrm(authenticatedRequest);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [personPrimary, setPersonPrimary] = useState(false);
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState("");

  if (!ready) return null;

  const brand = getBrandById(data, brandId);
  if (!brand) {
    return (
      <div className="app-content">
        <p>
          Brand not found. <Link href={CRM_ROUTES.brands}>Back to brands</Link>
        </p>
      </div>
    );
  }

  const deals = getDealsForBrand(data, brandId);
  const jobs = getJobsForBrand(data, brandId);
  const payments = getPaymentsForBrand(data, brandId);
  const contracts = getContractsForBrand(data, brandId);
  const activities = getActivitiesForBrand(data, brandId);
  const people = getPeopleForBrand(data, brandId);

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link
            href={CRM_ROUTES.brands}
            className="auth-link"
            style={{ fontSize: 13 }}
          >
            ← Brands
          </Link>
          <h1 style={{ marginTop: 4 }}>{brand.name}</h1>
        </div>
        <span className="crm-status crm-status--active">
          {RELATIONSHIP_STAGE_LABELS[brand.relationshipStage]}
        </span>
      </header>

      <div className="app-content">
        <div className="crm-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`crm-tab ${tab === t ? "crm-tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Overview" && (
          <div className="crm-detail-grid">
            <div className="crm-detail-panel">
              <h3>Account contact</h3>
              <div className="crm-meta-row">
                <span>Contact</span>
                <span>{brand.contactName}</span>
              </div>
              <div className="crm-meta-row">
                <span>Email</span>
                <span>{brand.email}</span>
              </div>
              <div className="crm-meta-row">
                <span>Phone</span>
                <span>{brand.phone || "—"}</span>
              </div>
              <div className="crm-meta-row">
                <span>Website</span>
                <span>{brand.website || "—"}</span>
              </div>
              <h3 style={{ marginTop: 24 }}>People</h3>
              {people.length === 0 ? (
                <p className="crm-contact-sub">
                  No people yet. Add contacts on the People tab.
                </p>
              ) : (
                people.slice(0, 4).map((person) => (
                  <div key={person.id} className="crm-meta-row">
                    <span>
                      {person.name}
                      {person.isPrimary ? " · Primary" : ""}
                    </span>
                    <span>{person.roleTitle || person.email || "—"}</span>
                  </div>
                ))
              )}
              <h3 style={{ marginTop: 24 }}>Active deals</h3>
              {deals
                .filter((d) => !["won", "lost"].includes(d.stage))
                .map((deal) => (
                  <div key={deal.id} className="crm-meta-row">
                    <span>{deal.title}</span>
                    <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
                  </div>
                ))}
              <h3 style={{ marginTop: 24 }}>Past jobs</h3>
              {jobs.map((job) => (
                <div key={job.id} className="crm-meta-row">
                  <Link href={CRM_ROUTES.job(job.id)}>{job.title}</Link>
                  <span>{JOB_STATUS_LABELS[job.status]}</span>
                </div>
              ))}
            </div>
            <CustomFieldsEditor
              fields={data.customFields.filter(
                (field) => field.targetType === "brand",
              )}
              values={
                data.entityFieldValues.find(
                  (row) =>
                    row.entityType === "brand" && row.entityId === brand.id,
                )?.values ?? {}
              }
              onSave={async (values) => {
                await upsertEntityFieldValues({
                  entityType: "brand",
                  entityId: brand.id,
                  values,
                });
              }}
            />
            <ActivityTimeline activities={activities} />
          </div>
        )}

        {tab === "People" && (
          <div className="crm-detail-panel">
            <h3>People at {brand.name}</h3>
            <p className="crm-contact-sub" style={{ marginBottom: 16 }}>
              Optional contacts separate from the brand account email.
            </p>
            <div className="crm-people-list">
              {people.length === 0 ? (
                <p className="crm-contact-sub">No people added yet.</p>
              ) : (
                people.map((person) => (
                  <div key={person.id} className="crm-person-card">
                    <strong>
                      {person.name}
                      {person.isPrimary ? " · Primary" : ""}
                    </strong>
                    <span className="crm-contact-sub">
                      {[person.roleTitle, person.email, person.phone]
                        .filter(Boolean)
                        .join(" · ") || "No details"}
                    </span>
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="crm-btn-secondary"
                        onClick={() => {
                          setPersonError("");
                          void deleteBrandPerson(person.id).catch(
                            (requestError) => {
                              setPersonError(
                                requestError instanceof Error
                                  ? requestError.message
                                  : "Could not remove person",
                              );
                            },
                          );
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <h3 style={{ marginTop: 28 }}>Add person</h3>
            <label className="crm-form-field">
              <span>Name</span>
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Jordan Lee"
              />
            </label>
            <label className="crm-form-field">
              <span>Email</span>
              <input
                value={personEmail}
                onChange={(e) => setPersonEmail(e.target.value)}
                placeholder="jordan@brand.com"
              />
            </label>
            <label className="crm-form-field">
              <span>Role</span>
              <input
                value={personRole}
                onChange={(e) => setPersonRole(e.target.value)}
                placeholder="Marketing manager"
              />
            </label>
            <label className="settings-toggle">
              <span className="settings-toggle-copy">
                <strong>Primary contact</strong>
                <span>Prefer this person on new deals.</span>
              </span>
              <input
                type="checkbox"
                checked={personPrimary}
                onChange={(e) => setPersonPrimary(e.target.checked)}
              />
            </label>
            {personError && (
              <p className="workspace-hint" style={{ marginBottom: 8 }}>
                {personError}
              </p>
            )}
            <button
              type="button"
              className="crm-btn-primary"
              disabled={!personName.trim() || personSaving}
              onClick={() => {
                setPersonSaving(true);
                setPersonError("");
                void createBrandPerson(brand.id, {
                  name: personName.trim(),
                  ...(personEmail.trim() ? { email: personEmail.trim() } : {}),
                  ...(personRole.trim() ? { roleTitle: personRole.trim() } : {}),
                  isPrimary: personPrimary,
                })
                  .then(() => {
                    setPersonName("");
                    setPersonEmail("");
                    setPersonRole("");
                    setPersonPrimary(false);
                  })
                  .catch((requestError) => {
                    setPersonError(
                      requestError instanceof Error
                        ? requestError.message
                        : "Could not add person",
                    );
                  })
                  .finally(() => setPersonSaving(false));
              }}
            >
              {personSaving ? "Saving…" : "Add person"}
            </button>
          </div>
        )}

        {tab === "Deals" && (
          <div className="crm-detail-panel">
            {deals.map((deal) => {
              const contact = deal.primaryContactId
                ? people.find((p) => p.id === deal.primaryContactId)
                : undefined;
              return (
                <div key={deal.id} className="crm-meta-row">
                  <span>
                    {deal.title} · {formatMoney(deal.valueCents)}
                    {contact ? ` · ${contact.name}` : ""}
                    {deal.expectedCloseDate
                      ? ` · Close ${deal.expectedCloseDate}`
                      : ""}
                  </span>
                  <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "Jobs" && (
          <div className="crm-detail-panel">
            {jobs.map((job) => (
              <div key={job.id} className="crm-meta-row">
                <span>
                  <Link href={CRM_ROUTES.job(job.id)}>{job.title}</Link>
                  {" · due "}
                  {job.deadline}
                </span>
                <span>{JOB_STATUS_LABELS[job.status]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Payments" && (
          <div className="crm-detail-panel">
            {payments.map((payment) => (
              <div key={payment.id} className="crm-meta-row">
                <span>
                  {formatMoney(payment.amountCents)} ·{" "}
                  {payment.invoiceNumber || "No invoice #"}
                </span>
                <span>{PAYMENT_STATUS_LABELS[payment.status]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Notes" && (
          <div className="crm-detail-panel">
            <label className="crm-form-field">
              <span>Brand notes</span>
              <textarea
                rows={8}
                value={notesDraft ?? brand.notes}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add notes about this brand relationship…"
              />
            </label>
            {notesError && (
              <p className="workspace-hint" style={{ marginBottom: 8 }}>
                {notesError}
              </p>
            )}
            <button
              type="button"
              className="crm-btn-primary"
              disabled={
                notesSaving || (notesDraft ?? brand.notes) === brand.notes
              }
              onClick={() => {
                const nextNotes = notesDraft ?? brand.notes;
                setNotesSaving(true);
                setNotesError("");
                void updateBrandNotes(brand.id, nextNotes)
                  .then(() => setNotesDraft(null))
                  .catch((requestError) => {
                    setNotesError(
                      requestError instanceof Error
                        ? requestError.message
                        : "Could not save notes",
                    );
                  })
                  .finally(() => setNotesSaving(false));
              }}
            >
              {notesSaving ? "Saving…" : "Save notes"}
            </button>
          </div>
        )}

        {tab === "Files" && (
          <div className="crm-detail-panel">
            {contracts.length === 0 ? (
              <p className="crm-contact-sub">No files uploaded yet.</p>
            ) : (
              contracts.map((contract) => (
                <div key={contract.id} className="crm-meta-row">
                  <span>{contract.fileName || contract.title}</span>
                  <span>{CONTRACT_STATUS_LABELS[contract.status]}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Messages" && (
          <div className="crm-detail-panel">
            <p className="crm-contact-sub" style={{ marginBottom: 12 }}>
              View and reply to messages with {brand.name} in your inbox.
            </p>
            <Link
              href={`/app/inbox?brand=${brand.id}`}
              className="crm-btn-primary"
              style={{ display: "inline-block" }}
            >
              Open inbox thread →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

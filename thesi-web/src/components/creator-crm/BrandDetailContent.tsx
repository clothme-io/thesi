"use client";

import { useState } from "react";
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
} from "@/lib/creator-crm/storage";
import {
  formatMoney,
  RELATIONSHIP_STAGE_LABELS,
  DEAL_STAGE_LABELS,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
} from "@/lib/creator-crm/types";

const TABS = ["Overview", "Deals", "Jobs", "Payments", "Notes", "Files", "Messages"] as const;

export function BrandDetailContent() {
  const params = useParams();
  const brandId = params.id as string;
  const { data, ready } = useCreatorCrm();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  if (!ready) return null;

  const brand = getBrandById(data, brandId);
  if (!brand) {
    return (
      <div className="app-content">
        <p>Brand not found. <Link href="/app/brands">Back to brands</Link></p>
      </div>
    );
  }

  const deals = getDealsForBrand(data, brandId);
  const jobs = getJobsForBrand(data, brandId);
  const payments = getPaymentsForBrand(data, brandId);
  const contracts = getContractsForBrand(data, brandId);
  const activities = getActivitiesForBrand(data, brandId);

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href="/app/brands" className="auth-link" style={{ fontSize: 13 }}>← Brands</Link>
          <h1 style={{ marginTop: 4 }}>{brand.name}</h1>
        </div>
        <span className={`crm-status crm-status--active`}>
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
              <h3>Contact info</h3>
              <div className="crm-meta-row"><span>Contact</span><span>{brand.contactName}</span></div>
              <div className="crm-meta-row"><span>Email</span><span>{brand.email}</span></div>
              <div className="crm-meta-row"><span>Phone</span><span>{brand.phone || "—"}</span></div>
              <div className="crm-meta-row"><span>Website</span><span>{brand.website || "—"}</span></div>
              <h3 style={{ marginTop: 24 }}>Active deals</h3>
              {deals.filter((d) => !["won", "lost"].includes(d.stage)).map((deal) => (
                <div key={deal.id} className="crm-meta-row">
                  <span>{deal.title}</span>
                  <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
                </div>
              ))}
              <h3 style={{ marginTop: 24 }}>Past jobs</h3>
              {jobs.map((job) => (
                <div key={job.id} className="crm-meta-row">
                  <span>{job.title}</span>
                  <span>{JOB_STATUS_LABELS[job.status]}</span>
                </div>
              ))}
            </div>
            <div className="crm-detail-panel">
              <h3>Activity timeline</h3>
              {activities.map((activity) => (
                <div key={activity.id} className="crm-activity-item">
                  <strong>{activity.message}</strong>
                  <span>{new Date(activity.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Deals" && (
          <div className="crm-detail-panel">
            {deals.map((deal) => (
              <div key={deal.id} className="crm-meta-row">
                <span>{deal.title} · {formatMoney(deal.valueCents)}</span>
                <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Jobs" && (
          <div className="crm-detail-panel">
            {jobs.map((job) => (
              <div key={job.id} className="crm-meta-row">
                <span>{job.title} · due {job.deadline}</span>
                <span>{JOB_STATUS_LABELS[job.status]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Payments" && (
          <div className="crm-detail-panel">
            {payments.map((payment) => (
              <div key={payment.id} className="crm-meta-row">
                <span>{formatMoney(payment.amountCents)} · {payment.invoiceNumber || "No invoice #"}</span>
                <span>{PAYMENT_STATUS_LABELS[payment.status]}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "Notes" && (
          <div className="crm-detail-panel">
            <p>{brand.notes || "No notes yet."}</p>
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
            <p className="crm-contact-sub">Inbox integration coming soon. Messages with {brand.name} will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}

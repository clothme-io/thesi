"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCreatorCrm,
  getJobById,
  getBrandById,
  getDealById,
  getContractById,
  getPaymentsForJob,
  getTasksForJob,
  getCalendarEventsForJob,
  getActivitiesForJob,
} from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  formatMoney,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/creator-crm/types";

export function JobDetailContent() {
  const params = useParams();
  const jobId = params.id as string;
  const { data, ready } = useCreatorCrm();

  if (!ready) return null;

  const job = getJobById(data, jobId);
  if (!job) {
    return (
      <div className="app-content">
        <p>
          Job not found. <Link href={CRM_ROUTES.jobs}>Back to jobs</Link>
        </p>
      </div>
    );
  }

  const brand = getBrandById(data, job.brandId);
  const deal = getDealById(data, job.dealId);
  const contract = job.contractId ? getContractById(data, job.contractId) : undefined;
  const payments = getPaymentsForJob(data, jobId);
  const tasks = getTasksForJob(data, jobId);
  const events = getCalendarEventsForJob(data, jobId);
  const activities = getActivitiesForJob(data, jobId);

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href={CRM_ROUTES.jobs} className="auth-link" style={{ fontSize: 13 }}>
            ← Jobs
          </Link>
          <h1 style={{ marginTop: 4 }}>{job.title}</h1>
        </div>
        <span className={`crm-status crm-status--${job.status === "completed" ? "client" : "active"}`}>
          {JOB_STATUS_LABELS[job.status]}
        </span>
      </header>

      <div className="app-content">
        <div className="crm-detail-grid">
          <div className="crm-detail-panel">
            <h3>Job details</h3>
            <div className="crm-meta-row">
              <span>Brand</span>
              <span>
                {brand ? (
                  <Link href={CRM_ROUTES.brand(brand.id)}>{brand.name}</Link>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="crm-meta-row">
              <span>Deliverables</span>
              <span>{job.deliverables}</span>
            </div>
            <div className="crm-meta-row">
              <span>Deadline</span>
              <span>{job.deadline}</span>
            </div>
            <div className="crm-meta-row">
              <span>Amount</span>
              <span className="crm-money">{formatMoney(job.amountCents)}</span>
            </div>
            <div className="crm-meta-row">
              <span>Payment</span>
              <span>{PAYMENT_STATUS_LABELS[job.paymentStatus]}</span>
            </div>
            {deal && (
              <div className="crm-meta-row">
                <span>Source deal</span>
                <span>{deal.title}</span>
              </div>
            )}

            <h3 style={{ marginTop: 24 }}>Contract</h3>
            {contract ? (
              <>
                <div className="crm-meta-row">
                  <span>{contract.title}</span>
                  <span>{CONTRACT_STATUS_LABELS[contract.status]}</span>
                </div>
                <div className="crm-meta-row">
                  <span>File</span>
                  <span>{contract.fileName || "No file attached"}</span>
                </div>
                {contract.signedAt && (
                  <div className="crm-meta-row">
                    <span>Signed</span>
                    <span>{contract.signedAt}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="crm-contact-sub">No contract linked to this job.</p>
            )}

            <h3 style={{ marginTop: 24 }}>Payments</h3>
            {payments.length === 0 ? (
              <p className="crm-contact-sub">No payments recorded.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="crm-meta-row">
                  <span>
                    {payment.invoiceNumber || "Invoice"} · {formatMoney(payment.amountCents)}
                  </span>
                  <span>{PAYMENT_STATUS_LABELS[payment.status]}</span>
                </div>
              ))
            )}

            <h3 style={{ marginTop: 24 }}>Notes</h3>
            <p>{job.notes || "No notes yet."}</p>
          </div>

          <div>
            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Tasks</h3>
              {tasks.length === 0 ? (
                <p className="crm-contact-sub">No tasks for this job.</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="crm-meta-row">
                    <span>{task.title}</span>
                    <span>
                      {task.dueDate} · {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Calendar</h3>
              {events.length === 0 ? (
                <p className="crm-contact-sub">No scheduled events.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="crm-meta-row">
                    <span>{event.title}</span>
                    <span>{event.date}</span>
                  </div>
                ))
              )}
            </div>

            <div className="crm-detail-panel">
              <h3>Activity</h3>
              {activities.length === 0 ? (
                <p className="crm-contact-sub">No activity yet.</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="crm-activity-item">
                    <strong>{activity.message}</strong>
                    <span>{new Date(activity.createdAt).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

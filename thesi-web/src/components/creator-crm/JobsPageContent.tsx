"use client";

import Link from "next/link";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { formatMoney, JOB_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/creator-crm/types";

export function JobsPageContent() {
  const { data, ready } = useCreatorCrm();
  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Jobs</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Won deals become active jobs</span>
      </header>

      <div className="app-content">
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Brand</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => {
                const brand = data.brands.find((b) => b.id === job.brandId);
                return (
                  <tr key={job.id} className="crm-table-row-link">
                    <td>
                      <Link href={CRM_ROUTES.job(job.id)} className="crm-table-link">
                        <span className="crm-contact-name">{job.title}</span>
                        <span className="crm-contact-sub">{job.deliverables}</span>
                      </Link>
                    </td>
                    <td>
                      <Link href={CRM_ROUTES.brand(job.brandId)}>{brand?.name}</Link>
                    </td>
                    <td>{job.deadline}</td>
                    <td>{JOB_STATUS_LABELS[job.status]}</td>
                    <td>{PAYMENT_STATUS_LABELS[job.paymentStatus]}</td>
                    <td className="crm-money">{formatMoney(job.amountCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

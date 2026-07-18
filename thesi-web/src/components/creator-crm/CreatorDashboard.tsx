"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm, getDashboardMetrics } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { formatMoney, DEAL_STAGE_LABELS } from "@/lib/creator-crm/types";

export function CreatorDashboard() {
  const { authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  if (!ready) return null;

  const metrics = getDashboardMetrics(data);

  return (
    <>
      <header className="app-topbar">
        <h1>Dashboard</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>Creator dashboard</span>
      </header>

      <div className="app-content">
        <div className="crm-dashboard-grid">
          <div className="app-stat-card">
            <span>Active jobs</span>
            <strong>{metrics.activeJobs.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Upcoming deadlines</span>
            <strong>{metrics.upcomingDeadlines}</strong>
          </div>
          <div className="app-stat-card">
            <span>Overdue payments</span>
            <strong className="crm-money--overdue">{metrics.overduePayments.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Deals in pipeline</span>
            <strong>{metrics.pipelineDeals.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Expected revenue (pipeline)</span>
            <strong>{formatMoney(metrics.expectedRevenue)}</strong>
          </div>
          <div className="app-stat-card">
            <span>Tasks due today</span>
            <strong>{metrics.tasksDueToday.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Content scheduled this week</span>
            <strong>{metrics.contentThisWeek.length}</strong>
          </div>
        </div>

        <div className="crm-dashboard-list">
          <section className="crm-list-card">
            <h3>Active jobs</h3>
            {metrics.activeJobs.length === 0 ? (
              <p className="crm-contact-sub">No active jobs</p>
            ) : (
              metrics.activeJobs.map((job) => {
                const brand = data.brands.find((b) => b.id === job.brandId);
                return (
                  <div key={job.id} className="crm-list-item">
                    <span>
                      <Link href={CRM_ROUTES.job(job.id)}>{job.title}</Link>
                      <span className="crm-contact-sub"> · {brand?.name}</span>
                    </span>
                    <span>{job.deadline}</span>
                  </div>
                );
              })
            )}
          </section>

          <section className="crm-list-card">
            <h3>Overdue payments</h3>
            {metrics.overduePayments.length === 0 ? (
              <p className="crm-contact-sub">All caught up</p>
            ) : (
              metrics.overduePayments.map((payment) => {
                const brand = data.brands.find((b) => b.id === payment.brandId);
                return (
                  <div key={payment.id} className="crm-list-item">
                    <span>
                      {brand?.name} · <span className="crm-money--overdue">{formatMoney(payment.amountCents)}</span>
                    </span>
                    <span>Due {payment.dueDate}</span>
                  </div>
                );
              })
            )}
          </section>

          <section className="crm-list-card">
            <h3>Deals in pipeline</h3>
            {metrics.pipelineDeals.slice(0, 5).map((deal) => {
              const brand = data.brands.find((b) => b.id === deal.brandId);
              return (
                <div key={deal.id} className="crm-list-item">
                  <span>
                    {deal.title} · {brand?.name}
                  </span>
                  <span>{DEAL_STAGE_LABELS[deal.stage]}</span>
                </div>
              );
            })}
            <Link href={CRM_ROUTES.pipeline} className="auth-link" style={{ display: "inline-block", marginTop: 12 }}>
              View pipeline →
            </Link>
          </section>

          <section className="crm-list-card">
            <h3>Tasks due today</h3>
            {metrics.tasksDueToday.length === 0 ? (
              <p className="crm-contact-sub">No tasks due today</p>
            ) : (
              metrics.tasksDueToday.map((task) => (
                <div key={task.id} className="crm-list-item">
                  <span>{task.title}</span>
                  <span>{task.dueDate}</span>
                </div>
              ))
            )}
            <Link href={CRM_ROUTES.tasks} className="auth-link" style={{ display: "inline-block", marginTop: 12 }}>
              View all tasks →
            </Link>
          </section>

          <section className="crm-list-card">
            <h3>Content this week</h3>
            {metrics.contentThisWeek.map((event) => (
              <div key={event.id} className="crm-list-item">
                <span>{event.title}</span>
                <span>{event.date}</span>
              </div>
            ))}
            <Link href={CRM_ROUTES.calendar} className="auth-link" style={{ display: "inline-block", marginTop: 12 }}>
              Open calendar →
            </Link>
          </section>

          <section className="crm-list-card">
            <h3>Recent activity</h3>
            {data.activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="crm-activity-item">
                <strong>{activity.message}</strong>
                <span>{new Date(activity.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

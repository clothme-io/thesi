"use client";

import Link from "next/link";
import {
  ACTIVITY_TYPE_LABELS,
  formatRelativeTime,
  type Activity,
  type ActivityType,
} from "@/lib/creator-crm/types";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

const INITIAL_LIMIT = 20;

export function ActivityTimeline({
  activities,
  title = "Activity timeline",
}: {
  activities: Activity[];
  title?: string;
}) {
  const sorted = [...activities].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const visible = sorted.slice(0, INITIAL_LIMIT);
  const remaining = sorted.length - visible.length;

  return (
    <div className="crm-detail-panel">
      <h3>{title}</h3>
      {visible.length === 0 ? (
        <p className="crm-contact-sub">No activity yet.</p>
      ) : (
        visible.map((activity) => {
          const typeLabel =
            ACTIVITY_TYPE_LABELS[activity.type as ActivityType] ||
            activity.type;
          return (
            <div key={activity.id} className="crm-activity-item">
              <div className="crm-activity-item-top">
                <span className="crm-activity-type">{typeLabel}</span>
                <span
                  className="crm-activity-time"
                  title={new Date(activity.createdAt).toLocaleString()}
                >
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </div>
              <strong>{activity.message}</strong>
              <div className="crm-activity-links">
                {activity.jobId ? (
                  <Link href={CRM_ROUTES.job(activity.jobId)}>View job</Link>
                ) : null}
                {activity.dealId && !activity.jobId ? (
                  <Link href={CRM_ROUTES.pipeline}>View pipeline</Link>
                ) : null}
              </div>
            </div>
          );
        })
      )}
      {remaining > 0 ? (
        <p className="crm-contact-sub" style={{ marginTop: 12 }}>
          Showing latest {INITIAL_LIMIT}. {remaining} older events not shown.
        </p>
      ) : null}
    </div>
  );
}

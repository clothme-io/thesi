"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { AddCalendarEventDrawer } from "./AddCalendarEventDrawer";

const TYPE_LABELS: Record<string, string> = {
  shoot: "Shoot",
  draft_due: "Draft due",
  submission: "Submission",
  posting: "Posting",
  campaign_launch: "Campaign launch",
  payment_due: "Payment due",
};

export function CalendarPageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, createCalendarEvent, error } =
    useCreatorCrm(authenticatedRequest);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!ready) return null;

  const sorted = [...data.calendarEvents].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return (
    <>
      <header className="app-topbar">
        <h1>Content Calendar</h1>
        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => setDrawerOpen(true)}
        >
          + Add event
        </button>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        {sorted.length === 0 ? (
          <p className="crm-contact-sub">No calendar events yet.</p>
        ) : (
          <div className="crm-calendar-grid">
            {sorted.map((event) => {
              const brand = event.brandId
                ? data.brands.find((b) => b.id === event.brandId)
                : undefined;
              const date = new Date(event.date + "T12:00:00");
              return (
                <div key={event.id} className="crm-calendar-item">
                  <div className="crm-calendar-date">
                    {date.getDate()}
                    <small>
                      {date.toLocaleString("en-US", { month: "short" })}
                    </small>
                  </div>
                  <div>
                    <strong>{event.title}</strong>
                    <p className="crm-contact-sub">
                      {TYPE_LABELS[event.type] || event.type}
                      {brand ? ` · ${brand.name}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddCalendarEventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        brands={data.brands}
        jobs={data.jobs}
        onSubmit={async (input) => {
          setActionError("");
          try {
            await createCalendarEvent(input);
          } catch (requestError) {
            setActionError(
              requestError instanceof Error
                ? requestError.message
                : "Could not create event",
            );
            throw requestError;
          }
        }}
      />
    </>
  );
}

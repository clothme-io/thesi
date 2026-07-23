"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCrmCollab } from "@/lib/creator-crm/collab-storage";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/creator-crm/collab-types";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import Link from "next/link";

export function CreatorIntegrationsSettingsContent() {
  const { authenticatedRequest, session } = useAuth();
  const {
    data,
    ready,
    error,
    connectIntegration,
    disconnectIntegration,
    syncIntegration,
  } = useCrmCollab(authenticatedRequest);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");

  if (!ready || !data) return null;

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Integrations</h1>
          <span className="workspace-subtitle">
            Email and calendar sync into your CRM timeline
          </span>
        </div>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="auth-error" role="alert">
            {actionError || error}
          </p>
        )}

        <p className="workspace-hint">
          OAuth is stubbed for now: connect with an account email, then run Sync
          to import sample messages/meetings into brand activity and{" "}
          <Link href={CRM_ROUTES.calendar} className="auth-link">
            Calendar
          </Link>
          . Real Gmail/M365 OAuth can replace the stub later.
        </p>

        <div className="crm-brand-grid" style={{ marginTop: 20 }}>
          {data.connections.map((connection) => {
            const connected =
              connection.status === "connected" ||
              connection.status === "stub";
            return (
              <div key={connection.id} className="crm-brand-card">
                <span className="crm-status crm-status--active">
                  {connection.status}
                </span>
                <h3>{INTEGRATION_PROVIDER_LABELS[connection.provider]}</h3>
                <p>
                  {connection.accountEmail || "Not connected"}
                  {connection.lastSyncAt
                    ? ` · Synced ${new Date(connection.lastSyncAt).toLocaleString()}`
                    : ""}
                </p>
                {connection.lastError ? (
                  <p className="workspace-hint">{connection.lastError}</p>
                ) : null}
                {!connected ? (
                  <>
                    <label className="crm-form-field" style={{ marginTop: 12 }}>
                      <span>Account email</span>
                      <input
                        type="email"
                        value={
                          emails[connection.id] ??
                          session?.user.email ??
                          ""
                        }
                        onChange={(e) =>
                          setEmails((current) => ({
                            ...current,
                            [connection.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="crm-btn-primary"
                      style={{ marginTop: 12 }}
                      disabled={busyId === connection.id}
                      onClick={() => {
                        setBusyId(connection.id);
                        setActionError("");
                        void connectIntegration(
                          connection.id,
                          emails[connection.id] ||
                            session?.user.email ||
                            "",
                        )
                          .catch((requestError: unknown) => {
                            setActionError(
                              requestError instanceof Error
                                ? requestError.message
                                : "Could not connect",
                            );
                          })
                          .finally(() => setBusyId(""));
                      }}
                    >
                      Connect
                    </button>
                  </>
                ) : (
                  <div className="crm-topbar-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="crm-btn-primary"
                      disabled={busyId === connection.id}
                      onClick={() => {
                        setBusyId(connection.id);
                        setActionError("");
                        void syncIntegration(connection.id)
                          .catch((requestError: unknown) => {
                            setActionError(
                              requestError instanceof Error
                                ? requestError.message
                                : "Sync failed",
                            );
                          })
                          .finally(() => setBusyId(""));
                      }}
                    >
                      Sync now
                    </button>
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      disabled={busyId === connection.id}
                      onClick={() => {
                        setBusyId(connection.id);
                        setActionError("");
                        void disconnectIntegration(connection.id)
                          .catch((requestError: unknown) => {
                            setActionError(
                              requestError instanceof Error
                                ? requestError.message
                                : "Could not disconnect",
                            );
                          })
                          .finally(() => setBusyId(""));
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="workspace-section" style={{ marginTop: 28 }}>
          <h3>Recent synced email</h3>
          {data.syncedEmails.length === 0 ? (
            <p className="workspace-hint">No synced email yet.</p>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>From</th>
                    <th>Direction</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.syncedEmails.map((email) => (
                    <tr key={email.id}>
                      <td>
                        <strong>{email.subject}</strong>
                        <span className="crm-contact-sub">
                          {" "}
                          · {email.snippet}
                        </span>
                      </td>
                      <td>{email.fromEmail}</td>
                      <td>{email.direction}</td>
                      <td>{new Date(email.sentAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="workspace-section">
          <h3>Recent synced meetings</h3>
          {data.syncedCalendarEvents.length === 0 ? (
            <p className="workspace-hint">No synced meetings yet.</p>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Starts</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {data.syncedCalendarEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{event.title}</td>
                      <td>{new Date(event.startsAt).toLocaleString()}</td>
                      <td>{event.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

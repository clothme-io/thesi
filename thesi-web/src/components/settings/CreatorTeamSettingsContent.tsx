"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCrmCollab } from "@/lib/creator-crm/collab-storage";
import {
  WORKSPACE_ROLE_LABELS,
  type WorkspaceRole,
} from "@/lib/creator-crm/collab-types";

export function CreatorTeamSettingsContent() {
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    error,
    renameWorkspace,
    inviteMember,
    removeMember,
  } = useCrmCollab(authenticatedRequest);
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("member");
  const [actionError, setActionError] = useState("");
  const [inviteTokenHint, setInviteTokenHint] = useState("");

  if (!ready || !data) return null;

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Team</h1>
          <span className="workspace-subtitle">
            Invite collaborators to your CRM workspace
          </span>
        </div>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="auth-error" role="alert">
            {actionError || error}
          </p>
        )}

        <section className="workspace-section">
          <h3>Workspace</h3>
          <p className="workspace-hint">
            Agency teammates share this workspace. CRM records still belong to
            the owner account in this MVP; members are invited for collaboration.
          </p>
          <div className="workspace-grid">
            <label className="workspace-field">
              <span>Name</span>
              <input
                value={workspaceName || data.workspace.name}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="crm-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              setActionError("");
              void renameWorkspace(workspaceName || data.workspace.name).catch(
                (requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not rename workspace",
                  );
                },
              );
            }}
          >
            Save workspace name
          </button>
        </section>

        <section className="workspace-section">
          <h3>Invite teammate</h3>
          <div className="workspace-grid">
            <label className="workspace-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@agency.com"
              />
            </label>
            <label className="workspace-field">
              <span>Role</span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<WorkspaceRole, "owner">)
                }
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="crm-btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              setActionError("");
              setInviteTokenHint("");
              void inviteMember({ email, role })
                .then((snapshot) => {
                  const invited = snapshot.members.find(
                    (member) =>
                      member.email === email.trim().toLowerCase() &&
                      member.status === "invited",
                  );
                  setEmail("");
                  if (invited?.inviteToken) {
                    setInviteTokenHint(invited.inviteToken);
                  }
                })
                .catch((requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not send invite",
                  );
                });
            }}
          >
            Send invite
          </button>
          {inviteTokenHint ? (
            <p className="workspace-hint" style={{ marginTop: 12 }}>
              Invite token (share with teammate for accept MVP):{" "}
              <code>{inviteTokenHint}</code>
            </p>
          ) : null}
        </section>

        <section className="workspace-section">
          <h3>Members</h3>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.email}</td>
                    <td>{WORKSPACE_ROLE_LABELS[member.role]}</td>
                    <td>{member.status}</td>
                    <td>
                      {member.role !== "owner" ? (
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          onClick={() => {
                            setActionError("");
                            void removeMember(member.id).catch(
                              (requestError: unknown) => {
                                setActionError(
                                  requestError instanceof Error
                                    ? requestError.message
                                    : "Could not remove member",
                                );
                              },
                            );
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

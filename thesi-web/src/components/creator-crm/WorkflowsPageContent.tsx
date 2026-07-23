"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  PAYMENT_STATUS_LABELS,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_TRIGGER_LABELS,
  type DealStage,
  type PaymentStatus,
  type WorkflowActionType,
  type WorkflowTriggerType,
} from "@/lib/creator-crm/types";

const TRIGGERS = Object.keys(WORKFLOW_TRIGGER_LABELS) as WorkflowTriggerType[];
const ACTIONS = Object.keys(WORKFLOW_ACTION_LABELS) as WorkflowActionType[];

export function WorkflowsPageContent() {
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    error,
  } = useCreatorCrm(authenticatedRequest);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] =
    useState<WorkflowTriggerType>("deal_stage_changed");
  const [toStage, setToStage] = useState<DealStage | "">("pitched");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [objectId, setObjectId] = useState("");
  const [actionType, setActionType] =
    useState<WorkflowActionType>("create_task");
  const [actionTitle, setActionTitle] = useState("Follow up");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  if (!ready) return null;

  const triggerConfig =
    triggerType === "deal_stage_changed"
      ? { ...(toStage ? { toStage } : {}) }
      : triggerType === "payment_status_changed"
        ? { ...(paymentStatus ? { status: paymentStatus } : {}) }
        : triggerType === "custom_record_created"
          ? { ...(objectId ? { objectId } : {}) }
          : {};

  const actionConfig =
    actionType === "create_task"
      ? { title: actionTitle, dueInDays: 2 }
      : actionType === "create_activity"
        ? { message: actionMessage || actionTitle }
        : {
            entityType: "deal",
            fieldApiName: "priority",
            value: actionTitle || "High",
          };

  return (
    <>
      <header className="app-topbar">
        <h1>Workflows</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          Trigger → action rules
        </span>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}

        <section className="crm-list-card" style={{ marginBottom: 20 }}>
          <h3>Create workflow</h3>
          <p className="workspace-hint">
            Lightweight product rules — not a visual automation studio. Built-in
            won→job still runs separately.
          </p>
          <div className="crm-filters">
            <label className="crm-form-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pitch follow-up"
              />
            </label>
            <label className="crm-form-field">
              <span>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="crm-form-field">
              <span>Trigger</span>
              <select
                value={triggerType}
                onChange={(e) =>
                  setTriggerType(e.target.value as WorkflowTriggerType)
                }
              >
                {TRIGGERS.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {WORKFLOW_TRIGGER_LABELS[trigger]}
                  </option>
                ))}
              </select>
            </label>
            {triggerType === "deal_stage_changed" ? (
              <label className="crm-form-field">
                <span>To stage</span>
                <select
                  value={toStage}
                  onChange={(e) =>
                    setToStage(e.target.value as DealStage | "")
                  }
                >
                  <option value="">Any</option>
                  {DEAL_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {DEAL_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {triggerType === "payment_status_changed" ? (
              <label className="crm-form-field">
                <span>Status</span>
                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as PaymentStatus | "")
                  }
                >
                  <option value="">Any</option>
                  {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {PAYMENT_STATUS_LABELS[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}
            {triggerType === "custom_record_created" ? (
              <label className="crm-form-field">
                <span>Object</span>
                <select
                  value={objectId}
                  onChange={(e) => setObjectId(e.target.value)}
                >
                  <option value="">Any object</option>
                  {data.customObjects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="crm-form-field">
              <span>Action</span>
              <select
                value={actionType}
                onChange={(e) =>
                  setActionType(e.target.value as WorkflowActionType)
                }
              >
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {WORKFLOW_ACTION_LABELS[action]}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-form-field">
              <span>
                {actionType === "create_activity" ? "Message" : "Title / value"}
              </span>
              <input
                value={
                  actionType === "create_activity" ? actionMessage : actionTitle
                }
                onChange={(e) => {
                  if (actionType === "create_activity") {
                    setActionMessage(e.target.value);
                  } else {
                    setActionTitle(e.target.value);
                  }
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => {
              setActionError("");
              void createWorkflow({
                name,
                description,
                triggerType,
                triggerConfig,
                actions: [{ actionType, actionConfig }],
              })
                .then(() => {
                  setName("");
                  setDescription("");
                })
                .catch((requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not create workflow",
                  );
                });
            }}
          >
            + Add workflow
          </button>
        </section>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Trigger</th>
                <th>Actions</th>
                <th>Enabled</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.workflows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No workflows yet. Example: when a deal moves to Pitched,
                      create a follow-up task.
                    </p>
                  </td>
                </tr>
              ) : (
                data.workflows.map((workflow) => (
                  <tr key={workflow.id}>
                    <td>
                      <strong>{workflow.name}</strong>
                      {workflow.description ? (
                        <span className="crm-contact-sub">
                          {" "}
                          · {workflow.description}
                        </span>
                      ) : null}
                    </td>
                    <td>{WORKFLOW_TRIGGER_LABELS[workflow.triggerType]}</td>
                    <td>
                      {workflow.actions
                        .map(
                          (action) =>
                            WORKFLOW_ACTION_LABELS[action.actionType],
                        )
                        .join(", ")}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="crm-btn-secondary"
                        onClick={() => {
                          setActionError("");
                          void updateWorkflow(workflow.id, {
                            enabled: !workflow.enabled,
                          }).catch((requestError: unknown) => {
                            setActionError(
                              requestError instanceof Error
                                ? requestError.message
                                : "Could not update workflow",
                            );
                          });
                        }}
                      >
                        {workflow.enabled ? "On" : "Off"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="crm-btn-secondary"
                        onClick={() => {
                          setActionError("");
                          void deleteWorkflow(workflow.id).catch(
                            (requestError: unknown) => {
                              setActionError(
                                requestError instanceof Error
                                  ? requestError.message
                                  : "Could not delete workflow",
                              );
                            },
                          );
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

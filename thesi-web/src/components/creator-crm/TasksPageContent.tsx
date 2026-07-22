"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { AddTaskDrawer } from "./AddTaskDrawer";

export function TasksPageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, setTaskStatus, createTask, error } =
    useCreatorCrm(authenticatedRequest);
  const [actionError, setActionError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!ready) return null;

  const pending = data.tasks.filter((t) => t.status === "pending");
  const done = data.tasks.filter((t) => t.status === "done");

  async function toggleTask(taskId: string, current: "pending" | "done") {
    setActionError("");
    try {
      await setTaskStatus(taskId, current === "done" ? "pending" : "done");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update task",
      );
    }
  }

  return (
    <>
      <header className="app-topbar">
        <h1>Tasks & Reminders</h1>
        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => setDrawerOpen(true)}
        >
          + Add task
        </button>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <h2 className="crm-section-title">Due & pending</h2>
        {pending.length === 0 && (
          <p className="crm-contact-sub">No pending tasks.</p>
        )}
        {pending.map((task) => {
          const brand = task.brandId
            ? data.brands.find((b) => b.id === task.brandId)
            : undefined;
          return (
            <label key={task.id} className="crm-task-item">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleTask(task.id, task.status)}
              />
              <span>
                <strong>{task.title}</strong>
                <span className="crm-contact-sub">
                  {brand ? ` · ${brand.name}` : ""}
                  {task.dueDate ? ` · Due ${task.dueDate}` : ""}
                </span>
              </span>
            </label>
          );
        })}

        {done.length > 0 && (
          <>
            <h2 className="crm-section-title" style={{ marginTop: 32 }}>
              Completed
            </h2>
            {done.map((task) => (
              <label key={task.id} className="crm-task-item">
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleTask(task.id, task.status)}
                />
                <span
                  style={{ textDecoration: "line-through", color: "var(--muted)" }}
                >
                  {task.title}
                </span>
              </label>
            ))}
          </>
        )}
      </div>

      <AddTaskDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        brands={data.brands}
        jobs={data.jobs}
        onSubmit={async (input) => {
          await createTask(input);
        }}
      />
    </>
  );
}

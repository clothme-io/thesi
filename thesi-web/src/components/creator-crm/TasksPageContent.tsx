"use client";

import { useCreatorCrm } from "@/lib/creator-crm/storage";

export function TasksPageContent() {
  const { data, ready, persist } = useCreatorCrm();
  if (!ready) return null;

  const pending = data.tasks.filter((t) => t.status === "pending");
  const done = data.tasks.filter((t) => t.status === "done");

  function toggleTask(taskId: string) {
    const next = {
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: task.status === "done" ? "pending" as const : "done" as const }
          : task,
      ),
    };
    persist(next);
  }

  return (
    <>
      <header className="app-topbar">
        <h1>Tasks & Reminders</h1>
        <button type="button" className="crm-btn-primary">+ Add task</button>
      </header>

      <div className="app-content">
        <h2 className="crm-section-title">Due & pending</h2>
        {pending.map((task) => {
          const brand = task.brandId
            ? data.brands.find((b) => b.id === task.brandId)
            : undefined;
          return (
            <label key={task.id} className="crm-task-item">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleTask(task.id)}
              />
              <span>
                <strong>{task.title}</strong>
                <span className="crm-contact-sub">
                  {brand ? ` · ${brand.name}` : ""} · Due {task.dueDate}
                </span>
              </span>
            </label>
          );
        })}

        {done.length > 0 && (
          <>
            <h2 className="crm-section-title" style={{ marginTop: 32 }}>Completed</h2>
            {done.map((task) => (
              <label key={task.id} className="crm-task-item">
                <input type="checkbox" checked onChange={() => toggleTask(task.id)} />
                <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>{task.title}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </>
  );
}

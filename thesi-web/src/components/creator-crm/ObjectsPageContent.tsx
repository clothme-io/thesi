"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export function ObjectsPageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Objects</h1>
        <Link href={CRM_ROUTES.dataModel} className="crm-btn-secondary">
          Manage data model
        </Link>
      </header>
      <div className="app-content">
        <div className="crm-brand-grid">
          {data.customObjects.length === 0 ? (
            <p className="workspace-hint">
              No custom objects yet. Create one in{" "}
              <Link href={CRM_ROUTES.dataModel} className="auth-link">
                Data model
              </Link>
              .
            </p>
          ) : (
            data.customObjects.map((object) => {
              const count = data.customRecords.filter(
                (record) => record.objectId === object.id,
              ).length;
              return (
                <Link
                  key={object.id}
                  href={CRM_ROUTES.object(object.id)}
                  className="crm-brand-card"
                >
                  <h3>{object.name}</h3>
                  <p>
                    {count} record{count === 1 ? "" : "s"}
                    {object.description ? ` · ${object.description}` : ""}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

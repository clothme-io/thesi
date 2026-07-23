"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export function ObjectDetailContent({ objectId }: { objectId: string }) {
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    createCustomRecord,
    deleteCustomRecord,
    error,
  } = useCreatorCrm(authenticatedRequest);
  const [title, setTitle] = useState("");
  const [brandId, setBrandId] = useState("");
  const [actionError, setActionError] = useState("");

  const object = useMemo(
    () => data.customObjects.find((item) => item.id === objectId),
    [data.customObjects, objectId],
  );
  const fields = useMemo(
    () =>
      data.customFields.filter(
        (field) =>
          field.targetType === "custom_object" &&
          field.targetObjectId === objectId,
      ),
    [data.customFields, objectId],
  );
  const records = useMemo(
    () => data.customRecords.filter((record) => record.objectId === objectId),
    [data.customRecords, objectId],
  );

  if (!ready) return null;
  if (!object) {
    return (
      <div className="app-content">
        <p className="workspace-hint">Object not found.</p>
        <Link href={CRM_ROUTES.objects} className="auth-link">
          Back to objects
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="app-topbar">
        <h1>{object.name}</h1>
        <Link href={CRM_ROUTES.dataModel} className="crm-btn-secondary">
          Edit fields
        </Link>
      </header>
      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <p className="workspace-hint">{object.description || object.apiName}</p>

        <section className="crm-list-card" style={{ marginBottom: 20 }}>
          <h3>Add record</h3>
          <div className="crm-filters">
            <label className="crm-form-field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Record title"
              />
            </label>
            <label className="crm-form-field">
              <span>Related brand</span>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">None</option>
                {data.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {fields.length > 0 ? (
            <p className="workspace-hint">
              Fields: {fields.map((field) => field.name).join(", ")}. Set values
              after creating the record from the data model workflow or a later
              edit pass.
            </p>
          ) : null}
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => {
              setActionError("");
              void createCustomRecord({
                objectId,
                title,
                ...(brandId ? { brandId } : {}),
                values: {},
              })
                .then(() => {
                  setTitle("");
                  setBrandId("");
                })
                .catch((requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not create record",
                  );
                });
            }}
          >
            + Add record
          </button>
        </section>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Brand</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No records yet.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const brand = data.brands.find(
                    (item) => item.id === record.brandId,
                  );
                  return (
                    <tr key={record.id}>
                      <td>{record.title}</td>
                      <td>
                        {brand ? (
                          <Link href={CRM_ROUTES.brand(brand.id)}>
                            {brand.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{new Date(record.updatedAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          onClick={() => {
                            setActionError("");
                            void deleteCustomRecord(record.id).catch(
                              (requestError: unknown) => {
                                setActionError(
                                  requestError instanceof Error
                                    ? requestError.message
                                    : "Could not delete record",
                                );
                              },
                            );
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

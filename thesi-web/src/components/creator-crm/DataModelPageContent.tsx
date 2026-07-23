"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  FIELD_TARGET_LABELS,
  type CustomFieldType,
  type FieldTargetType,
} from "@/lib/creator-crm/types";

const BUILTIN_TARGETS: FieldTargetType[] = ["brand", "deal", "job"];
const FIELD_TYPES: CustomFieldType[] = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
];

export function DataModelPageContent() {
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    createCustomObject,
    deleteCustomObject,
    createCustomField,
    deleteCustomField,
    error,
  } = useCreatorCrm(authenticatedRequest);
  const [objectName, setObjectName] = useState("");
  const [objectDescription, setObjectDescription] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldTarget, setFieldTarget] = useState<FieldTargetType>("brand");
  const [fieldObjectId, setFieldObjectId] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [fieldOptions, setFieldOptions] = useState("");
  const [actionError, setActionError] = useState("");

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Data model</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          Custom objects and fields
        </span>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}

        <section className="crm-list-card" style={{ marginBottom: 20 }}>
          <h3>Custom objects</h3>
          <p className="workspace-hint">
            Define your own record types (e.g. Campaign briefs, Shot lists).
            Manage records under{" "}
            <Link href={CRM_ROUTES.objects} className="auth-link">
              Objects
            </Link>
            .
          </p>
          <div className="crm-filters">
            <label className="crm-form-field">
              <span>Name</span>
              <input
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="Shot list"
              />
            </label>
            <label className="crm-form-field">
              <span>Description</span>
              <input
                value={objectDescription}
                onChange={(e) => setObjectDescription(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => {
              setActionError("");
              void createCustomObject({
                name: objectName,
                description: objectDescription,
              })
                .then(() => {
                  setObjectName("");
                  setObjectDescription("");
                })
                .catch((requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not create object",
                  );
                });
            }}
          >
            + Add object
          </button>
          <div className="crm-table-wrap" style={{ marginTop: 16 }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>API name</th>
                  <th>Records</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.customObjects.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className="workspace-hint" style={{ margin: 0 }}>
                        No custom objects yet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.customObjects.map((object) => (
                    <tr key={object.id}>
                      <td>
                        <Link href={CRM_ROUTES.object(object.id)}>
                          {object.name}
                        </Link>
                      </td>
                      <td>
                        <code>{object.apiName}</code>
                      </td>
                      <td>
                        {
                          data.customRecords.filter(
                            (record) => record.objectId === object.id,
                          ).length
                        }
                      </td>
                      <td>
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          onClick={() => {
                            setActionError("");
                            void deleteCustomObject(object.id).catch(
                              (requestError: unknown) => {
                                setActionError(
                                  requestError instanceof Error
                                    ? requestError.message
                                    : "Could not delete object",
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
        </section>

        <section className="crm-list-card">
          <h3>Custom fields</h3>
          <p className="workspace-hint">
            Add fields to brands, deals, jobs, or a custom object.
          </p>
          <div className="crm-filters">
            <label className="crm-form-field">
              <span>Target</span>
              <select
                value={fieldTarget}
                onChange={(e) =>
                  setFieldTarget(e.target.value as FieldTargetType)
                }
              >
                {BUILTIN_TARGETS.map((target) => (
                  <option key={target} value={target}>
                    {FIELD_TARGET_LABELS[target]}
                  </option>
                ))}
                <option value="custom_object">Custom object</option>
              </select>
            </label>
            {fieldTarget === "custom_object" ? (
              <label className="crm-form-field">
                <span>Object</span>
                <select
                  value={fieldObjectId}
                  onChange={(e) => setFieldObjectId(e.target.value)}
                >
                  <option value="">Select object</option>
                  {data.customObjects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="crm-form-field">
              <span>Field name</span>
              <input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Priority"
              />
            </label>
            <label className="crm-form-field">
              <span>Type</span>
              <select
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as CustomFieldType)
                }
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            {fieldType === "select" ? (
              <label className="crm-form-field">
                <span>Options (comma-separated)</span>
                <input
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="Low, Medium, High"
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => {
              setActionError("");
              void createCustomField({
                targetType: fieldTarget,
                ...(fieldTarget === "custom_object"
                  ? { targetObjectId: fieldObjectId }
                  : {}),
                name: fieldName,
                fieldType,
                options:
                  fieldType === "select"
                    ? fieldOptions.split(",").map((part) => part.trim())
                    : [],
              })
                .then(() => {
                  setFieldName("");
                  setFieldOptions("");
                })
                .catch((requestError: unknown) => {
                  setActionError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not create field",
                  );
                });
            }}
          >
            + Add field
          </button>
          <div className="crm-table-wrap" style={{ marginTop: 16 }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Target</th>
                  <th>Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.customFields.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className="workspace-hint" style={{ margin: 0 }}>
                        No custom fields yet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.customFields.map((field) => {
                    const objectName = field.targetObjectId
                      ? data.customObjects.find(
                          (object) => object.id === field.targetObjectId,
                        )?.name
                      : null;
                    return (
                      <tr key={field.id}>
                        <td>
                          {field.name}{" "}
                          <span className="crm-contact-sub">
                            ({field.apiName})
                          </span>
                        </td>
                        <td>
                          {FIELD_TARGET_LABELS[field.targetType]}
                          {objectName ? ` · ${objectName}` : ""}
                        </td>
                        <td>{field.fieldType}</td>
                        <td>
                          <button
                            type="button"
                            className="crm-btn-secondary"
                            onClick={() => {
                              setActionError("");
                              void deleteCustomField(field.id).catch(
                                (requestError: unknown) => {
                                  setActionError(
                                    requestError instanceof Error
                                      ? requestError.message
                                      : "Could not delete field",
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
        </section>
      </div>
    </>
  );
}

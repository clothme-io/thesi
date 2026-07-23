"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreatorCrmData,
  DealStage,
  PaymentStatus,
  TaskStatus,
} from "./types";
import { DEAL_STAGES } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: CreatorCrmData = {
  brands: [],
  people: [],
  deals: [],
  jobs: [],
  contracts: [],
  payments: [],
  calendarEvents: [],
  tasks: [],
  activities: [],
  customObjects: [],
  customFields: [],
  customRecords: [],
  entityFieldValues: [],
  workflows: [],
};

function normalizeCrmData(next: CreatorCrmData): CreatorCrmData {
  return {
    ...EMPTY,
    ...next,
    customObjects: next.customObjects ?? [],
    customFields: next.customFields ?? [],
    customRecords: next.customRecords ?? [],
    entityFieldValues: next.entityFieldValues ?? [],
    workflows: next.workflows ?? [],
  };
}

export function useCreatorCrm(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<CreatorCrmData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<CreatorCrmData>("/api/creator-crm");
    const normalized = normalizeCrmData(next);
    setData(normalized);
    return normalized;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<CreatorCrmData>("/api/creator-crm")
      .then((next) => {
        if (active) setData(normalizeCrmData(next));
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load CRM",
          );
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const moveDeal = useCallback(
    async (dealId: string, stage: DealStage) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/deals/${dealId}/stage`,
        { method: "PATCH", body: { stage } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const setTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/tasks/${taskId}`,
        { method: "PATCH", body: { status } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createInvoice = useCallback(
    async (input: {
      brandId: string;
      jobId?: string;
      amountCents: number;
      dueDate: string;
      description?: string;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/payments",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateInvoice = useCallback(
    async (
      paymentId: string,
      patch: {
        status?: PaymentStatus;
        amountCents?: number;
        dueDate?: string;
        description?: string;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/payments/${paymentId}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createDeal = useCallback(
    async (input: {
      brandId: string;
      title: string;
      valueCents?: number;
      stage?: DealStage;
      expectedCloseDate?: string;
      primaryContactId?: string;
      notes?: string;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/deals",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateDeal = useCallback(
    async (
      dealId: string,
      patch: {
        title?: string;
        valueCents?: number;
        expectedCloseDate?: string;
        primaryContactId?: string | null;
        notes?: string;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/deals/${dealId}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createTask = useCallback(
    async (input: {
      title: string;
      body?: string;
      brandId?: string;
      jobId?: string;
      dueDate?: string;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/tasks",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createBrandPerson = useCallback(
    async (
      brandId: string,
      input: {
        name: string;
        email?: string;
        phone?: string;
        roleTitle?: string;
        isPrimary?: boolean;
        notes?: string;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/brands/${brandId}/people`,
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateBrandPerson = useCallback(
    async (
      personId: string,
      patch: {
        name?: string;
        email?: string;
        phone?: string;
        roleTitle?: string;
        isPrimary?: boolean;
        notes?: string;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/people/${personId}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const deleteBrandPerson = useCallback(
    async (personId: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/people/${personId}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateBrandNotes = useCallback(
    async (brandId: string, notes: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/brands/${brandId}/notes`,
        { method: "PATCH", body: { notes } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateJobNotes = useCallback(
    async (jobId: string, notes: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/jobs/${jobId}/notes`,
        { method: "PATCH", body: { notes } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createCalendarEvent = useCallback(
    async (input: {
      title: string;
      type: import("./types").CalendarEventType;
      date: string;
      brandId?: string;
      jobId?: string;
      notes?: string;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/calendar-events",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createContract = useCallback(
    async (input: {
      brandId: string;
      title: string;
      jobId?: string;
      status?: import("./types").ContractStatus;
      expiresAt?: string;
      file?: File | null;
    }) => {
      setError("");
      if (input.file) {
        const formData = new FormData();
        formData.append("brandId", input.brandId);
        formData.append("title", input.title);
        if (input.jobId) formData.append("jobId", input.jobId);
        if (input.status) formData.append("status", input.status);
        if (input.expiresAt) formData.append("expiresAt", input.expiresAt);
        formData.append("file", input.file);
        const next = await authenticatedRequest<CreatorCrmData>(
          "/api/creator-crm/contracts",
          { method: "POST", body: formData },
        );
        setData(next);
        return next;
      }
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/contracts",
        {
          method: "POST",
          body: {
            brandId: input.brandId,
            title: input.title,
            ...(input.jobId ? { jobId: input.jobId } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
          },
        },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const importCsv = useCallback(
    async (payload: {
      brands?: Array<Record<string, unknown>>;
      deals?: Array<Record<string, unknown>>;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/import",
        { method: "POST", body: payload },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createCustomObject = useCallback(
    async (input: { name: string; apiName?: string; description?: string }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/custom-objects",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateCustomObject = useCallback(
    async (
      id: string,
      patch: { name?: string; description?: string },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/custom-objects/${id}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const deleteCustomObject = useCallback(
    async (id: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/custom-objects/${id}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createCustomField = useCallback(
    async (input: {
      targetType: "brand" | "deal" | "job" | "custom_object";
      targetObjectId?: string;
      name: string;
      apiName?: string;
      fieldType: "text" | "number" | "date" | "boolean" | "select";
      options?: string[];
      required?: boolean;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/custom-fields",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const deleteCustomField = useCallback(
    async (id: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/custom-fields/${id}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const upsertEntityFieldValues = useCallback(
    async (input: {
      entityType: "brand" | "deal" | "job";
      entityId: string;
      values: Record<string, string | number | boolean | null>;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/entity-field-values",
        { method: "PUT", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createCustomRecord = useCallback(
    async (input: {
      objectId: string;
      title: string;
      values?: Record<string, string | number | boolean | null>;
      brandId?: string;
      dealId?: string;
      jobId?: string;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/custom-records",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateCustomRecord = useCallback(
    async (
      id: string,
      patch: {
        title?: string;
        values?: Record<string, string | number | boolean | null>;
        brandId?: string | null;
        dealId?: string | null;
        jobId?: string | null;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/custom-records/${id}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const deleteCustomRecord = useCallback(
    async (id: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/custom-records/${id}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createWorkflow = useCallback(
    async (input: {
      name: string;
      description?: string;
      enabled?: boolean;
      triggerType: string;
      triggerConfig?: Record<string, unknown>;
      actions: Array<{
        actionType: string;
        actionConfig?: Record<string, unknown>;
      }>;
    }) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        "/api/creator-crm/workflows",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const updateWorkflow = useCallback(
    async (
      id: string,
      patch: {
        name?: string;
        description?: string;
        enabled?: boolean;
        triggerType?: string;
        triggerConfig?: Record<string, unknown>;
        actions?: Array<{
          actionType: string;
          actionConfig?: Record<string, unknown>;
        }>;
      },
    ) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/workflows/${id}`,
        { method: "PATCH", body: patch },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const deleteWorkflow = useCallback(
    async (id: string) => {
      setError("");
      const next = await authenticatedRequest<CreatorCrmData>(
        `/api/creator-crm/workflows/${id}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    moveDeal,
    setTaskStatus,
    createInvoice,
    updateInvoice,
    createDeal,
    updateDeal,
    createTask,
    createBrandPerson,
    updateBrandPerson,
    deleteBrandPerson,
    updateBrandNotes,
    updateJobNotes,
    createCalendarEvent,
    createContract,
    importCsv,
    createCustomObject,
    updateCustomObject,
    deleteCustomObject,
    createCustomField,
    deleteCustomField,
    upsertEntityFieldValues,
    createCustomRecord,
    updateCustomRecord,
    deleteCustomRecord,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
  };
}

export function getPeopleForBrand(data: CreatorCrmData, brandId: string) {
  return data.people.filter((person) => person.brandId === brandId);
}

export function getBrandById(data: CreatorCrmData, id: string) {
  return data.brands.find((b) => b.id === id);
}

export function getJobById(data: CreatorCrmData, id: string) {
  return data.jobs.find((j) => j.id === id);
}

export function getDealById(data: CreatorCrmData, id: string) {
  return data.deals.find((d) => d.id === id);
}

export function getContractById(data: CreatorCrmData, id: string) {
  return data.contracts.find((c) => c.id === id);
}

export function getPaymentsForJob(data: CreatorCrmData, jobId: string) {
  return data.payments.filter((p) => p.jobId === jobId);
}

export function getTasksForJob(data: CreatorCrmData, jobId: string) {
  return data.tasks.filter((t) => t.jobId === jobId);
}

export function getCalendarEventsForJob(data: CreatorCrmData, jobId: string) {
  return data.calendarEvents.filter((e) => e.jobId === jobId);
}

export function getActivitiesForJob(data: CreatorCrmData, jobId: string) {
  return data.activities
    .filter((a) => a.jobId === jobId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDealsForBrand(data: CreatorCrmData, brandId: string) {
  return data.deals.filter((d) => d.brandId === brandId);
}

export function getJobsForBrand(data: CreatorCrmData, brandId: string) {
  return data.jobs.filter((j) => j.brandId === brandId);
}

export function getPaymentsForBrand(data: CreatorCrmData, brandId: string) {
  return data.payments.filter((p) => p.brandId === brandId);
}

export function getContractsForBrand(data: CreatorCrmData, brandId: string) {
  return data.contracts.filter((c) => c.brandId === brandId);
}

export function getActivitiesForBrand(data: CreatorCrmData, brandId: string) {
  return data.activities
    .filter((a) => a.brandId === brandId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDashboardMetrics(data: CreatorCrmData) {
  const today = new Date().toISOString().slice(0, 10);
  const activeJobs = data.jobs.filter((j) => j.status === "active" || j.status === "in_review");
  const upcomingDeadlines = data.jobs.filter((j) => j.deadline >= today).length;
  const overduePayments = data.payments.filter((p) => p.status === "overdue");
  const pipelineDeals = data.deals.filter((d) => !["won", "lost"].includes(d.stage));
  const monthRevenue = data.payments
    .filter((p) => p.status === "paid" && p.paidAt?.startsWith(today.slice(0, 7)))
    .reduce((sum, p) => sum + p.amountCents, 0);
  const expectedRevenue = data.deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((sum, d) => sum + d.valueCents, 0);
  const tasksDueToday = data.tasks.filter((t) => t.dueDate === today && t.status === "pending");
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const contentThisWeek = data.calendarEvents.filter(
    (e) => e.date >= today && e.date <= weekEndStr,
  );
  const pipelineByStage = DEAL_STAGES.filter(
    (stage) => stage !== "won" && stage !== "lost",
  ).map((stage) => {
    const deals = data.deals.filter((deal) => deal.stage === stage);
    return {
      stage,
      count: deals.length,
      valueCents: deals.reduce((sum, deal) => sum + deal.valueCents, 0),
    };
  });

  return {
    activeJobs,
    upcomingDeadlines,
    overduePayments,
    pipelineDeals,
    monthRevenue,
    expectedRevenue,
    tasksDueToday,
    contentThisWeek,
    pipelineByStage,
  };
}

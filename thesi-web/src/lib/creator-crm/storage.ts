"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreatorCrmData,
  DealStage,
  PaymentStatus,
  TaskStatus,
} from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: CreatorCrmData = {
  brands: [],
  deals: [],
  jobs: [],
  contracts: [],
  payments: [],
  calendarEvents: [],
  tasks: [],
  activities: [],
};

export function useCreatorCrm(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<CreatorCrmData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<CreatorCrmData>("/api/creator-crm");
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<CreatorCrmData>("/api/creator-crm")
      .then((next) => {
        if (active) setData(next);
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

  const createTask = useCallback(
    async (input: {
      title: string;
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
    createTask,
    updateBrandNotes,
    updateJobNotes,
    createCalendarEvent,
    createContract,
  };
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

  return {
    activeJobs,
    upcomingDeadlines,
    overduePayments,
    pipelineDeals,
    monthRevenue,
    expectedRevenue,
    tasksDueToday,
    contentThisWeek,
  };
}

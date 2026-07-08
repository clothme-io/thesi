"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorCrmData, DealStage } from "./types";
import { DEAL_STAGE_LABELS } from "./types";
import { SEED_CRM_DATA } from "./seed";

const STORAGE_KEY = "thesi_creator_crm";

export function loadCrmData(): CreatorCrmData {
  if (typeof window === "undefined") return SEED_CRM_DATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CRM_DATA));
    return SEED_CRM_DATA;
  }
  try {
    return JSON.parse(raw) as CreatorCrmData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CRM_DATA));
    return SEED_CRM_DATA;
  }
}

export function saveCrmData(data: CreatorCrmData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useCreatorCrm() {
  const [data, setData] = useState<CreatorCrmData>(SEED_CRM_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadCrmData());
    setReady(true);
  }, []);

  const persist = useCallback((next: CreatorCrmData) => {
    setData(next);
    saveCrmData(next);
  }, []);

  return { data, ready, persist };
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

export function moveDealStage(
  data: CreatorCrmData,
  dealId: string,
  stage: DealStage,
): CreatorCrmData {
  const deal = data.deals.find((d) => d.id === dealId);
  if (!deal || deal.stage === stage) return data;

  const now = new Date().toISOString();
  return {
    ...data,
    deals: data.deals.map((d) =>
      d.id === dealId ? { ...d, stage, updatedAt: now } : d,
    ),
    activities: [
      {
        id: `act-${Date.now()}`,
        brandId: deal.brandId,
        dealId: deal.id,
        type: "deal_moved",
        message: `Deal moved to ${DEAL_STAGE_LABELS[stage]}`,
        createdAt: now,
      },
      ...data.activities,
    ],
  };
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

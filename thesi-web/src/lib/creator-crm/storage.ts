"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorCrmData } from "./types";
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

"use client";

import { useCallback, useEffect, useState } from "react";
import type { InviteData, CampaignInvite } from "./types";

const STORAGE_KEY = "thesi_campaign_invites";

const EMPTY: InviteData = { invites: [] };

export function loadInviteData(): InviteData {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
  try {
    return JSON.parse(raw) as InviteData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
}

export function saveInviteData(data: InviteData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useInvites() {
  const [data, setData] = useState<InviteData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadInviteData());
    setReady(true);
  }, []);

  const persist = useCallback((next: InviteData) => {
    setData(next);
    saveInviteData(next);
  }, []);

  return { data, ready, persist };
}

export function getInvitesForCampaign(data: InviteData, campaignId: string): CampaignInvite[] {
  return data.invites.filter((i) => i.campaignId === campaignId);
}

export function addInvite(data: InviteData, invite: CampaignInvite): InviteData {
  return { ...data, invites: [...data.invites, invite] };
}

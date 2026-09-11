"use client";

import posthog from "posthog-js";

export const POSTHOG_APP_NAME = "thesi_web";
export const POSTHOG_ENV = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
const POSTHOG_ALLOWED_HOSTS = (process.env.NEXT_PUBLIC_POSTHOG_ALLOWED_HOSTS || "get-thesi.com,www.get-thesi.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAnalyticsHost() {
  if (typeof window === "undefined") return false;

  return POSTHOG_ALLOWED_HOSTS.includes(window.location.hostname.toLowerCase());
}

export const IS_POSTHOG_ENABLED = POSTHOG_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export function initPostHog() {
  if (!IS_POSTHOG_ENABLED || !isAllowedAnalyticsHost() || posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    loaded: (client) => {
      client.register({
        app: POSTHOG_APP_NAME,
        environment: POSTHOG_ENV,
      });
    },
  });
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  if (!IS_POSTHOG_ENABLED || !isAllowedAnalyticsHost()) return;

  posthog.capture(eventName, {
    app: POSTHOG_APP_NAME,
    environment: POSTHOG_ENV,
    ...properties,
  });
}

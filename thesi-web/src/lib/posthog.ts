"use client";

import posthog from "posthog-js";

export const POSTHOG_APP_NAME = "thesi_web";
export const POSTHOG_ENV =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
export const POSTHOG_UI_HOST = "https://us.posthog.com";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";

const POSTHOG_ALLOWED_HOSTS = (
  process.env.NEXT_PUBLIC_POSTHOG_ALLOWED_HOSTS ||
  "get-thesi.com,www.get-thesi.com,dv-app.get-thesi.com"
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export function isExcludedAnalyticsPath(pathname: string) {
  return (
    pathname === "/merchant-link" ||
    pathname.startsWith("/merchant-link/") ||
    pathname === "/merchant-signin" ||
    pathname.startsWith("/merchant-signin/") ||
    pathname === "/r" ||
    pathname.startsWith("/r/")
  );
}

export function isAllowedAnalyticsHost(hostname: string) {
  return POSTHOG_ALLOWED_HOSTS.includes(hostname.toLowerCase());
}

export function analyticsEnvironment(
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  const host = hostname.toLowerCase();
  if (host === "dv-app.get-thesi.com") return "development";
  if (host === "get-thesi.com" || host === "www.get-thesi.com") return "production";
  return POSTHOG_ENV;
}

export function shouldCaptureAnalytics(location: {
  hostname: string;
  pathname: string;
}) {
  if (!POSTHOG_KEY) return false;
  if (isExcludedAnalyticsPath(location.pathname)) return false;
  return isAllowedAnalyticsHost(location.hostname);
}

function browserCanCapture() {
  if (typeof window === "undefined") return false;
  return shouldCaptureAnalytics({
    hostname: window.location.hostname,
    pathname: window.location.pathname,
  });
}

function superProperties() {
  return {
    app: POSTHOG_APP_NAME,
    environment: analyticsEnvironment(),
  };
}

export const IS_POSTHOG_ENABLED = Boolean(POSTHOG_KEY);

export function initPostHog() {
  if (!browserCanCapture() || posthog.__loaded) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_API_HOST,
    ui_host: POSTHOG_UI_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    loaded: (client) => {
      client.register(superProperties());
    },
  });
}

export function identifyUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyName?: string;
}) {
  if (!browserCanCapture()) return;
  posthog.identify(user.id, {
    email: user.email,
    name: user.fullName,
    role: user.role,
    ...(user.companyName ? { company_name: user.companyName } : {}),
  });
  posthog.register({ ...superProperties(), role: user.role });
}

export function resetUser() {
  if (typeof window === "undefined") return;
  posthog.reset();
}

export function capturePageview(pathname: string, search = "") {
  if (!browserCanCapture() || isExcludedAnalyticsPath(pathname)) return;
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  const url = `${window.location.origin}${pathname}${query}`;
  posthog.capture("$pageview", {
    $current_url: url,
    path: pathname,
    ...superProperties(),
  });
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  if (!browserCanCapture()) return;
  posthog.capture(eventName, {
    ...superProperties(),
    ...properties,
  });
}

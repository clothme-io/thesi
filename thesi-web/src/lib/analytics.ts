"use client";

import mixpanel from "mixpanel-browser";
import posthog from "posthog-js";

export const ANALYTICS_APP_NAME = "thesi_web";
export const ANALYTICS_ENV =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
export const POSTHOG_UI_HOST = "https://us.posthog.com";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_API_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || "";
const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

const ANALYTICS_ALLOWED_HOSTS = (
  process.env.NEXT_PUBLIC_ANALYTICS_ALLOWED_HOSTS ||
  process.env.NEXT_PUBLIC_POSTHOG_ALLOWED_HOSTS ||
  "get-thesi.com,www.get-thesi.com,dv-app.get-thesi.com"
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

let mixpanelLoaded = false;

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
  return ANALYTICS_ALLOWED_HOSTS.includes(hostname.toLowerCase());
}

export function analyticsEnvironment(
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
) {
  const host = hostname.toLowerCase();
  if (host === "dv-app.get-thesi.com") return "development";
  if (host === "get-thesi.com" || host === "www.get-thesi.com") return "production";
  return ANALYTICS_ENV;
}

export function shouldCaptureAnalytics(location: {
  hostname: string;
  pathname: string;
}) {
  if (!POSTHOG_KEY && !MIXPANEL_TOKEN) return false;
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
    app: ANALYTICS_APP_NAME,
    environment: analyticsEnvironment(),
  };
}

function publicUrl(pathname: string) {
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}`;
}

function searchParamKeys(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return Array.from(params.keys()).sort();
}

export const IS_ANALYTICS_ENABLED = Boolean(POSTHOG_KEY || MIXPANEL_TOKEN);
export const IS_POSTHOG_ENABLED = Boolean(POSTHOG_KEY);
export const IS_MIXPANEL_ENABLED = Boolean(MIXPANEL_TOKEN);

export function initAnalytics() {
  if (!browserCanCapture()) return;

  if (POSTHOG_KEY && !posthog.__loaded) {
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

  if (MIXPANEL_TOKEN && !mixpanelLoaded) {
    mixpanel.init(MIXPANEL_TOKEN, {
      ...(MIXPANEL_API_HOST ? { api_host: MIXPANEL_API_HOST } : {}),
      debug: ANALYTICS_DEBUG,
      track_pageview: false,
      persistence: "localStorage",
      ignore_dnt: false,
      autocapture: {
        click: true,
        input: false,
        submit: true,
        capture_text_content: false,
      },
      loaded: (client) => {
        client.register(superProperties());
      },
    });
    mixpanelLoaded = true;
  }
}

export function identifyUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyName?: string;
}) {
  if (!browserCanCapture()) return;
  initAnalytics();

  const profile = {
    email: user.email,
    name: user.fullName,
    role: user.role,
    ...(user.companyName ? { company_name: user.companyName } : {}),
  };

  if (POSTHOG_KEY) {
    posthog.identify(user.id, profile);
    posthog.register({ ...superProperties(), role: user.role });
  }

  if (MIXPANEL_TOKEN) {
    mixpanel.identify(user.id);
    mixpanel.people.set({
      $email: user.email,
      $name: user.fullName,
      role: user.role,
      ...(user.companyName ? { company_name: user.companyName } : {}),
    });
    mixpanel.register({ ...superProperties(), role: user.role });
  }
}

export function resetUser() {
  if (typeof window === "undefined") return;
  if (POSTHOG_KEY) posthog.reset();
  if (MIXPANEL_TOKEN && mixpanelLoaded) mixpanel.reset();
}

export function capturePageview(pathname: string, search = "") {
  if (!browserCanCapture() || isExcludedAnalyticsPath(pathname)) return;
  initAnalytics();

  const properties = {
    ...superProperties(),
    path: pathname,
    search_param_keys: searchParamKeys(search),
    url: publicUrl(pathname),
  };

  if (POSTHOG_KEY) {
    posthog.capture("$pageview", {
      ...properties,
      $current_url: publicUrl(pathname),
    });
  }
  if (MIXPANEL_TOKEN) mixpanel.track("Page Viewed", properties);
}

export function track(eventName: string, properties: Record<string, unknown> = {}) {
  if (!browserCanCapture()) return;
  initAnalytics();
  const payload = {
    ...superProperties(),
    ...properties,
  };
  if (POSTHOG_KEY) posthog.capture(eventName, payload);
  if (MIXPANEL_TOKEN) mixpanel.track(eventName, payload);
}

export function analyticsPath(path: string) {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, "/:token");
}

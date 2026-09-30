import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsEnvironment,
  isAllowedAnalyticsHost,
  isExcludedAnalyticsPath,
  shouldCaptureAnalytics,
} from "./posthog";

describe("PostHog capture gates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows production and dv-app hosts", () => {
    expect(isAllowedAnalyticsHost("get-thesi.com")).toBe(true);
    expect(isAllowedAnalyticsHost("www.get-thesi.com")).toBe(true);
    expect(isAllowedAnalyticsHost("dv-app.get-thesi.com")).toBe(true);
    expect(isAllowedAnalyticsHost("localhost")).toBe(false);
  });

  it("skips merchant SSO and referral short-link pages", () => {
    expect(isExcludedAnalyticsPath("/merchant-link")).toBe(true);
    expect(isExcludedAnalyticsPath("/merchant-signin")).toBe(true);
    expect(isExcludedAnalyticsPath("/r/abc")).toBe(true);
    expect(isExcludedAnalyticsPath("/campaigns")).toBe(false);
    expect(isExcludedAnalyticsPath("/reviews")).toBe(false);
  });

  it("labels dv-app separately from production", () => {
    expect(analyticsEnvironment("dv-app.get-thesi.com")).toBe("development");
    expect(analyticsEnvironment("get-thesi.com")).toBe("production");
    expect(analyticsEnvironment("www.get-thesi.com")).toBe("production");
  });

  it("does not capture without a project key", () => {
    expect(
      shouldCaptureAnalytics({
        hostname: "get-thesi.com",
        pathname: "/campaigns",
      }),
    ).toBe(false);
  });

  it("captures identified product hosts when a project key is present", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { shouldCaptureAnalytics: shouldCapture } = await import("./posthog");
    expect(
      shouldCapture({ hostname: "get-thesi.com", pathname: "/campaigns" }),
    ).toBe(true);
    expect(
      shouldCapture({ hostname: "dv-app.get-thesi.com", pathname: "/campaigns" }),
    ).toBe(true);
    expect(
      shouldCapture({ hostname: "localhost", pathname: "/campaigns" }),
    ).toBe(false);
    expect(
      shouldCapture({ hostname: "get-thesi.com", pathname: "/r/abc" }),
    ).toBe(false);
  });
});

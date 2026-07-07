function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function getBackendBaseUrl(): string | null {
  const serverUrl = process.env.THESI_API_URL || process.env.BACKEND_API_URL;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  return serverUrl || publicUrl || null;
}

export function backendApiUrl(path: string): string {
  const base = getBackendBaseUrl();
  if (!base) {
    throw new Error("API URL is not configured");
  }

  const normalized = normalizeBaseUrl(base);
  const withVersion = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${withVersion}${suffix}`;
}

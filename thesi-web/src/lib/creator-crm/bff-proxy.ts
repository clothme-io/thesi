import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function proxyCreatorCrm(
  request: Request,
  backendPath: string,
  method: string,
  includeBody = true,
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Creator CRM service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const init: RequestInit = {
      method,
      headers: {
        ...(includeBody ? { "Content-Type": "application/json" } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      cache: "no-store",
    };
    if (includeBody && method !== "GET" && method !== "DELETE") {
      init.body = await request.text();
    }
    const response = await fetch(backendApiUrl(backendPath), init);
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the creator CRM service." } },
      { status: 502 },
    );
  }
}

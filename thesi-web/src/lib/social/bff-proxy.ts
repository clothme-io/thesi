import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function proxySocial(
  request: Request,
  backendPath: string,
  method: string,
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Social accounts service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const init: RequestInit = {
      method,
      headers: {
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      cache: "no-store",
    };
    if (method !== "GET" && method !== "DELETE") {
      init.body = await request.text();
    }
    const response = await fetch(backendApiUrl(backendPath), init);
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the social accounts service." } },
      { status: 502 },
    );
  }
}

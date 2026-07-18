import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function GET(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Creator CRM service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(backendApiUrl("/creator-crm"), {
      headers: authorization ? { Authorization: authorization } : {},
      cache: "no-store",
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the creator CRM service." } },
      { status: 502 },
    );
  }
}

import { workspaceHeaders } from "@/lib/workspace-proxy";
import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function GET(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Campaigns service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(backendApiUrl(`/campaigns/products?offset=${encodeURIComponent(new URL(request.url).searchParams.get("offset") ?? "0")}`), {
      headers: { ...workspaceHeaders(request), ...(authorization ? { Authorization: authorization } : {}) },
      cache: "no-store",
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the campaigns service." } },
      { status: 502 },
    );
  }
}


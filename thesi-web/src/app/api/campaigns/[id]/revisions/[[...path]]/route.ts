import { workspaceHeaders } from "@/lib/workspace-proxy";
import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type Params = { params: Promise<{ id: string; path?: string[] }> };

function backendPath(campaignId: string, path: string[] | undefined) {
  const rest = path?.length ? `/${path.join("/")}` : "";
  return `/campaigns/${campaignId}/revisions${rest}`;
}

async function proxy(
  request: Request,
  campaignId: string,
  path: string[] | undefined,
  method: string,
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Campaigns service is not configured." } },
      { status: 503 },
    );
  }
  try {
    const authorization = request.headers.get("authorization");
    const init: RequestInit = {
      method,
      headers: {
        ...workspaceHeaders(request),
        ...(authorization ? { Authorization: authorization } : {}),
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    };
    const response = await fetch(
      backendApiUrl(backendPath(campaignId, path)),
      init,
    );
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the campaigns service." } },
      { status: 502 },
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  const { id, path } = await params;
  return proxy(request, id, path, "GET");
}

export async function POST(request: Request, { params }: Params) {
  const { id, path } = await params;
  return proxy(request, id, path, "POST");
}

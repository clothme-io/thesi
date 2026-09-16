import { workspaceHeaders } from "@/lib/workspace-proxy";
import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type Params = { params: Promise<{ id: string; path?: string[] }> };

function backendPath(campaignId: string, path: string[] | undefined, request: Request) {
  const rest = path?.length ? `/${path.join("/")}` : "";
  const search = new URL(request.url).search;
  return `/campaigns/${campaignId}/submissions${rest}${search}`;
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
    const isMultipart = request.headers
      .get("content-type")
      ?.includes("multipart/form-data");
    const init: RequestInit = {
      method,
      headers: {
        ...workspaceHeaders(request),
        ...(authorization ? { Authorization: authorization } : {}),
        ...(method !== "GET" && !isMultipart
          ? { "Content-Type": "application/json" }
          : {}),
      },
      cache: "no-store",
    };
    if (method !== "GET" && method !== "DELETE") {
      init.body = isMultipart ? await request.formData() : await request.text();
    }
    const response = await fetch(
      backendApiUrl(backendPath(campaignId, path, request)),
      init,
    );
    if (path?.includes("media")) {
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        return NextResponse.json(
          json ?? { error: { message: "Could not load draft media." } },
          { status: response.status },
        );
      }
      const headers = new Headers();
      const contentType = response.headers.get("content-type");
      const disposition = response.headers.get("content-disposition");
      if (contentType) headers.set("Content-Type", contentType);
      if (disposition) headers.set("Content-Disposition", disposition);
      return new NextResponse(response.body, { status: response.status, headers });
    }
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

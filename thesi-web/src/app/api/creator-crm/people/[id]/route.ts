import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function proxy(
  request: Request,
  id: string,
  method: "PATCH" | "DELETE",
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Creator CRM service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const body =
      method === "PATCH" ? JSON.stringify(await request.json()) : undefined;
    const response = await fetch(backendApiUrl(`/creator-crm/people/${id}`), {
      method,
      headers: {
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
      ...(body ? { body } : {}),
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

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxy(request, id, "PATCH");
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxy(request, id, "DELETE");
}

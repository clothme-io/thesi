import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Creator CRM service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const authorization = request.headers.get("authorization");
    const body = await request.json();
    const response = await fetch(backendApiUrl(`/creator-crm/tasks/${id}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
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

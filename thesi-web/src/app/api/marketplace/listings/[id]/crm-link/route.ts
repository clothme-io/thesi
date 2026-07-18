import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Marketplace service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(
      backendApiUrl(`/marketplace/listings/${id}/crm-link`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({}),
        cache: "no-store",
      },
    );
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the marketplace service." } },
      { status: 502 },
    );
  }
}

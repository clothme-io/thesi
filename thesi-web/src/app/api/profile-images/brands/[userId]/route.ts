import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await context.params;
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Profile image service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      backendApiUrl(`/profile-images/brands/${encodeURIComponent(userId)}`),
      { cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: { message: "Brand logo not found." } },
        { status: response.status },
      );
    }
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control":
          response.headers.get("cache-control") ?? "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the profile image service." } },
      { status: 502 },
    );
  }
}

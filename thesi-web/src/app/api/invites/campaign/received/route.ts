import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function GET(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Invites service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json(
        { error: { message: "campaignId is required." } },
        { status: 400 },
      );
    }
    const response = await fetch(
      backendApiUrl(
        `/invites/campaign/received?campaignId=${encodeURIComponent(campaignId)}`,
      ),
      {
        headers: authorization ? { Authorization: authorization } : {},
        cache: "no-store",
      },
    );
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the invites service." } },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function PUT(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Profile service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const body = await request.json();
    const response = await fetch(backendApiUrl("/profile/brand"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the profile service." } },
      { status: 502 },
    );
  }
}

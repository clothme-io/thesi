import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function POST(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Auth service is not configured yet." } },
      { status: 503 },
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    const res = await fetch(backendApiUrl("/onboarding/welcome"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach auth service." } },
      { status: 502 },
    );
  }
}

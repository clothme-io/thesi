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
    const body = await request.json();
    const authHeader = request.headers.get("authorization");
    const res = await fetch(backendApiUrl("/auth/change-password"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
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

import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function POST(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Profile service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const formData = await request.formData();
    const response = await fetch(backendApiUrl("/profile/brand/logo"), {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
      body: formData,
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

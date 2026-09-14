import { NextResponse } from "next/server";
import { backendApiUrl } from "@/lib/backendApi";
import { workspaceHeaders } from "@/lib/workspace-proxy";
export async function GET(request: Request) {
  try {
    const response = await fetch(backendApiUrl("/commission-earnings"), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: request.headers.get("authorization") ?? "",
        ...workspaceHeaders(request),
      },
    });
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error: { message: "Commission reporting is temporarily unavailable." },
      },
      { status: 502 },
    );
  }
}

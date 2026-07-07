import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";
import { parseCreatorApplicationError } from "@/lib/creatorFormErrors";

const UPSTREAM_TIMEOUT_MS = 25000;

async function readUpstreamBody(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (contentType.includes("application/json")) {
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null, text };
    }
  }

  return { json: null, text };
}

export async function POST(request: Request) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      {
        error: {
          message:
            "Creator applications are temporarily unavailable. Please try again later.",
        },
      },
      { status: 503 },
    );
  }

  const upstreamUrl = backendApiUrl("/creator-applications");

  try {
    const body = await request.json();
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const { json, text } = await readUpstreamBody(res);

    if (json) {
      if (!res.ok || json.error) {
        const message = parseCreatorApplicationError(json);
        return NextResponse.json(
          { error: { message } },
          { status: res.ok ? 500 : res.status },
        );
      }
      return NextResponse.json(json, { status: res.status });
    }

    console.error(
      "[creator-applications] non-JSON upstream response:",
      upstreamUrl,
      res.status,
      text.slice(0, 300),
    );
    return NextResponse.json(
      {
        error: {
          message:
            res.status >= 500
              ? "Our application service is temporarily unavailable. Please try again in a few minutes."
              : "Submission failed. Please try again.",
        },
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[creator-applications] POST error:", upstreamUrl, error);
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The application service timed out. Please try again."
        : "Could not reach the application service. Please try again later.";
    return NextResponse.json({ error: { message } }, { status: 502 });
  }
}

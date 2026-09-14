import { NextResponse } from "next/server";
import { backendApiUrl } from "@/lib/backendApi";
import { workspaceHeaders } from "@/lib/workspace-proxy";
type Context = { params: Promise<{ line: string; action?: string[] }> };
async function proxy(request: Request, context: Context) {
  const { line, action = [] } = await context.params;
  if (
    !/^[0-9a-f-]{36}$/i.test(line) ||
    (request.method === "GET"
      ? action.length !== 0
      : action.length !== 1 ||
        !["decide", "replay", "retry", "recover", "risk"].includes(action[0]))
  )
    return NextResponse.json(
      { error: { message: "Not found" } },
      { status: 404 },
    );
  try {
    const r = await fetch(
      backendApiUrl(
        `/commission-settlement/${line}${action.length ? "/" + action[0] : ""}`,
      ),
      {
        method: request.method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(55000),
        headers: {
          Authorization: request.headers.get("authorization") ?? "",
          "Content-Type": "application/json",
          ...workspaceHeaders(request),
        },
        ...(request.method === "POST"
          ? { body: JSON.stringify(await request.json()) }
          : {}),
      },
    );
    const b = await r.json();
    return NextResponse.json(
      r.ok
        ? b
        : {
            error: {
              message:
                typeof b.message === "string"
                  ? b.message
                  : (b.error?.message ?? "Settlement could not be confirmed"),
            },
          },
      { status: r.status, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          message:
            "Confirmation pending. Refresh and replay the existing approval before creating another.",
        },
      },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;

import { NextResponse } from "next/server";
import { backendApiUrl } from "@/lib/backendApi";
import { workspaceHeaders } from "@/lib/workspace-proxy";

type Context = { params: Promise<{ path?: string[] }> };

function targetPath(path: string[] = []) {
  if (path.length === 0) return "/commission-settlement-batches";
  if (path.length === 1 && path[0] === "preview") {
    return "/commission-settlement-batches/preview";
  }
  if (path.length === 1 && /^[0-9a-f-]{36}$/i.test(path[0])) {
    return `/commission-settlement-batches/${path[0]}`;
  }
  return null;
}

async function proxy(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const target = targetPath(path);
  const allowed =
    (request.method === "GET" && path.length === 1) ||
    (request.method === "POST" && path.length === 0);

  if (target === null || !allowed) {
    return NextResponse.json(
      { error: { message: "Not found" } },
      { status: 404 },
    );
  }

  try {
    const r = await fetch(backendApiUrl(target), {
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
    });
    const b = await r.json();
    return NextResponse.json(
      r.ok
        ? b
        : {
            error: {
              message:
                typeof b.message === "string"
                  ? b.message
                  : (b.error?.message ?? "Settlement batch could not run"),
            },
          },
      { status: r.status, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          message:
            "Settlement batch is temporarily unavailable. Refresh before creating another batch.",
        },
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;

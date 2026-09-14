import { NextResponse } from "next/server";
import { backendApiUrl } from "@/lib/backendApi";
import { workspaceHeaders } from "@/lib/workspace-proxy";
type Context = { params: Promise<{ id: string; action?: string[] }> };
async function proxy(request: Request, context: Context) {
  const { id, action = [] } = await context.params;
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    (request.method === "GET"
      ? action.length !== 0
      : action.length !== 1 ||
        !["deposit", "accept-work", "retry", "deposit-action", "recover", "cancel-obligation"].includes(action[0]))
  )
    return NextResponse.json(
      { error: { message: "Not found" } },
      { status: 404 },
    );
  try {
    const response = await fetch(
      backendApiUrl(
        `/campaign-funding/${id}${action.length ? `/${action[0]}` : ""}`,
      ),
      {
        method: request.method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(25000),
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
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          message:
            "Funding request could not be confirmed. Refresh its status before trying again.",
        },
      },
      { status: 502 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;

import { NextResponse } from "next/server";
type Context = { params: Promise<{ action?: string[] }> };
async function proxy(request: Request, context: Context) {
  if (process.env.THESI_LOCAL_PAYMENTS_DEMO !== "true")
    return new Response(null, { status: 404 });
  const { action = [] } = await context.params;
  if (
    action.length > 1 ||
    (action.length &&
      !["refund", "fail-next", "dispute", "accept-creators"].includes(
        action[0],
      ))
  )
    return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (
    origin &&
    !["http://127.0.0.1:3011", "http://localhost:3011"].includes(origin)
  )
    return new Response(null, { status: 403 });
  try {
    const r = await fetch(
      `http://127.0.0.1:5011/v1/local-demo${action.length ? "/" + action[0] : ""}`,
      {
        method: request.method,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      },
    );
    return NextResponse.json(await r.json(), { status: r.status });
  } catch {
    return NextResponse.json(
      { error: { message: "Start the local payment demo server first" } },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;

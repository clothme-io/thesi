import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Billing service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const authorization = request.headers.get("authorization");
    const response = await fetch(backendApiUrl(`/billing/invoices/${id}/pdf`), {
      headers: authorization ? { Authorization: authorization } : {},
      cache: "no-store",
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      return NextResponse.json(
        json ?? { error: { message: "Could not download invoice." } },
        { status: response.status },
      );
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const disposition = response.headers.get("content-disposition");
    if (contentType) headers.set("Content-Type", contentType);
    if (disposition) headers.set("Content-Disposition", disposition);
    const body = await response.arrayBuffer();
    return new NextResponse(body, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the billing service." } },
      { status: 502 },
    );
  }
}

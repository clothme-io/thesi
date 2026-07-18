import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Creator CRM service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const authorization = request.headers.get("authorization");
    const response = await fetch(
      backendApiUrl(`/creator-crm/payments/${id}/pdf`),
      {
        method: "GET",
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      return NextResponse.json(
        json ?? { error: { message: "Could not download invoice PDF." } },
        { status: response.status },
      );
    }

    const buffer = await response.arrayBuffer();
    const disposition = response.headers.get("content-disposition") || "";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          disposition || `attachment; filename="invoice-${id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the creator CRM service." } },
      { status: 502 },
    );
  }
}

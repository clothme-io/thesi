import { NextResponse } from "next/server";
import { backendApiUrl, getBackendBaseUrl } from "@/lib/backendApi";

type RouteContext = {
  params: Promise<{ id: string; fileId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id, fileId } = await context.params;
  if (!getBackendBaseUrl()) {
    return NextResponse.json(
      { error: { message: "Campaigns service is not configured." } },
      { status: 503 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(
      backendApiUrl(`/campaigns/${id}/files/${fileId}/download`),
      {
        headers: authorization ? { Authorization: authorization } : {},
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      return NextResponse.json(
        json ?? { error: { message: "Could not download file." } },
        { status: response.status },
      );
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const disposition = response.headers.get("content-disposition");
    if (contentType) headers.set("Content-Type", contentType);
    if (disposition) headers.set("Content-Disposition", disposition);

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Could not reach the campaigns service." } },
      { status: 502 },
    );
  }
}

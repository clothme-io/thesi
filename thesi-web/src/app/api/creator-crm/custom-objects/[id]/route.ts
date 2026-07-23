import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return proxyCreatorCrm(request, `/creator-crm/custom-objects/${id}`, "PATCH");
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return proxyCreatorCrm(
    request,
    `/creator-crm/custom-objects/${id}`,
    "DELETE",
    false,
  );
}

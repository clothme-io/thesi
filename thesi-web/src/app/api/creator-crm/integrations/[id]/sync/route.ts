import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return proxyCreatorCrm(
    request,
    `/creator-crm/integrations/${id}/sync`,
    "POST",
    false,
  );
}

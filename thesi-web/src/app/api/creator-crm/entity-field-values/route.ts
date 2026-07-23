import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

export async function PUT(request: Request) {
  return proxyCreatorCrm(request, "/creator-crm/entity-field-values", "PUT");
}

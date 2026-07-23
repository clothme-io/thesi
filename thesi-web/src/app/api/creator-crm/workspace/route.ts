import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

export async function GET(request: Request) {
  return proxyCreatorCrm(request, "/creator-crm/workspace", "GET", false);
}

export async function PATCH(request: Request) {
  return proxyCreatorCrm(request, "/creator-crm/workspace", "PATCH");
}

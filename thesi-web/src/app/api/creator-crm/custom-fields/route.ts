import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

export async function POST(request: Request) {
  return proxyCreatorCrm(request, "/creator-crm/custom-fields", "POST");
}

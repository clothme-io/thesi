import { proxyCreatorCrm } from "@/lib/creator-crm/bff-proxy";

export async function POST(request: Request) {
  return proxyCreatorCrm(
    request,
    "/creator-crm/workspace/invites/accept",
    "POST",
  );
}

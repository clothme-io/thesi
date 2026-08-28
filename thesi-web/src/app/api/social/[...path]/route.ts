import { proxySocial } from "@/lib/social/bff-proxy";

type Params = { params: Promise<{ path: string[] }> };

function backendPath(path: string[], request: Request) {
  const search = new URL(request.url).search;
  return `/social/${path.join("/")}${search}`;
}

export async function GET(request: Request, { params }: Params) {
  const { path } = await params;
  return proxySocial(request, backendPath(path, request), "GET");
}

export async function POST(request: Request, { params }: Params) {
  const { path } = await params;
  return proxySocial(request, backendPath(path, request), "POST");
}

import { ObjectDetailContent } from "@/components/creator-crm/ObjectDetailContent";

export default async function ObjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ObjectDetailContent objectId={id} />;
}

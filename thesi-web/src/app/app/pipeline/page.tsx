import { redirect } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export default function LegacyPipelineRedirect() {
  redirect(CRM_ROUTES.pipeline);
}

import { redirect } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export default function LegacyTasksRedirect() {
  redirect(CRM_ROUTES.tasks);
}

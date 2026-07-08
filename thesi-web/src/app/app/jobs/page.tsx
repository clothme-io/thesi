import { redirect } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export default function LegacyJobsRedirect() {
  redirect(CRM_ROUTES.jobs);
}

import { redirect } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export default function LegacyPaymentsRedirect() {
  redirect(CRM_ROUTES.payments);
}

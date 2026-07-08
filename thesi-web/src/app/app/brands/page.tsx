import { redirect } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

export default function LegacyBrandsRedirect() {
  redirect(CRM_ROUTES.brands);
}

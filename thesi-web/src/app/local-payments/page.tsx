import { notFound } from "next/navigation";
import { LocalPaymentsDemo } from "./view";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.THESI_LOCAL_PAYMENTS_DEMO !== "true") notFound();
  return <LocalPaymentsDemo />;
}

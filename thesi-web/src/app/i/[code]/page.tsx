import { redirect } from "next/navigation";
import { clothmeInstallLink } from "@/lib/creator-install-link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Creator app install link | Thesi",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function CreatorInstallPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const destination = clothmeInstallLink(code, process.env);
  if (destination) redirect(destination);
  return (
    <main style={{ padding: 48 }}>
      <h1>Creator link unavailable</h1>
      <p>Please ask the creator for an active link.</p>
    </main>
  );
}

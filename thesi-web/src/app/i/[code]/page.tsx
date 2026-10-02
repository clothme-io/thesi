import { creatorInstallLink } from "@/lib/creator-install-link";
import { clothmeStoreLinks } from "@/lib/clothme-store-links";
import { ContinueToClothme } from "../../r/[code]/ContinueToClothme";

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
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
    return (
      <main style={{ padding: 48 }}>
        <h1>Creator link unavailable</h1>
        <p>Please ask the creator for an active link.</p>
      </main>
    );
  }
  return (
    <main style={{ margin: "0 auto", maxWidth: 760, padding: 48 }}>
      <h1>Install ClothME with this creator</h1>
      <p style={{ lineHeight: 1.7 }}>
        This link helps ClothME attribute a qualified app install to the creator
        who shared it. Earnings depend on the campaign terms, fraud review, and
        one qualified install per shopper.
      </p>
      <ContinueToClothme
        code={code}
        durable
        stores={clothmeStoreLinks(process.env)}
        installLink={creatorInstallLink(code, process.env, "i")}
        originalPath="i"
      />
    </main>
  );
}

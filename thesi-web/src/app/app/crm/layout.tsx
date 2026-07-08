import { CrmSubnav } from "@/components/layout/CrmSubnav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-shell">
      <CrmSubnav />
      <div className="crm-main">{children}</div>
    </div>
  );
}

import { RoleGuard } from "@/components/auth/RoleGuard";
import { CrmSubnav } from "@/components/layout/CrmSubnav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["creator"]}>
      <div className="crm-shell">
        <CrmSubnav />
        <div className="crm-main">{children}</div>
      </div>
    </RoleGuard>
  );
}

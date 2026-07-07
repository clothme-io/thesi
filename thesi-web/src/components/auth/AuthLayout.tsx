import Link from "next/link";
import { isAuthDevMode } from "@/lib/auth-storage";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <Link href="/" className="auth-brand">
          <img src="/clothme-logo.png" alt="" aria-hidden="true" />
          <span>Thesi</span>
        </Link>

        <div className="auth-card">
          {isAuthDevMode() && (
            <div className="auth-dev-banner" role="status">
              Dev mode is on. Use any email/password to preview the UI. Try password{" "}
              <code>temp123</code> to simulate a first-login password change.
            </div>
          )}
          <h1>{title}</h1>
          <p className="auth-card-sub">{subtitle}</p>
          {children}
        </div>

        <Link href="/" className="auth-back">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

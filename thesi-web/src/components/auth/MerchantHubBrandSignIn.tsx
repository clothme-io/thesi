"use client";

import { startMerchantSignin } from "@/lib/merchant-signin";

type MerchantHubBrandSignInProps = {
  disabled?: boolean;
  onError: (message: string) => void;
};

export function MerchantHubBrandSignIn({
  disabled = false,
  onError,
}: MerchantHubBrandSignInProps) {
  if (process.env.NEXT_PUBLIC_MERCHANT_SSO_ENABLED !== "true") return null;

  return (
    <div className="auth-merchant">
      <button
        type="button"
        className="auth-submit"
        disabled={disabled}
        onClick={() =>
          void startMerchantSignin().catch((error) =>
            onError(
              error instanceof Error
                ? error.message
                : "Merchant sign-in failed",
            ),
          )
        }
      >
        Brand sign in with Merchant Hub
      </button>
      <p className="auth-merchant-hint">
        For connected brand and vendor accounts only.
      </p>
    </div>
  );
}

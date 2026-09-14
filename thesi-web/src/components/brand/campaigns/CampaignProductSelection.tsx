"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import type { PromotedProduct } from "@/lib/brand-campaigns/types";
import { MerchantProductSelector } from "./MerchantProductSelector";
import { PromotedProductDetails } from "./PromotedProductDetails";
export type ProductSelection = { productId: string; variantIds?: string[] };
export function campaignProducts(payment: {
  promotedProducts?: PromotedProduct[];
  promotedProduct?: PromotedProduct;
}) {
  return (
    payment.promotedProducts ??
    (payment.promotedProduct ? [payment.promotedProduct] : [])
  );
}
export function productSelections(
  products: PromotedProduct[],
): ProductSelection[] {
  return products.map((p) => ({
    productId: p.productId,
    ...(p.variants ? { variantIds: p.variants.map((v) => v.id) } : {}),
  }));
}
export function productInput(value: ProductSelection[], multi = false) {
  return multi ||
    process.env.NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED === "true"
    ? { merchantProducts: value }
    : { merchantProductId: value[0]?.productId ?? null };
}
export function CampaignProductSelection({
  value,
  onChange,
  initial = [],
  locked = false,
}: {
  value: ProductSelection[];
  onChange: (v: ProductSelection[]) => void;
  initial?: PromotedProduct[];
  locked?: boolean;
}) {
  if (locked)
    return (
      <>
        {initial.map((p) => (
          <PromotedProductDetails key={p.productId} product={p} />
        ))}
      </>
    );
  if (process.env.NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED !== "true")
    return initial.some((p) => !!p.variants) || initial.length > 1 ? (
      <>
        {initial.map((p) => (
          <PromotedProductDetails key={p.productId} product={p} />
        ))}
      </>
    ) : (
      <MerchantProductSelector
        value={value[0]?.productId ?? null}
        initial={initial[0]}
        onChange={(id) => onChange(id ? [{ productId: id }] : [])}
      />
    );
  return <Multiple value={value} onChange={onChange} initial={initial} />;
}
function Multiple({
  value,
  onChange,
  initial,
}: {
  value: ProductSelection[];
  onChange: (v: ProductSelection[]) => void;
  initial: PromotedProduct[];
}) {
  const { authenticatedRequest } = useAuth();
  const [products, setProducts] = useState(initial),
    [offset, setOffset] = useState(0),
    [next, setNext] = useState<number | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    authenticatedRequest<{
      enabled: boolean;
      products: PromotedProduct[];
      nextOffset: number | null;
    }>(`/api/campaigns/products?offset=${offset}`)
      .then((r) => {
        if (!live) return;
        if (!r.enabled) throw new Error("Merchant product selection is paused");
        setProducts((old) => [
          ...old.filter(
            (p) => !r.products.some((n) => n.productId === p.productId),
          ),
          ...r.products,
        ]);
        setNext(r.nextOffset);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [authenticatedRequest, offset, retry]);
  return (
    <section className="workspace-section">
      <h3>Products to promote</h3>
      <p>
        Select up to 10 products and the variants that qualify for commission.
        Listed prices are recorded with the agreement; checkout uses current
        prices. Published and funded selections cannot be changed.
      </p>
      {products.map((p) => {
        const selected = value.find((v) => v.productId === p.productId),
          ids = selected?.variantIds ?? p.variants?.map((v) => v.id) ?? [];
        return (
          <fieldset
            key={p.productId}
            disabled={loading || !!error}
            style={{ marginBottom: 16, padding: 12 }}
          >
            <legend>
              <label>
                <input
                  type="checkbox"
                  checked={!!selected}
                  disabled={
                    loading ||
                    !!error ||
                    (!selected && (value.length >= 10 || !p.variants?.length))
                  }
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [
                            ...value,
                            {
                              productId: p.productId,
                              variantIds: p.variants!.map((v) => v.id),
                            },
                          ]
                        : value.filter((v) => v.productId !== p.productId),
                    )
                  }
                />{" "}
                {p.title} — {p.brandName}
              </label>
            </legend>
            {selected &&
              p.variants?.map((v) => (
                <label key={v.id} style={{ display: "block", margin: 8 }}>
                  <input
                    type="checkbox"
                    checked={ids.includes(v.id)}
                    disabled={ids.length === 1 && ids.includes(v.id)}
                    onChange={(e) =>
                      onChange(
                        value.map((s) =>
                          s.productId === p.productId
                            ? {
                                productId: p.productId,
                                variantIds: e.target.checked
                                  ? [...ids, v.id]
                                  : ids.filter((id) => id !== v.id),
                              }
                            : s,
                        ),
                      )
                    }
                  />{" "}
                  {v.color} / {v.size} —{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: v.currency,
                  }).format(v.priceCents / 100)}
                </label>
              ))}
            {!p.variants?.length && (
              <p>
                Current variant pricing is unavailable. Reload the catalog
                before selecting this product.
              </p>
            )}
          </fieldset>
        );
      })}
      {value
        .filter((v) => !products.some((p) => p.productId === v.productId))
        .map((v) => (
          <p key={v.productId}>
            Selected product is not in the loaded results.{" "}
            <button
              type="button"
              onClick={() =>
                onChange(value.filter((p) => p.productId !== v.productId))
              }
            >
              Remove selection
            </button>
          </p>
        ))}
      {!loading && !error && !products.length && (
        <p>No eligible products are available for this brand.</p>
      )}
      {loading && <p role="status">Loading products…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((r) => r + 1)}>
            Retry
          </button>
        </p>
      )}
      {next !== null && (
        <button
          type="button"
          disabled={loading}
          onClick={() => setOffset(next)}
        >
          Load more products
        </button>
      )}
    </section>
  );
}

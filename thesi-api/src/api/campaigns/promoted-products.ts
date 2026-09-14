import type { PromotedProduct } from './campaign-products.service';
export type ProductSelection = { productId: string; variantIds?: string[] };
export function promotedProducts(payment?: {
  promotedProducts?: PromotedProduct[];
  promotedProduct?: PromotedProduct;
}): PromotedProduct[] {
  return (
    payment?.promotedProducts ??
    (payment?.promotedProduct ? [payment.promotedProduct] : [])
  );
}
export function selectionKey(items: ProductSelection[]): string {
  return JSON.stringify(
    items
      .map((p) => ({
        productId: p.productId,
        variantIds: p.variantIds ? [...p.variantIds].sort() : undefined,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
  );
}
export function selectedProducts(items: PromotedProduct[]): ProductSelection[] {
  return items.map((p) => ({
    productId: p.productId,
    ...(p.variants ? { variantIds: p.variants.map((v) => v.id) } : {}),
  }));
}

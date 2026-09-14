import { DEFAULT_COMMISSION_RULES } from './commission-rules';
import { isDeepStrictEqual } from 'node:util';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  promotedProducts,
  selectedProducts,
  selectionKey,
} from './promoted-products';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import type { CampaignRecord } from './campaign.repository';
import type { UpsertCampaignDto } from './dto/campaign.dto';

export type PromotedProduct = {
  productId: string;
  brandId: string;
  vendorId: string;
  linkId: string;
  workspaceId: string;
  brandName: string;
  title: string;
  description: string;
  imageUrl: string | null;
  previewUrl: string;
  verifiedAt: string;
  variants?: {
    id: string;
    color: string;
    size: string;
    priceCents: number;
    currency: string;
  }[];
};
type Link = {
  id: string;
  vendor_id: string;
  merchant_brand_id: string;
  workspace_id: string;
};
@Injectable()
export class CampaignProductsService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {}
  async onApplicationBootstrap() {
    if (this.config.get('CAMPAIGN_MULTI_PRODUCTS_ENABLED') !== true) return;
    const ready = (
      await this.db.execute(
        sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='thesi' AND table_name='creator_tracking_link' AND column_name='product_id') AS ready`,
      )
    ).rows[0];
    if (!ready?.ready)
      throw new Error('Multi-product campaigns require Thesi V41');
  }
  enabled() {
    return this.config.get('CAMPAIGN_PRODUCTS_ENABLED') === true;
  }
  private async link(userId: string) {
    const ctx = workspaceContext.getStore();
    if (
      !ctx ||
      (ctx.ownerUserId ?? ctx.actorUserId) !== userId ||
      !['owner', 'member', 'viewer'].includes(ctx.role)
    )
      throw new ForbiddenException('Select an owned brand workspace');
    const result = await this.db
      .execute(sql`SELECT l.id,l.vendor_id,l.merchant_brand_id,l.workspace_id FROM thesi.merchant_brand_link l
      JOIN thesi.brand_workspace w ON w.id=l.workspace_id
      JOIN thesi.brand_workspace_member m ON m.workspace_id=w.id AND m.user_id=${userId}
      JOIN public.thesi_users u ON u.id=m.user_id
      WHERE l.workspace_id=${ctx.workspaceId}::uuid AND l.revoked_at IS NULL
        AND w.owner_user_id=${userId} AND w.status='active' AND m.role='owner' AND m.status='active'
        AND u.role='brand' AND u.must_change_password=false`);
    const link = result.rows[0] as Link | undefined;
    if (!link)
      throw new BadRequestException(
        'Connect this brand to Merchant Hub before selecting a product',
      );
    return link;
  }
  private async catalog(link: Link, productId?: string, offset = 0) {
    if (!this.enabled())
      throw new NotFoundException('Campaign products are unavailable');
    let response: Response;
    try {
      response = await fetch(
        new URL(
          '/v1/internal/thesi/catalog',
          this.config.getOrThrow<string>('MERCHANT_API_URL'),
        ),
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: {
            'Content-Type': 'application/json',
            'X-Thesi-Catalog-Key': this.config.getOrThrow<string>(
              'MERCHANT_CATALOG_SERVICE_KEY',
            ),
          },
          body: JSON.stringify({
            vendorId: link.vendor_id,
            brandId: link.merchant_brand_id,
            productId,
            offset,
          }),
        },
      );
    } catch {
      throw new BadGatewayException(
        'Merchant catalog is temporarily unavailable. Try again.',
      );
    }
    if (response.status === 404)
      throw new BadRequestException(
        'This Merchant brand or product is no longer available for promotion',
      );
    if (!response.ok)
      throw new BadGatewayException(
        'Merchant catalog is temporarily unavailable. Try again.',
      );
    let data: any;
    try {
      const body = await response.json();
      data = body.data ?? body.result ?? body;
    } catch {
      throw new BadGatewayException('Invalid Merchant catalog response');
    }
    if (
      !Array.isArray(data.products) ||
      data.products.length > 20 ||
      (data.nextOffset !== null &&
        (!Number.isInteger(data.nextOffset) || data.nextOffset !== offset + 20))
    )
      throw new BadGatewayException('Invalid Merchant catalog response');
    const products: PromotedProduct[] = data.products.map((p: any) => {
      if (
        p.vendorId !== link.vendor_id ||
        p.brandId !== link.merchant_brand_id ||
        (productId && p.productId !== productId) ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(p.productId) ||
        typeof p.title !== 'string' ||
        typeof p.description !== 'string' ||
        typeof p.brandName !== 'string'
      )
        throw new BadGatewayException('Invalid Merchant product identity');
      let imageUrl: string | null = null;
      try {
        const url = new URL(p.imageUrl);
        if (url.protocol === 'https:' && !url.username && !url.password)
          imageUrl = url.toString();
      } catch {
        /* optional image */
      }
      let variants: PromotedProduct['variants'];
      if (p.variants !== undefined) {
        if (
          !Array.isArray(p.variants) ||
          !p.variants.length ||
          p.variants.length > 200 ||
          new Set(p.variants.map((v: any) => v?.id)).size !==
            p.variants.length ||
          p.variants.some(
            (v: any) =>
              !v ||
              !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v.id) ||
              typeof v.color !== 'string' ||
              typeof v.size !== 'string' ||
              !Number.isSafeInteger(v.priceCents) ||
              v.priceCents <= 0 ||
              !/^[A-Z]{3}$/.test(v.currency),
          )
        )
          throw new BadGatewayException('Invalid Merchant variants');
        variants = p.variants.map((v: any) => ({
          id: v.id,
          color: v.color.slice(0, 100),
          size: v.size.slice(0, 100),
          priceCents: v.priceCents,
          currency: v.currency,
        }));
      }
      return {
        ...(variants ? { variants } : {}),
        productId: p.productId,
        brandId: p.brandId,
        vendorId: p.vendorId,
        linkId: link.id,
        workspaceId: link.workspace_id,
        title: p.title.slice(0, 500),
        description: p.description.slice(0, 8000),
        brandName: p.brandName.slice(0, 300),
        imageUrl,
        previewUrl: new URL(
          `/product-preview/${p.brandId}/${p.productId}`,
          this.config.getOrThrow<string>('THESI_WEB_URL'),
        ).toString(),
        verifiedAt: new Date().toISOString(),
      };
    });
    if (productId && products.length !== 1)
      throw new BadRequestException('Product is unavailable for promotion');
    return { products, nextOffset: data.nextOffset as number | null };
  }
  async list(userId: string, offset = 0) {
    if (!this.enabled())
      return { enabled: false, products: [], nextOffset: null };
    const link = await this.link(userId);
    const result = await this.catalog(link, undefined, offset);
    if ((await this.link(userId)).id !== link.id)
      throw new BadRequestException(
        'Merchant connection changed. Reload products.',
      );
    return { enabled: true, ...result };
  }
  async prepare(
    userId: string,
    input: UpsertCampaignDto,
    existing?: CampaignRecord,
    preserveDraftSnapshot = false,
  ) {
    const oldRules = existing?.payment.hybrid?.affiliate?.rules;
    const affiliate = input.payment.hybrid?.affiliate;
    if (affiliate && input.payment.model === 'commission') {
      if (oldRules && !affiliate.rules) affiliate.rules = oldRules;
      if (oldRules && (preserveDraftSnapshot || existing?.status !== 'draft')) {
        if (affiliate.rules && !isDeepStrictEqual(affiliate.rules, oldRules))
          throw new BadRequestException(
            'Accepted or funded commission rules are locked',
          );
        affiliate.rules = oldRules;
      } else if (
        !existing &&
        this.config.get('COMMISSION_RULES_ENABLED') === true
      )
        affiliate.rules ??= { ...DEFAULT_COMMISSION_RULES };
      if (
        affiliate.rules &&
        !oldRules &&
        this.config.get('COMMISSION_RULES_ENABLED') !== true
      )
        throw new BadRequestException('Commission rules are not enabled');
      if (
        affiliate.rules &&
        !oldRules &&
        existing &&
        (existing.status !== 'draft' || preserveDraftSnapshot)
      )
        throw new BadRequestException(
          'Create a new campaign to add commission rules',
        );
      if (
        affiliate.rules &&
        (input.merchantProductId ||
          (existing?.payment.promotedProduct &&
            !existing.payment.promotedProducts &&
            !input.merchantProducts))
      )
        throw new BadRequestException(
          'Use variant-scoped products with commission rules',
        );
      if (
        affiliate.rules &&
        input.status === 'active' &&
        !(
          input.merchantProducts?.length ||
          existing?.payment.promotedProducts?.length
        )
      )
        throw new BadRequestException(
          'Commission rules require variant-scoped products',
        );
    }
    const multi =
      input.merchantProducts !== undefined ||
      !!existing?.payment.promotedProducts;
    if (multi) {
      await this.prepareMultiple(
        userId,
        input,
        existing,
        preserveDraftSnapshot,
      );
      return;
    }
    // Never trust product snapshots submitted by a browser. Only the selected ID is input.
    delete input.payment.promotedProducts;
    delete input.payment.promotedProduct;
    const previous = existing?.payment.promotedProduct;
    const requested =
      input.merchantProductId === undefined
        ? previous?.productId
        : input.merchantProductId;
    if (preserveDraftSnapshot && requested !== previous?.productId)
      throw new BadRequestException('The funded campaign product is locked');
    if (existing && existing.status !== 'draft') {
      if (
        requested !== (previous?.productId ?? null) &&
        !(requested === undefined && !previous)
      )
        throw new BadRequestException(
          'The promoted product is locked after publishing. Create a new campaign to change it.',
        );
      if (previous && input.payment.model !== 'commission')
        throw new BadRequestException(
          'Published product commission terms cannot be removed',
        );
      if (previous) input.payment.promotedProduct = previous;
      // Preserve legacy published campaigns and accepted snapshots. Re-activation still checks availability.
      if (
        previous &&
        input.status === 'active' &&
        existing.status !== 'active'
      ) {
        if (!this.enabled())
          throw new BadRequestException(
            'Product campaign activation is paused',
          );
        const link = await this.link(userId);
        if (link.id !== previous.linkId)
          throw new BadRequestException(
            'The campaign Merchant connection is no longer active',
          );
        await this.catalog(link, previous.productId);
      }
      return;
    }
    if (input.payment.model !== 'commission') {
      if (requested)
        throw new BadRequestException(
          'Promoted products require Base + Commission payment',
        );
      return;
    }
    if (!this.enabled()) {
      if (requested !== previous?.productId && requested)
        throw new BadRequestException('Product selection is paused');
      if (previous) {
        if (input.status === 'active')
          throw new BadRequestException(
            'Product campaign activation is paused',
          );
        input.payment.promotedProduct = previous;
      }
      return;
    }
    if (!requested) {
      if (input.status === 'active')
        throw new BadRequestException(
          'Select a Merchant product before publishing a commission campaign',
        );
      return;
    }
    const link = await this.link(userId);
    const { products } = await this.catalog(link, requested);
    if ((await this.link(userId)).id !== link.id)
      throw new BadRequestException(
        'Merchant connection changed. Reload products.',
      );
    const { variants: _variants, ...legacyProduct } = products[0];
    input.payment.promotedProduct =
      preserveDraftSnapshot && previous ? previous : legacyProduct;
  }
  private async prepareMultiple(
    userId: string,
    input: UpsertCampaignDto,
    existing?: CampaignRecord,
    locked = false,
  ) {
    const before = promotedProducts(existing?.payment);
    if (input.merchantProductId !== undefined)
      throw new BadRequestException('Use one product selection format');
    const requested = input.merchantProducts ?? selectedProducts(before);
    delete input.payment.promotedProduct;
    delete input.payment.promotedProducts;
    if (
      requested.length > 10 ||
      new Set(requested.map((p) => p.productId)).size !== requested.length
    )
      throw new BadRequestException('Choose up to 10 distinct products');
    const frozen = locked || !!(existing && existing.status !== 'draft');
    if (frozen) {
      if (selectionKey(requested) !== selectionKey(selectedProducts(before)))
        throw new BadRequestException(
          'Published or funded products and variants are locked. Create a new campaign to change the agreement.',
        );
      if (before.length && input.payment.model !== 'commission')
        throw new BadRequestException(
          'Published commission terms cannot be removed',
        );
      if (existing?.payment.promotedProducts)
        input.payment.promotedProducts = before;
      if (before[0]) input.payment.promotedProduct = before[0];
      if (existing?.status === 'draft' && input.status !== 'active') return;
      if (input.status !== 'active' || existing?.status === 'active') return;
    }
    if (this.config.get('CAMPAIGN_MULTI_PRODUCTS_ENABLED') !== true) {
      if (!frozen) {
        if (
          existing &&
          input.status !== 'active' &&
          selectionKey(requested) === selectionKey(selectedProducts(before)) &&
          input.payment.model === existing.payment.model
        ) {
          if (existing.payment.promotedProducts)
            input.payment.promotedProducts = before;
          if (before[0]) input.payment.promotedProduct = before[0];
          return;
        }
        throw new BadRequestException('Multi-product selection is paused');
      }
      throw new BadRequestException('Multi-product activation is paused');
    }
    if (input.payment.model !== 'commission') {
      if (requested.length)
        throw new BadRequestException(
          'Promoted products require Commission payment',
        );
      return;
    }
    if (!requested.length) {
      if (input.status === 'active')
        throw new BadRequestException(
          'Select a Merchant product before publishing',
        );
      return;
    }
    const link = await this.link(userId);
    if (frozen && before.some((p) => p.linkId !== link.id))
      throw new BadRequestException('Campaign Merchant connection changed');
    const snapshots: PromotedProduct[] = [];
    for (const selection of requested) {
      const {
        products: [product],
      } = await this.catalog(link, selection.productId);
      if (!product.variants?.length)
        throw new BadRequestException(
          'Merchant variant pricing is unavailable',
        );
      const ids = selection.variantIds ?? product.variants.map((v) => v.id);
      if (
        !ids.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !product.variants!.some((v) => v.id === id))
      )
        throw new BadRequestException(
          'Selected variants are no longer available',
        );
      const variants = product.variants.filter((v) => ids.includes(v.id));
      const currency = input.payment.hybrid?.affiliate?.currency ?? 'USD';
      if (variants.some((v) => v.currency !== currency))
        throw new BadRequestException(
          'Selected variants must use the campaign commission currency',
        );
      snapshots.push({ ...product, variants });
    }
    if ((await this.link(userId)).id !== link.id)
      throw new BadRequestException(
        'Merchant connection changed. Reload products.',
      );
    if (!frozen) {
      input.payment.promotedProducts = snapshots;
      input.payment.promotedProduct = snapshots[0];
    }
  }
  async preview(brandId: string, productId: string) {
    if (!this.enabled()) throw new NotFoundException();
    const result = await this.db
      .execute(sql`SELECT l.id,l.vendor_id,l.merchant_brand_id,l.workspace_id FROM thesi.merchant_brand_link l
      JOIN thesi.brand_workspace w ON w.id=l.workspace_id WHERE l.merchant_brand_id=${brandId}::uuid AND l.revoked_at IS NULL AND w.status='active'`);
    const link = result.rows[0] as Link | undefined;
    if (!link) throw new NotFoundException('Product preview is unavailable');
    const {
      products: [p],
    } = await this.catalog(link, productId);
    return {
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      brandName: p.brandName,
    };
  }
}

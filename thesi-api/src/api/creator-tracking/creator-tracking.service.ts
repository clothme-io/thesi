import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { promotedProducts } from '../campaigns/promoted-products';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import {
  CampaignProductsService,
  type PromotedProduct,
} from '../campaigns/campaign-products.service';
import { assertCommissionPayment } from '../campaigns/commission-payment';
import type { CampaignPaymentDto } from '../campaigns/dto/campaign.dto';
type Db = NodePgDatabase<typeof schema>;
type Executor = Pick<Db, 'execute'>;
type Context = {
  id: string;
  snapshot_id: string;
  creator_id: string;
  campaign_id: string;
  workspace_id: string;
  product: PromotedProduct;
  payment: CampaignPaymentDto;
};
export const clickDigest = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
const token = () => randomBytes(32).toString('base64url');
@Injectable()
export class CreatorTrackingService implements OnApplicationBootstrap {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly products: CampaignProductsService,
  ) {}
  private enabled() {
    if (this.config.get('CREATOR_TRACKING_ENABLED') !== true)
      throw new NotFoundException('Creator tracking is unavailable');
  }
  private newLinks() {
    if (this.config.get('CREATOR_LINKS_ENABLED') !== true)
      throw new ServiceUnavailableException('New creator links are paused');
  }
  async onApplicationBootstrap() {
    if (this.config.get('CREATOR_TRACKING_ENABLED') !== true) return;
    const result = await this.db.execute(
      sql`SELECT to_regclass('thesi.creator_click_grant') IS NOT NULL AS ready`,
    );
    if (!result.rows[0]?.ready)
      throw new Error('Creator tracking requires Thesi V36 before activation');
  }
  private async context(
    db: Executor,
    condition: SQL,
    active: boolean,
  ): Promise<Context> {
    const result =
      await db.execute(sql`SELECT l.id,s.id AS snapshot_id,s.creator_user_id AS creator_id,s.campaign_id,c.workspace_id,
      s.payment_snapshot AS payment,chosen.product AS product
      FROM thesi.creator_tracking_link l
      JOIN thesi.campaign_acceptance_snapshot s ON s.id=l.acceptance_snapshot_id
      CROSS JOIN LATERAL (SELECT p AS product FROM jsonb_array_elements(COALESCE(s.payment_snapshot->'promotedProducts',jsonb_build_array(s.payment_snapshot->'promotedProduct'))) p
        WHERE p->>'productId'=COALESCE(to_jsonb(l)->>'product_id',s.payment_snapshot#>>'{promotedProduct,productId}')) chosen
      JOIN thesi.campaign c ON c.id=s.campaign_id
      JOIN thesi.brand_workspace w ON w.id=c.workspace_id
      JOIN thesi.merchant_brand_link ml ON ml.id::text=chosen.product->>'linkId'
      JOIN public.thesi_users u ON u.id=s.creator_user_id
      WHERE ${condition} AND l.revoked_at IS NULL AND ml.revoked_at IS NULL AND w.status='active' AND u.role='creator'
        AND ml.workspace_id=c.workspace_id AND ml.vendor_id::text=chosen.product->>'vendorId'
        AND ml.merchant_brand_id::text=chosen.product->>'brandId'
        AND s.payment_snapshot->>'model'='commission'
        ${active ? sql`AND c.status='active' AND c.start_date<=CURRENT_DATE AND c.end_date>=CURRENT_DATE` : sql``}
      FOR SHARE OF l,s,c,w,ml,u`);
    const context = result.rows[0] as Context | undefined;
    if (!context)
      throw new NotFoundException('This creator link is unavailable');
    assertCommissionPayment(context.payment);
    return context;
  }
  async mine(userId: string) {
    if (
      this.config.get('CREATOR_TRACKING_ENABLED') !== true ||
      this.config.get('CREATOR_LINKS_ENABLED') !== true
    )
      return { enabled: false, campaigns: [] };
    const rows = await this.db
      .execute(sql`SELECT DISTINCT ON (s.campaign_id,p.product->>'productId') s.campaign_id AS "campaignId",s.campaign_name AS name,
      p.product->>'title' AS "productTitle",p.product->>'productId' AS "productId"
      FROM thesi.campaign_acceptance_snapshot s CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payment_snapshot->'promotedProducts',jsonb_build_array(s.payment_snapshot->'promotedProduct'))) p(product) WHERE s.creator_user_id=${userId}
      AND s.payment_snapshot->>'model'='commission' AND s.payment_snapshot->'promotedProduct' IS NOT NULL
      ORDER BY s.campaign_id,p.product->>'productId',s.accepted_at,s.id LIMIT 200`);
    return { enabled: true, campaigns: rows.rows };
  }
  async issue(userId: string, campaignId: string, productId?: string) {
    this.enabled();
    this.newLinks();
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT id,payment_snapshot FROM thesi.campaign_acceptance_snapshot WHERE campaign_id=${campaignId}::uuid AND creator_user_id=${userId} ORDER BY accepted_at,id LIMIT 1 FOR SHARE`,
      );
      const snapshotId = result.rows[0]?.id as string | undefined;
      if (!snapshotId)
        throw new ForbiddenException(
          'Accept this campaign before creating a personal link',
        );
      const payment = result.rows[0].payment_snapshot as CampaignPaymentDto;
      const products = promotedProducts(payment),
        selected =
          products.find((p) => p.productId === productId) ??
          (!productId ? products[0] : undefined);
      if (!selected)
        throw new ForbiddenException(
          'Product was not included in your accepted campaign',
        );
      const multi = !!payment.promotedProducts;
      if (multi)
        await tx.execute(
          sql`INSERT INTO thesi.creator_tracking_link(acceptance_snapshot_id,public_code,product_id) VALUES (${snapshotId}::uuid,${token()},${selected.productId}::uuid) ON CONFLICT DO NOTHING`,
        );
      else
        await tx.execute(
          sql`INSERT INTO thesi.creator_tracking_link(acceptance_snapshot_id,public_code) VALUES (${snapshotId}::uuid,${token()}) ON CONFLICT DO NOTHING`,
        );
      const context = await this.context(
        tx,
        sql`l.acceptance_snapshot_id=${snapshotId}::uuid AND COALESCE(to_jsonb(l)->>'product_id',${selected.productId})=${selected.productId}`,
        true,
      );
      const row = await tx.execute(
        sql`SELECT public_code FROM thesi.creator_tracking_link WHERE id=${context.id}::uuid`,
      );
      return {
        url: new URL(
          `/r/${row.rows[0].public_code}`,
          this.config.getOrThrow<string>('THESI_WEB_URL'),
        ).toString(),
      };
    });
  }
  async preview(code: string) {
    this.enabled();
    const c = await this.context(this.db, sql`l.public_code=${code}`, true);
    return this.products.preview(c.product.brandId, c.product.productId);
  }
  async click(code: string) {
    this.enabled();
    this.newLinks();
    // GET previews never count as a click. Only an explicit continue action creates a grant.
    const c = await this.context(this.db, sql`l.public_code=${code}`, true);
    await this.products.preview(c.product.brandId, c.product.productId);
    const grant = token();
    await this.db.transaction(async (tx) => {
      const current = await this.context(tx, sql`l.id=${c.id}::uuid`, true);
      const days = current.payment.hybrid!.affiliate!.attributionWindowDays!;
      await tx.execute(sql`INSERT INTO thesi.creator_click_grant(tracking_link_id,code_hash,redeem_until,expires_at)
        VALUES (${c.id}::uuid,${clickDigest(grant)},now()+interval '15 minutes',now()+${days}*interval '1 day')`);
    });
    return {
      deepLink: `clothme://creator-link/${grant}`,
      redeemWithinSeconds: 900,
    };
  }
  async claim(code: string, buyerKey: string) {
    this.enabled();
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT *,redeem_until<=now() AS redemption_expired,expires_at<=now() AS expired FROM thesi.creator_click_grant WHERE code_hash=${clickDigest(code)} FOR UPDATE`,
      );
      const grant = result.rows[0] as any;
      if (
        !grant ||
        grant.expired ||
        (!grant.buyer_key && grant.redemption_expired)
      )
        throw new NotFoundException(
          'This product link expired. Open the creator link again.',
        );
      if (grant.buyer_key && grant.buyer_key !== buyerKey)
        throw new ForbiddenException(
          'This product link was already claimed by another shopper',
        );
      const c = await this.context(
        tx,
        sql`l.id=${grant.tracking_link_id}::uuid`,
        false,
      );
      await this.products.preview(c.product.brandId, c.product.productId);
      if (!grant.buyer_key)
        await tx.execute(
          sql`UPDATE thesi.creator_click_grant SET buyer_key=${buyerKey},claimed_at=now() WHERE id=${grant.id}::uuid`,
        );
      return this.receipt(c, grant);
    });
  }
  async validate(receiptId: string, buyerKey: string) {
    this.enabled();
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT * FROM thesi.creator_click_grant WHERE id=${receiptId}::uuid AND buyer_key=${buyerKey} AND expires_at>now() FOR SHARE`,
      );
      const grant = result.rows[0] as any;
      if (!grant)
        throw new NotFoundException('Attribution expired or is unavailable');
      const c = await this.context(
        tx,
        sql`l.id=${grant.tracking_link_id}::uuid`,
        false,
      );
      await this.products.preview(c.product.brandId, c.product.productId);
      return this.receipt(c, grant);
    });
  }
  private receipt(
    c: Context,
    grant: { id: string; clicked_at: Date; expires_at: Date },
  ) {
    return {
      version: c.payment.hybrid?.affiliate?.rules ? 3 : c.payment.promotedProducts ? 2 : 1,
      ...(c.payment.promotedProducts
        ? { eligibleVariantIds: c.product.variants!.map((v) => v.id) }
        : {}),
      receiptId: grant.id,
      trackingLinkId: c.id,
      acceptanceSnapshotId: c.snapshot_id,
      campaignId: c.campaign_id,
      workspaceId: c.workspace_id,
      creatorId: c.creator_id,
      productId: c.product.productId,
      brandId: c.product.brandId,
      vendorId: c.product.vendorId,
      clickedAt: new Date(grant.clicked_at).toISOString(),
      expiresAt: new Date(grant.expires_at).toISOString(),
      commission: c.payment.hybrid!.affiliate,
      base: c.payment.hybrid!.base?.enabled
        ? c.payment.hybrid!.base
        : { enabled: false },
    };
  }
}

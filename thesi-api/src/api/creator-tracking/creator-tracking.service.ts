import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { promotedProducts } from '../campaigns/promoted-products';
import { AnalyticsService } from 'src/shared/analytics/analytics.service';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import {
  CampaignProductsService,
  type PromotedProduct,
} from '../campaigns/campaign-products.service';
import {
  assertCommissionPayment,
  isAppInstallPayment,
} from '../campaigns/commission-payment';
import {
  conversionPayout,
  isInstallConversionEvent,
  type InstallConversion,
} from '../campaigns/install-conversions';
import type { CampaignPaymentDto } from '../campaigns/dto/campaign.dto';
import { creatorShareUrl } from './creator-share-url';
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
    @Optional() private readonly analytics?: AnalyticsService,
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
        AND s.payment_snapshot->>'model' IN ('commission','product_commission')
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
    const rows = await this.db.execute(sql`
      SELECT * FROM (
        (
          SELECT DISTINCT ON (s.campaign_id, p.product->>'productId')
            s.campaign_id AS "campaignId",
            s.campaign_name AS name,
            p.product->>'title' AS "productTitle",
            p.product->>'productId' AS "productId",
            s.payment_snapshot#>>'{hybrid,affiliate,commissionType}' AS "commissionType",
            s.payment_snapshot#>>'{hybrid,affiliate,installApp}' AS "installApp",
            l.public_code AS "publicCode"
          FROM thesi.campaign_acceptance_snapshot s
          CROSS JOIN LATERAL jsonb_array_elements(
            COALESCE(s.payment_snapshot->'promotedProducts', jsonb_build_array(s.payment_snapshot->'promotedProduct'))
          ) p(product)
          LEFT JOIN thesi.creator_tracking_link l
            ON l.acceptance_snapshot_id=s.id AND l.revoked_at IS NULL
            AND COALESCE(to_jsonb(l)->>'product_id', s.payment_snapshot#>>'{promotedProduct,productId}')=p.product->>'productId'
          WHERE s.creator_user_id=${userId}
            AND s.payment_snapshot->>'model' IN ('commission','product_commission')
            AND s.payment_snapshot->'promotedProduct' IS NOT NULL
          ORDER BY s.campaign_id, p.product->>'productId', s.accepted_at, s.id
        )
        UNION ALL
        (
          SELECT DISTINCT ON (s.campaign_id)
            s.campaign_id AS "campaignId",
            s.campaign_name AS name,
            NULL::text AS "productTitle",
            NULL::text AS "productId",
            s.payment_snapshot#>>'{hybrid,affiliate,commissionType}' AS "commissionType",
            s.payment_snapshot#>>'{hybrid,affiliate,installApp}' AS "installApp",
            l.public_code AS "publicCode"
          FROM thesi.campaign_acceptance_snapshot s
          LEFT JOIN thesi.creator_tracking_link l
            ON l.acceptance_snapshot_id=s.id AND l.revoked_at IS NULL AND l.product_id IS NULL
          WHERE s.creator_user_id=${userId}
            AND s.payment_snapshot->>'model' IN ('commission','app_install')
            AND s.payment_snapshot#>>'{hybrid,affiliate,commissionType}'='fixed_amount_per_install'
            AND s.payment_snapshot->'promotedProduct' IS NULL
            AND s.payment_snapshot->'promotedProducts' IS NULL
          ORDER BY s.campaign_id, s.accepted_at, s.id
        )
      ) links
      LIMIT 200`);
    return {
      enabled: true,
      campaigns: (
        rows.rows as Array<{
          campaignId: string;
          name: string;
          productTitle: string | null;
          productId: string | null;
          commissionType: string | null;
          installApp: 'customer' | 'vendor' | null;
          publicCode: string | null;
        }>
      ).map((row) => {
        const install =
          row.commissionType === 'fixed_amount_per_install' && !row.productId;
        return {
          campaignId: row.campaignId,
          name: row.name,
          productTitle: row.productTitle ?? null,
          productId: row.productId ?? null,
          commissionType: row.commissionType,
          linkType: install ? 'install' : 'sale',
          url: row.publicCode
            ? creatorShareUrl(
                {
                  publicCode: row.publicCode,
                  productId: row.productId,
                  install,
                  installApp: row.installApp,
                },
                this.config,
              )
            : null,
        };
      }),
    };
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
      const installCampaign = isAppInstallPayment(payment);
      if (installCampaign && !products.length) {
        if (productId)
          throw new ForbiddenException(
            'App install campaigns do not have product links',
          );
        await tx.execute(
          sql`INSERT INTO thesi.creator_tracking_link(acceptance_snapshot_id,public_code) VALUES (${snapshotId}::uuid,${token()}) ON CONFLICT DO NOTHING`,
        );
        const row = await tx.execute(
          sql`SELECT public_code FROM thesi.creator_tracking_link WHERE acceptance_snapshot_id=${snapshotId}::uuid AND product_id IS NULL`,
        );
        this.analytics?.track('creator_tracking_link_issued', userId, {
          campaign_id: campaignId,
          acceptance_snapshot_id: snapshotId,
          commission_type: payment.hybrid?.affiliate?.commissionType,
          link_type: 'install',
        });
        return {
          url: creatorShareUrl(
            {
              publicCode: String(row.rows[0].public_code),
              install: true,
              installApp: payment.hybrid?.affiliate?.installApp,
            },
            this.config,
          ),
        };
      }
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
      this.analytics?.track('creator_tracking_link_issued', userId, {
        campaign_id: context.campaign_id,
        tracking_link_id: context.id,
        acceptance_snapshot_id: context.snapshot_id,
        product_id: context.product.productId,
        commission_type: context.payment.hybrid?.affiliate?.commissionType,
      });
      return {
        url: creatorShareUrl(
          {
            publicCode: String(row.rows[0].public_code),
            productId: selected.productId,
          },
          this.config,
        ),
      };
    });
  }
  async issueAccepted(userId: string, campaignId: string) {
    try {
      this.enabled();
      this.newLinks();
    } catch {
      return;
    }
    try {
      const result = await this.db.execute(
        sql`SELECT payment_snapshot FROM thesi.campaign_acceptance_snapshot WHERE campaign_id=${campaignId}::uuid AND creator_user_id=${userId} ORDER BY accepted_at,id LIMIT 1`,
      );
      const payment = result.rows[0]?.payment_snapshot as
        | CampaignPaymentDto
        | undefined;
      if (!payment) return;
      const products = promotedProducts(payment);
      if (isAppInstallPayment(payment) && !products.length) {
        await this.issue(userId, campaignId);
        return;
      }
      for (const product of products)
        await this.issue(userId, campaignId, product.productId);
    } catch {
      /* Accept still succeeds if link minting is paused or the campaign is not commission. */
    }
  }
  async preview(code: string) {
    this.enabled();
    const c = await this.context(this.db, sql`l.public_code=${code}`, true);
    return {
      ...(await this.products.preview(c.product.brandId, c.product.productId)),
      productId: c.product.productId,
      shareUrl: creatorShareUrl(
        { publicCode: code, productId: c.product.productId },
        this.config,
      ),
    };
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
    this.analytics?.track('creator_link_clicked', c.creator_id, {
      campaign_id: c.campaign_id,
      workspace_id: c.workspace_id,
      tracking_link_id: c.id,
      acceptance_snapshot_id: c.snapshot_id,
      product_id: c.product.productId,
      commission_type: c.payment.hybrid?.affiliate?.commissionType,
    });
    return {
      deepLink: `clothme://creator-link/${grant}`,
      redeemWithinSeconds: 900,
    };
  }
  async openProduct(code: string, buyerKey: string) {
    this.enabled();
    this.newLinks();
    return this.db.transaction(async (tx) => {
      const c = await this.context(tx, sql`l.public_code=${code}`, true);
      await this.products.preview(c.product.brandId, c.product.productId);
      const days = c.payment.hybrid!.affiliate!.attributionWindowDays!;
      const grant = token();
      await tx.execute(sql`INSERT INTO thesi.creator_click_grant(tracking_link_id,code_hash,buyer_key,claimed_at,redeem_until,expires_at)
        VALUES (${c.id}::uuid,${clickDigest(grant)},${buyerKey},now(),now()+interval '15 minutes',now()+${days}*interval '1 day')`);
      const stored = (
        await tx.execute(
          sql`SELECT id,clicked_at,expires_at FROM thesi.creator_click_grant WHERE code_hash=${clickDigest(grant)}`,
        )
      ).rows[0] as { id: string; clicked_at: Date; expires_at: Date };
      this.analytics?.track('creator_click_claimed', c.creator_id, {
        campaign_id: c.campaign_id,
        workspace_id: c.workspace_id,
        tracking_link_id: c.id,
        acceptance_snapshot_id: c.snapshot_id,
        product_id: c.product.productId,
        receipt_id: stored.id,
        commission_type: c.payment.hybrid?.affiliate?.commissionType,
      });
      return this.receipt(c, stored);
    });
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
      const receipt = this.receipt(c, grant);
      this.analytics?.track('creator_click_claimed', c.creator_id, {
        campaign_id: c.campaign_id,
        workspace_id: c.workspace_id,
        tracking_link_id: c.id,
        acceptance_snapshot_id: c.snapshot_id,
        product_id: c.product.productId,
        receipt_id: receipt.receiptId,
        commission_type: c.payment.hybrid?.affiliate?.commissionType,
      });
      return receipt;
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
  async claimInstall(code: string, buyerKey: string) {
    this.enabled();
    return this.db.transaction(async (tx) => {
      const result =
        await tx.execute(sql`SELECT l.id AS tracking_link_id,s.id AS snapshot_id,s.creator_user_id,s.campaign_id,c.workspace_id,s.payment_snapshot AS payment
        FROM thesi.creator_tracking_link l
        JOIN thesi.campaign_acceptance_snapshot s ON s.id=l.acceptance_snapshot_id
        JOIN thesi.campaign c ON c.id=s.campaign_id
        JOIN thesi.brand_workspace w ON w.id=c.workspace_id
        JOIN public.thesi_users u ON u.id=s.creator_user_id
        WHERE l.public_code=${code}
          AND l.revoked_at IS NULL
          AND to_jsonb(l)->>'product_id' IS NULL
          AND w.status='active'
          AND u.role='creator'
          AND c.status='active'
          AND c.start_date<=CURRENT_DATE
          AND c.end_date>=CURRENT_DATE
          AND s.payment_snapshot->>'model' IN ('commission','app_install')
          AND s.payment_snapshot#>>'{hybrid,affiliate,commissionType}'='fixed_amount_per_install'
        FOR SHARE OF l,s,c,w,u`);
      const row = result.rows[0] as
        | {
            tracking_link_id: string;
            snapshot_id: string;
            creator_user_id: string;
            campaign_id: string;
            workspace_id: string;
            payment: CampaignPaymentDto;
          }
        | undefined;
      if (!row) throw new NotFoundException('This creator install link is unavailable');
      assertCommissionPayment(row.payment);
      const affiliate = row.payment.hybrid!.affiliate!;
      const days = affiliate.attributionWindowDays ?? 30;
      const expiresAt = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000,
      ).toISOString();
      await tx.execute(sql`INSERT INTO thesi.creator_install_touchpoint(tracking_link_id,acceptance_snapshot_id,buyer_key,creator_user_id,workspace_id,campaign_id,expires_at)
        VALUES(${row.tracking_link_id}::uuid,${row.snapshot_id}::uuid,${buyerKey},${row.creator_user_id},${row.workspace_id}::uuid,${row.campaign_id}::uuid,${expiresAt}::timestamptz)
        ON CONFLICT (campaign_id,buyer_key) DO NOTHING`);
      const bound = (
        await tx.execute(
          sql`SELECT bound_at,expires_at FROM thesi.creator_install_touchpoint WHERE campaign_id=${row.campaign_id}::uuid AND buyer_key=${buyerKey}`,
        )
      ).rows[0] as { bound_at: Date; expires_at: Date };
      this.analytics?.track('creator_install_bound', row.creator_user_id, {
        campaign_id: row.campaign_id,
        workspace_id: row.workspace_id,
        tracking_link_id: row.tracking_link_id,
        acceptance_snapshot_id: row.snapshot_id,
        install_app: affiliate.installApp ?? 'customer',
        conversion_count: affiliate.conversions?.length ?? 0,
      });
      if (affiliate.conversions?.length) {
        return {
          campaignId: row.campaign_id,
          creatorId: row.creator_user_id,
          currency: affiliate.currency,
          accruedCents: 0,
          state: 'bound',
          boundAt: new Date(bound.bound_at).toISOString(),
          expiresAt: new Date(bound.expires_at).toISOString(),
        };
      }
      const fixedAmountCents = affiliate.fixedAmountCents ?? 0;
      await tx.execute(sql`INSERT INTO thesi.commission_install_event(tracking_link_id,acceptance_snapshot_id,buyer_key,creator_user_id,workspace_id,campaign_id,conversion_event,source,currency,accrued_cents,state,reasons)
        VALUES(${row.tracking_link_id}::uuid,${row.snapshot_id}::uuid,${buyerKey},${row.creator_user_id},${row.workspace_id}::uuid,${row.campaign_id}::uuid,'legacy_qualified_install',${JSON.stringify({code,buyerKey,commission:affiliate})}::jsonb,${affiliate.currency},${fixedAmountCents},'under_review',${JSON.stringify(['qualified_install_pending_review'])}::jsonb)
        ON CONFLICT (campaign_id,buyer_key,conversion_event) DO NOTHING`);
      const stored = (
        await tx.execute(
          sql`SELECT event_id,accrued_cents::text AS accrued_cents,state,received_at FROM thesi.commission_install_event WHERE campaign_id=${row.campaign_id}::uuid AND buyer_key=${buyerKey} AND conversion_event='legacy_qualified_install'`,
        )
      ).rows[0] as any;
      this.analytics?.track('creator_install_attributed', row.creator_user_id, {
        campaign_id: row.campaign_id,
        workspace_id: row.workspace_id,
        tracking_link_id: row.tracking_link_id,
        acceptance_snapshot_id: row.snapshot_id,
        event_id: stored.event_id,
        accrued_cents: Number(stored.accrued_cents),
        state: stored.state,
        commission_type: affiliate.commissionType,
      });
      return {
        eventId: stored.event_id,
        campaignId: row.campaign_id,
        creatorId: row.creator_user_id,
        currency: affiliate.currency,
        accruedCents: Number(stored.accrued_cents),
        state: stored.state,
        receivedAt: new Date(stored.received_at).toISOString(),
        boundAt: new Date(bound.bound_at).toISOString(),
        expiresAt: new Date(bound.expires_at).toISOString(),
      };
    });
  }
  async recordConversion(
    buyerKey: string,
    event: string,
    listedProductCount?: number,
  ) {
    this.enabled();
    if (!isInstallConversionEvent(event)) {
      throw new NotFoundException('This conversion event is unavailable');
    }
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        SELECT t.tracking_link_id,t.acceptance_snapshot_id AS snapshot_id,t.creator_user_id,t.workspace_id,t.campaign_id,s.payment_snapshot AS payment
        FROM thesi.creator_install_touchpoint t
        JOIN thesi.campaign_acceptance_snapshot s ON s.id=t.acceptance_snapshot_id
        JOIN thesi.creator_tracking_link l ON l.id=t.tracking_link_id
        WHERE t.buyer_key=${buyerKey}
          AND t.expires_at>now()
          AND l.revoked_at IS NULL
        FOR SHARE OF t,s,l`);
      const applied: Array<{
        campaignId: string;
        creatorId: string;
        event: string;
        accruedCents: number;
        state: string;
      }> = [];
      for (const raw of result.rows as Array<{
        tracking_link_id: string;
        snapshot_id: string;
        creator_user_id: string;
        workspace_id: string;
        campaign_id: string;
        payment: CampaignPaymentDto;
      }>) {
        const affiliate = raw.payment.hybrid?.affiliate;
        const payout = conversionPayout(
          affiliate?.conversions as InstallConversion[] | undefined,
          event,
          listedProductCount,
        );
        if (!payout.selected) continue;
        const accruedCents = payout.amountCents ?? 0;
        const reasons =
          accruedCents > 0
            ? ['conversion_pending_review']
            : ['tracked_no_payout'];
        await tx.execute(sql`INSERT INTO thesi.commission_install_event(tracking_link_id,acceptance_snapshot_id,buyer_key,creator_user_id,workspace_id,campaign_id,conversion_event,source,currency,accrued_cents,state,reasons)
          VALUES(${raw.tracking_link_id}::uuid,${raw.snapshot_id}::uuid,${buyerKey},${raw.creator_user_id},${raw.workspace_id}::uuid,${raw.campaign_id}::uuid,${event},${JSON.stringify({buyerKey,event,listedProductCount,commission:affiliate})}::jsonb,${affiliate?.currency ?? 'USD'},${accruedCents},'under_review',${JSON.stringify(reasons)}::jsonb)
          ON CONFLICT (campaign_id,buyer_key,conversion_event) DO NOTHING`);
        const stored = (
          await tx.execute(
            sql`SELECT accrued_cents::text AS accrued_cents,state FROM thesi.commission_install_event WHERE campaign_id=${raw.campaign_id}::uuid AND buyer_key=${buyerKey} AND conversion_event=${event}`,
          )
        ).rows[0] as { accrued_cents: string; state: string };
        this.analytics?.track('creator_install_converted', raw.creator_user_id, {
          campaign_id: raw.campaign_id,
          workspace_id: raw.workspace_id,
          tracking_link_id: raw.tracking_link_id,
          conversion_event: event,
          accrued_cents: Number(stored.accrued_cents),
          state: stored.state,
        });
        applied.push({
          campaignId: raw.campaign_id,
          creatorId: raw.creator_user_id,
          event,
          accruedCents: Number(stored.accrued_cents),
          state: stored.state,
        });
      }
      return { applied };
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

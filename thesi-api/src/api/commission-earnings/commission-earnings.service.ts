import { promotedProducts } from '../campaigns/promoted-products';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { isDeepStrictEqual } from 'node:util';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { assertCommissionPayment } from '../campaigns/commission-payment';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { CommissionEventDto } from './commission-event.dto';
import { commissionResult } from './commission-math';
@Injectable()
export class CommissionEarningsService implements OnApplicationBootstrap {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {}
  private enabled() {
    if (this.config.get('COMMISSION_EARNINGS_ENABLED') !== true)
      throw new ServiceUnavailableException(
        'Commission reporting is unavailable',
      );
  }
  async onApplicationBootstrap() {
    if (this.config.get('COMMISSION_EARNINGS_ENABLED') !== true) return;
    const r = await this.db.execute(
      sql`SELECT to_regclass('thesi.commission_earning_event') IS NOT NULL AS ready`,
    );
    if (!r.rows[0]?.ready)
      throw new Error(
        'Commission earnings require Thesi V37 before activation',
      );
  }
  async ingest(event: CommissionEventDto) {
    this.enabled();
    event = JSON.parse(JSON.stringify(event)) as CommissionEventDto;
    return this.db.transaction(async (tx) => {
      // Serializes all receipts for the same external order line, including first insertion.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.orderLineId}, 0))`,
      );
      const prior = (
        await tx.execute(
          sql`SELECT * FROM thesi.commission_earning_event WHERE order_line_id=${event.orderLineId}::uuid ORDER BY revision DESC LIMIT 1`,
        )
      ).rows[0] as any;
      const duplicate = (
        await tx.execute(
          sql`SELECT source FROM thesi.commission_earning_event WHERE event_id=${event.eventId}::uuid OR (order_line_id=${event.orderLineId}::uuid AND revision=${event.revision})`,
        )
      ).rows;
      if (duplicate.length) {
        if (
          duplicate.length !== 1 ||
          !isDeepStrictEqual(duplicate[0].source, event)
        )
          throw new ConflictException(
            'Event identity was reused with different facts',
          );
        return { accepted: true, duplicate: true };
      }
      if (event.revision !== (prior?.revision ?? 0) + 1)
        throw new ConflictException(
          'Deliver the preceding order-line revision first',
        );
      if (
        prior &&
        (
          [
            'receiptId',
            'orderId',
            'productId',
            'variantId',
            'brandId',
            'vendorId',
            'currency',
            'purchasedAt',
            'netSaleCents',
          ] as const
        ).some((k) => prior.source[k] !== event[k])
      )
        throw new ConflictException(
          'Original sale identity and value cannot change',
        );
      if ((event.refundedNetCents ?? 0) < (prior?.source.refundedNetCents ?? 0))
        throw new ConflictException(
          'Successful merchandise refunds cannot decrease',
        );
      if ((event.refundedPlatformFeeCents ?? 0) < (prior?.source.refundedPlatformFeeCents ?? 0)) throw new ConflictException('Successful platform fee refunds cannot decrease');
      if (prior?.source.fullyRefunded && !event.fullyRefunded)
        throw new ConflictException('A fully refunded sale cannot be restored');
      // Historical receipt: expiry/revocation today must not erase a purchase already attributed at checkout.
      const r = (
        await tx.execute(sql`SELECT COALESCE(to_jsonb(l)->>'product_id',s.payment_snapshot#>>'{promotedProduct,productId}') AS product_id,s.payment_snapshot AS payment,s.creator_user_id,s.campaign_id,g.clicked_at,g.expires_at,g.claimed_at
        FROM thesi.creator_click_grant g JOIN thesi.creator_tracking_link l ON l.id=g.tracking_link_id
        JOIN thesi.campaign_acceptance_snapshot s ON s.id=l.acceptance_snapshot_id
        WHERE g.id=${event.receiptId}::uuid AND g.claimed_at IS NOT NULL`)
      ).rows[0] as any;
      if (!r)
        throw new NotFoundException('Accepted attribution receipt not found');
      const p = promotedProducts(r.payment).find(p=>p.productId===r.product_id);
      const time = Date.parse(event.purchasedAt);
      if (
        !p ||
        p.productId !== event.productId ||
        (!!r.payment.promotedProducts&&!p.variants?.some(v=>v.id===event.variantId)) ||
        p.brandId !== event.brandId ||
        p.vendorId !== event.vendorId ||
        !Number.isFinite(time) ||
        time < new Date(r.claimed_at).getTime() ||
        time >= new Date(r.expires_at).getTime()
      )
        throw new ForbiddenException(
          'Sale does not match its attribution receipt',
        );
      if (r.payment.model !== 'commission')
        throw new ForbiddenException('No accepted commission terms');
      assertCommissionPayment(r.payment);
      const affiliate = r.payment.hybrid.affiliate;
      const result = commissionResult(
        event,
        affiliate.commissionType,
        affiliate.commissionPercent,
      );
      await tx.execute(sql`INSERT INTO thesi.commission_earning_event(event_id,order_line_id,revision,receipt_id,creator_user_id,workspace_id,campaign_id,vendor_id,brand_id,source,currency,accrued_cents,adjustment_cents,state,reasons)
        VALUES(${event.eventId}::uuid,${event.orderLineId}::uuid,${event.revision},${event.receiptId}::uuid,${r.creator_user_id},${p.workspaceId}::uuid,${r.campaign_id}::uuid,${p.vendorId}::uuid,${p.brandId}::uuid,${JSON.stringify(event)}::jsonb,${event.currency},${result.accruedCents},${result.accruedCents - Number(prior?.accrued_cents ?? 0)},${result.state},${JSON.stringify(result.reasons)}::jsonb)`);
      return { accepted: true, duplicate: false };
    });
  }
  async mine(user: { sub: string; role: string }) {
    this.enabled();
    if (user.role === 'creator')
      return this.report(
        sql`e.creator_user_id=${user.sub}`,
        this.db,
        sql`false`,
        sql`o.creator_user_id=${user.sub}`,
      );
    const w = workspaceContext.getStore();
    if (
      user.role !== 'brand' ||
      !w ||
      w.actorUserId !== user.sub ||
      !['owner','member','viewer'].includes(w.role)
    )
      throw new ForbiddenException('Select a brand workspace you own');
    return this.report(
      sql`e.workspace_id=${w.workspaceId}::uuid`,
      this.db,
      sql`f.workspace_id=${w.workspaceId}::uuid`,
      sql`f.workspace_id=${w.workspaceId}::uuid`,
    );
  }
  async merchant(vendorId: string, brandId: string) {
    this.enabled();
    return this.db.transaction(async (tx) => {
      const link = (
        await tx.execute(
          sql`SELECT workspace_id FROM thesi.merchant_brand_link WHERE vendor_id=${vendorId}::uuid AND merchant_brand_id=${brandId}::uuid AND revoked_at IS NULL FOR SHARE`,
        )
      ).rows[0];
      if (!link) throw new ForbiddenException('Merchant brand is not linked');
      return this.report(
        sql`e.workspace_id=${link.workspace_id}::uuid AND e.vendor_id=${vendorId}::uuid AND e.brand_id=${brandId}::uuid`,
        tx,
        sql`f.workspace_id=${link.workspace_id}::uuid`,
        sql`f.workspace_id=${link.workspace_id}::uuid`,
      );
    });
  }
  async operations() {
    this.enabled();
    return this.report(sql`true`, this.db, sql`true`, sql`true`);
  }
  private async report(
    scope: SQL,
    db: Pick<NodePgDatabase<typeof schema>, 'execute'> = this.db,
    baseFundScope: SQL = sql`false`,
    baseObligationScope: SQL = sql`false`,
  ) {
    // Aggregate the entire scope; the line list is a bounded recent preview, never the basis of totals.
    const cte = sql`WITH latest AS (SELECT DISTINCT ON(e.order_line_id) e.* FROM thesi.commission_earning_event e WHERE ${scope} ORDER BY e.order_line_id,e.revision DESC)`;
    const hasSettlement = (
      await db.execute(
        sql`SELECT to_regclass('thesi.commission_settlement_request') IS NOT NULL AS ready`,
      )
    ).rows[0]?.ready;
    const hasFunding = (
      await db.execute(
        sql`SELECT to_regclass('thesi.campaign_base_fund') IS NOT NULL AS ready`,
      )
    ).rows[0]?.ready;
    const totals = (
      await db.execute(sql`${cte} SELECT currency,count(*)::int AS "attributedLines",count(*) FILTER(WHERE state='reversed')::int AS "reversedLines",
      coalesce(sum(accrued_cents) FILTER(WHERE state='under_review'),0)::text AS "underReviewCents",
      coalesce(sum(accrued_cents) FILTER(WHERE state='held'),0)::text AS "heldCents", count(*) FILTER(WHERE state='held')::int AS "heldLines"
      FROM latest GROUP BY currency ORDER BY currency`)
    ).rows;
    const settlementTotals = hasSettlement
      ? (
          await db.execute(sql`${cte}, latest_request AS (
            SELECT DISTINCT ON(order_line_id) order_line_id,result
            FROM thesi.commission_settlement_request
            WHERE state='confirmed' AND result IS NOT NULL
            ORDER BY order_line_id,confirmed_at DESC NULLS LAST,created_at DESC
          )
          SELECT l.currency,
            coalesce(sum(coalesce((r.result#>>'{totals,creatorPaid}')::bigint,0)),0)::text AS "confirmedCommissionPaidCents",
            coalesce(sum(coalesce((r.result#>>'{totals,creatorRecovered}')::bigint,0)),0)::text AS "confirmedCommissionRecoveredCents",
            coalesce(sum(coalesce((r.result#>>'{totals,creatorPaid}')::bigint,0)-coalesce((r.result#>>'{totals,creatorRecovered}')::bigint,0)),0)::text AS "confirmedCommissionNetPaidCents",
            coalesce(sum(coalesce((r.result#>>'{totals,refundOffset}')::bigint,0)),0)::text AS "confirmedRefundOffsetCents",
            coalesce(sum(coalesce((r.result#>>'{totals,vendorReturned}')::bigint,0)-coalesce((r.result#>>'{totals,vendorRecovered}')::bigint,0)),0)::text AS "confirmedVendorReturnedCents"
          FROM latest l LEFT JOIN latest_request r ON r.order_line_id=l.order_line_id
          GROUP BY l.currency ORDER BY l.currency`)
        ).rows
      : [];
    const baseTotals = hasFunding
      ? (
          await db.execute(sql`WITH fund_scope AS (
            SELECT f.* FROM thesi.campaign_base_fund f WHERE ${baseFundScope}
          ), obligation_scope AS (
            SELECT o.* FROM thesi.campaign_base_obligation o
            JOIN thesi.campaign_base_fund f ON f.campaign_id=o.campaign_id
            WHERE ${baseObligationScope}
          )
          SELECT 'USD' AS currency,
            coalesce((SELECT sum(deposit_cents) FROM fund_scope),0)::text AS "plannedDepositCents",
            coalesce((SELECT sum(fe.amount_cents) FROM thesi.campaign_fund_entry fe JOIN fund_scope f ON f.campaign_id=fe.campaign_id WHERE fe.kind='deposit'),0)::text AS "depositedCents",
            coalesce((SELECT sum(fe.amount_cents) FROM thesi.campaign_fund_entry fe JOIN fund_scope f ON f.campaign_id=fe.campaign_id WHERE fe.kind='refund_unused'),0)::text AS "unusedRefundedCents",
            coalesce((SELECT count(*) FROM obligation_scope),0)::int AS "baseObligations",
            coalesce((SELECT sum(amount_cents) FROM obligation_scope),0)::text AS "baseObligationCents",
            coalesce((SELECT sum(fe.amount_cents) FROM thesi.campaign_fund_entry fe JOIN thesi.campaign_fund_operation op ON op.id=fe.operation_id JOIN obligation_scope o ON o.id=op.obligation_id WHERE fe.kind='release'),0)::text AS "releasedBaseCents",
            coalesce((SELECT sum(fe.amount_cents) FROM thesi.campaign_fund_entry fe JOIN thesi.campaign_fund_operation op ON op.id=fe.operation_id JOIN obligation_scope o ON o.id=op.obligation_id WHERE fe.kind='refund_cancelled'),0)::text AS "cancelledBaseRefundCents"`)
        ).rows
      : [];
    const lines = (
      await db.execute(
        sql`${cte} SELECT order_line_id AS "orderLineId",campaign_id AS "campaignId",currency,accrued_cents::text AS "accruedCents",state,reasons,received_at AS "updatedAt" FROM latest ORDER BY received_at DESC,order_line_id LIMIT 100`,
      )
    ).rows;
    return {
      totals,
      settlementTotals,
      baseTotals,
      lines,
      limit: 100,
      settlement: hasSettlement ? 'confirmed_totals_available' : 'not_enabled',
      notice:
        'Commission estimates, confirmed settlement movement and base content payments are separate. Held amounts need reconciliation before payout decisions.',
    };
  }
}

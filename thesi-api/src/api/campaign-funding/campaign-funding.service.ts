import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { BillingService } from '../billing/billing.service';
import { ConnectService } from '../connect/connect.service';
import { baseFundingPlan } from './funding-plan';
import { FundingGateway } from './funding.gateway';
type Db = NodePgDatabase<typeof schema>;
@Injectable()
export class CampaignFundingService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(CampaignFundingService.name);
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    private readonly connect: ConnectService,
    private readonly gateway: FundingGateway,
  ) {}
  private enabled() {
    if (this.config.get('CAMPAIGN_FUNDING_ENABLED') !== true)
      throw new ServiceUnavailableException('Campaign funding is disabled');
  }
  async onApplicationBootstrap() {
    if (this.config.get('CAMPAIGN_FUNDING_ENABLED') !== true) return;
    const r = await this.db.execute(
      sql`SELECT to_regclass('thesi.funding_recovery_audit') IS NOT NULL AS ready`,
    );
    if (!r.rows[0]?.ready)
      throw new Error('Campaign funding requires Thesi V39');
    this.timer = setInterval(() => void this.tick(), 30000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async campaign(
    userId: string,
    id: string,
    db: Pick<Db, 'execute'> = this.db,
  ) {
    const w = workspaceContext.getStore();
    if (!w || w.role !== 'owner' || w.actorUserId !== userId)
      throw new ForbiddenException('Select a brand workspace you own');
    const c = (
      await db.execute(
        sql`SELECT c.* FROM thesi.campaign c JOIN thesi.brand_workspace w ON w.id=c.workspace_id WHERE c.id=${id}::uuid AND c.workspace_id=${w.workspaceId}::uuid AND c.owner_user_id=${userId} AND w.owner_user_id=${userId} AND w.status='active' FOR UPDATE OF c`,
      )
    ).rows[0] as any;
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }
  async beforeSave(input: any, id?: string) {
    if (input.payment?.model !== 'commission') return;
    if (
      !id &&
      this.config.get('CAMPAIGN_FUNDING_ENABLED') === true &&
      input.payment.hybrid?.affiliate
    ) {
      input.payment = {
        ...input.payment,
        hybrid: {
          ...input.payment.hybrid,
          affiliate: {
            ...input.payment.hybrid.affiliate,
            fundingFlowVersion: 1,
            payoutHandler: 'clothme',
            fundingSource: 'brand',
            fundingTerms:
              'Commission is funded by qualifying sales; an enabled base is prepaid per creator slot.',
          },
        },
      };
    }
    if (input.payment.hybrid?.affiliate?.fundingFlowVersion !== 1) return;
    const plan = baseFundingPlan(input.payment, input.creatorCapacity);
    if (this.config.get('CAMPAIGN_FUNDING_ENABLED') !== true) {
      if (plan.depositCents && input.status === 'active') this.enabled();
      return false;
    }
    const f = id
      ? ((
          await this.db.execute(
            sql`SELECT * FROM thesi.campaign_base_fund WHERE campaign_id=${id}::uuid`,
          )
        ).rows[0] as any)
      : null;
    if (plan.depositCents && input.status === 'active') {
      this.enabled();
      if (!id)
        throw new BadRequestException(
          'Save this campaign as a draft, then fund its base deposit before launch',
        );
      if (
        !f ||
        f.state !== 'funded' ||
        Number(f.deposit_cents) !== plan.depositCents ||
        Number(f.base_cents) !== plan.baseCents ||
        f.slots !== plan.slots
      )
        throw new BadRequestException(
          'Fund the configured base payment and creator slots before launch',
        );
    }
    return !!f;
  }
  async status(userId: string, id: string) {
    this.enabled();
    const c = await this.campaign(userId, id);
    const plan = baseFundingPlan(c.payment, c.creator_capacity);
    const fund = (
      await this.db.execute(
        sql`SELECT state,deposit_cents::text AS "depositCents",closed_at AS "closedAt" FROM thesi.campaign_base_fund WHERE campaign_id=${id}::uuid`,
      )
    ).rows[0];
    const obligations = (
      await this.db.execute(
        sql`SELECT b.id,b.creator_user_id AS "creatorId",s.creator_name AS "creatorName",b.amount_cents::text AS "amountCents",b.accepted_work_at AS "acceptedWorkAt",b.acceptance_note AS "acceptanceNote",b.cancelled_at AS "cancelledAt",o.state AS "payoutState" FROM thesi.campaign_base_obligation b JOIN thesi.campaign_acceptance_snapshot s ON s.id=b.snapshot_id LEFT JOIN thesi.campaign_fund_operation o ON o.obligation_id=b.id WHERE b.campaign_id=${id}::uuid ORDER BY b.created_at`,
      )
    ).rows;
    const entries = (
      await this.db.execute(
        sql`SELECT kind,coalesce(sum(amount_cents),0)::text AS amount FROM thesi.campaign_fund_entry WHERE campaign_id=${id}::uuid GROUP BY kind`,
      )
    ).rows;
    const amount = (kind: string) =>
      Number(entries.find((e) => e.kind === kind)?.amount ?? 0);
    const deposited = amount('deposit'),
      released = amount('release'),
      refunded = amount('refund_unused') + amount('refund_cancelled');
    const operations = (
      await this.db.execute(
        sql`SELECT id,kind,state,amount_cents::text AS "amountCents",last_error AS error FROM thesi.campaign_fund_operation WHERE campaign_id=${id}::uuid ORDER BY created_at`,
      )
    ).rows;
    return {
      plan,
      fund: fund ?? null,
      obligations,
      operations,
      depositedCents: deposited,
      committedCents: obligations.length * plan.baseCents,
      releasedCents: released,
      refundedCents: refunded,
      heldCents: deposited - released - refunded,
      unfilledSlotCents:
        Math.max(0, plan.slots - obligations.length) * plan.baseCents,
      commissionFunding: 'qualifying_sales',
      canRecover: String(this.config.get('SETTLEMENT_OPERATOR_USER_IDS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(userId),
    };
  }
  async deposit(userId: string, id: string, expectedAmountCents: number) {
    this.enabled();
    // Explicit confirmation of this campaign's total authorizes using its owner's saved payment method.
    const c = await this.campaign(userId, id);
    const plan = baseFundingPlan(c.payment, c.creator_capacity);
    if (!plan.depositCents)
      throw new BadRequestException(
        'Commission-only campaigns require no deposit',
      );
    if (!c.payment.promotedProduct?.productId)
      throw new BadRequestException(
        'Select and save the promoted product before funding its campaign',
      );
    if (plan.depositCents !== expectedAmountCents)
      throw new ConflictException('Deposit total changed; review it again');
    if (
      c.status !== 'draft' ||
      c.payment.hybrid.affiliate.fundingFlowVersion !== 1
    )
      throw new BadRequestException(
        'Fund a draft using the agreed campaign funding terms',
      );
    let operation = (
      await this.db.execute(
        sql`SELECT id FROM thesi.campaign_fund_operation WHERE campaign_id=${id}::uuid AND kind='deposit'`,
      )
    ).rows[0];
    if (!operation) {
      const context = await this.billing.resolveCampaignFundingChargeContext(
        userId,
        c.workspace_id,
      );
      if (
        !context?.stripeConfigured ||
        !context.paymentMethodId ||
        context.customerId.startsWith('cus_local_')
      )
        throw new BadRequestException(
          'Add a real default payment method before funding',
        );
      operation = await this.db.transaction(async (tx) => {
        const current = await this.campaign(userId, id, tx);
        const latest = baseFundingPlan(
          current.payment,
          current.creator_capacity,
        );
        if (
          current.status !== 'draft' ||
          latest.depositCents !== plan.depositCents ||
          latest.slots !== plan.slots ||
          latest.baseCents !== plan.baseCents
        )
          throw new ConflictException(
            'Campaign changed; review the deposit again',
          );
        await tx.execute(
          sql`INSERT INTO thesi.campaign_base_fund(campaign_id,workspace_id,owner_user_id,base_cents,slots,deposit_cents) VALUES(${id}::uuid,${current.workspace_id}::uuid,${userId},${plan.baseCents},${plan.slots},${plan.depositCents}) ON CONFLICT DO NOTHING`,
        );
        await tx.execute(
          sql`INSERT INTO thesi.campaign_fund_operation(campaign_id,kind,amount_cents,args) VALUES(${id}::uuid,'deposit',${plan.depositCents},${JSON.stringify({ customerId: context.customerId, paymentMethodId: context.paymentMethodId })}::jsonb) ON CONFLICT DO NOTHING`,
        );
        return (
          await tx.execute(
            sql`SELECT id FROM thesi.campaign_fund_operation WHERE campaign_id=${id}::uuid AND kind='deposit'`,
          )
        ).rows[0];
      });
    }
    await this.process(String(operation.id));
    return this.status(userId, id);
  }
  async acceptWork(
    userId: string,
    id: string,
    obligationId: string,
    note: string,
  ) {
    this.enabled();
    if (!note.trim() || note.length > 2000)
      throw new BadRequestException('Record which delivered work you accepted');
    await this.db.transaction(async (tx) => {
      await this.campaign(userId, id, tx);
      const b = (
        await tx.execute(
          sql`SELECT * FROM thesi.campaign_base_obligation WHERE id=${obligationId}::uuid AND campaign_id=${id}::uuid FOR UPDATE`,
        )
      ).rows[0] as any;
      if (!b) throw new NotFoundException('Creator base obligation not found');
      if (b.cancelled_at)
        throw new ConflictException('This base obligation was cancelled');
      if (!b.accepted_work_at)
        await tx.execute(
          sql`UPDATE thesi.campaign_base_obligation SET accepted_work_at=now(),accepted_work_by=${userId},acceptance_note=${note.trim()} WHERE id=${obligationId}::uuid`,
        );
      await tx.execute(
        sql`INSERT INTO thesi.campaign_fund_operation(campaign_id,kind,obligation_id,amount_cents) VALUES(${id}::uuid,'release',${obligationId}::uuid,${Number(b.amount_cents)}) ON CONFLICT DO NOTHING`,
      );
    });
    return this.status(userId, id);
  }
  async retry(userId: string, id: string, operationId: string) {
    this.enabled();
    await this.campaign(userId, id);
    const op = (
      await this.db.execute(
        sql`SELECT id FROM thesi.campaign_fund_operation WHERE id=${operationId}::uuid AND campaign_id=${id}::uuid`,
      )
    ).rows[0];
    if (!op) throw new NotFoundException();
    await this.process(operationId);
    return this.status(userId, id);
  }
  private operator(userId: string) {
    if (
      !String(this.config.get('SETTLEMENT_OPERATOR_USER_IDS') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(userId)
    )
      throw new ForbiddenException('Funding operator access required');
  }
  async cancelObligation(
    userId: string,
    id: string,
    obligationId: string,
    evidence: string,
  ) {
    this.enabled();
    this.operator(userId);
    if (evidence.trim().length < 10)
      throw new BadRequestException(
        'Record verified cancellation consent or dispute-resolution evidence',
      );
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM thesi.campaign WHERE id=${id}::uuid FOR UPDATE`,
      );
      const b = (
        await tx.execute(
          sql`SELECT * FROM thesi.campaign_base_obligation WHERE id=${obligationId}::uuid AND campaign_id=${id}::uuid FOR UPDATE`,
        )
      ).rows[0] as any;
      if (!b || b.accepted_work_at)
        throw new ConflictException(
          'Accepted or missing work cannot be cancelled through this flow',
        );
      if (b.cancelled_at) return;
      if (
        (
          await tx.execute(
            sql`SELECT id FROM thesi.campaign_fund_operation WHERE obligation_id=${obligationId}::uuid`,
          )
        ).rows.length
      )
        throw new ConflictException(
          'Resolve the existing obligation operation first',
        );
      await tx.execute(
        sql`UPDATE thesi.campaign_base_obligation SET cancelled_at=now(),cancellation_evidence=${evidence} WHERE id=${obligationId}::uuid`,
      );
      await tx.execute(
        sql`INSERT INTO thesi.campaign_fund_operation(campaign_id,kind,obligation_id,amount_cents,args) VALUES(${id}::uuid,'refund_cancelled',${obligationId}::uuid,${Number(b.amount_cents)},${JSON.stringify({ cancellationActor: userId, evidence })}::jsonb)`,
      );
    });
    return { cancelled: true };
  }
  async depositAction(userId: string, id: string) {
    this.enabled();
    const c = await this.campaign(userId, id);
    const op = (
      await this.db.execute(
        sql`SELECT * FROM thesi.campaign_fund_operation WHERE campaign_id=${id}::uuid AND kind='deposit'`,
      )
    ).rows[0] as any;
    if (!op) throw new NotFoundException('Deposit not found');
    const context = await this.billing.resolveCampaignFundingChargeContext(
      userId,
      c.workspace_id,
    );
    if (
      !context ||
      context.customerId !== op.args.customerId ||
      !context.paymentMethodId
    )
      throw new ConflictException(
        'Update the deposit owner’s default payment method first',
      );
    return this.gateway.depositAction(op, context.paymentMethodId);
  }
  async recover(
    userId: string,
    id: string,
    operationId: string,
    providerId: string,
    reason: string,
    retryRefund = false,
  ) {
    this.enabled();
    this.operator(userId);
    if (!reason.trim())
      throw new BadRequestException('Record the recovery reason');
    await this.db.transaction(async (tx) => {
      const op = (
        await tx.execute(
          sql`SELECT * FROM thesi.campaign_fund_operation WHERE id=${operationId}::uuid AND campaign_id=${id}::uuid FOR UPDATE`,
        )
      ).rows[0] as any;
      if (
        !op ||
        op.state === 'succeeded' ||
        (op.lease_until && new Date(op.lease_until).getTime() > Date.now())
      )
        throw new ConflictException('Operation is complete or processing');
      if (retryRefund) {
        await this.gateway.verifyFailedRefund(op);
        await tx.execute(
          sql`INSERT INTO thesi.funding_recovery_audit(operation_id,actor_id,reason,provider_id) VALUES(${operationId}::uuid,${userId},${reason},${op.provider_id})`,
        );
        await tx.execute(
          sql`UPDATE thesi.campaign_fund_operation SET args=${JSON.stringify({ ...op.args, refundRetryId: randomUUID() })}::jsonb,provider_id=NULL,first_attempt_at=NULL,state='pending',lease_until=NULL,next_attempt_at=now(),last_error=NULL WHERE id=${operationId}::uuid`,
        );
        return;
      }
      const result = await this.gateway.verifyRecovery(op, providerId);
      await tx.execute(
        sql`SELECT campaign_id FROM thesi.campaign_base_fund WHERE campaign_id=${id}::uuid FOR UPDATE`,
      );
      await tx.execute(
        sql`INSERT INTO thesi.funding_recovery_audit(operation_id,actor_id,reason,provider_id) VALUES(${operationId}::uuid,${userId},${reason},${providerId})`,
      );
      await tx.execute(
        sql`INSERT INTO thesi.campaign_fund_entry(campaign_id,operation_id,kind,amount_cents,provider_id) VALUES(${id}::uuid,${operationId}::uuid,${op.kind},${Number(op.amount_cents)},${result.id}) ON CONFLICT DO NOTHING`,
      );
      if (op.kind === 'deposit')
        await tx.execute(
          sql`UPDATE thesi.campaign_base_fund SET state='funded',payment_intent_id=${result.id},charge_id=${result.chargeId!} WHERE campaign_id=${id}::uuid`,
        );
      await tx.execute(
        sql`UPDATE thesi.campaign_fund_operation SET state='succeeded',provider_id=${result.id},last_error=NULL,lease_until=NULL,completed_at=now() WHERE id=${operationId}::uuid`,
      );
    });
    return { recovered: true };
  }
  async tick() {
    if (this.running || this.config.get('CAMPAIGN_FUNDING_ENABLED') !== true)
      return;
    this.running = true;
    try {
      const rows = (
        await this.db.execute(
          sql`SELECT id FROM thesi.campaign_fund_operation WHERE state IN ('pending','processing','provider_pending') AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY created_at LIMIT 10`,
        )
      ).rows;
      for (const r of rows) await this.process(String(r.id));
    } catch {
      this.logger.warn('Campaign fund processing needs retry');
    } finally {
      this.running = false;
    }
  }
  async process(id: string) {
    this.enabled();
    let prepared: any;
    try {
      prepared = await this.db.transaction(async (tx) => {
        const op = (
          await tx.execute(
            sql`SELECT * FROM thesi.campaign_fund_operation WHERE id=${id}::uuid AND state IN ('pending','processing','provider_pending') AND (lease_until IS NULL OR lease_until<=now()) FOR UPDATE`,
          )
        ).rows[0] as any;
        if (!op) return null;
        if (
          op.first_attempt_at &&
          !op.provider_id &&
          Date.now() - new Date(op.first_attempt_at).getTime() > 23 * 3600000
        ) {
          await tx.execute(
            sql`UPDATE thesi.campaign_fund_operation SET state='review',last_error='Provider outcome must be reconciled before another attempt' WHERE id=${id}::uuid`,
          );
          return null;
        }
        const f = (
          await tx.execute(
            sql`SELECT * FROM thesi.campaign_base_fund WHERE campaign_id=${op.campaign_id}::uuid FOR UPDATE`,
          )
        ).rows[0] as any;
        let args = op.args;
        if (op.kind !== 'deposit') {
          if (
            !f.payment_intent_id ||
            !f.charge_id ||
            !['funded', 'closed'].includes(f.state)
          )
            throw new Error('Deposit has not been captured');
          if (op.kind === 'release') {
            const b = (
              await tx.execute(
                sql`SELECT * FROM thesi.campaign_base_obligation WHERE id=${op.obligation_id}::uuid`,
              )
            ).rows[0] as any;
            if (
              !b?.accepted_work_at ||
              Number(b.amount_cents) !== Number(op.amount_cents)
            )
              throw new Error('Brand work acceptance is required');
            if (!args.destination) {
              const ready = await this.connect.getCreatorPayoutReadiness(
                b.creator_user_id,
              );
              if (!ready.ready || !ready.accountId)
                throw new Error('Creator payout setup is incomplete');
              args = { ...args, destination: ready.accountId };
            }
          }
          {
            const refunds = (
              await tx.execute(
                sql`SELECT coalesce(sum(amount_cents),0)::text AS n FROM thesi.campaign_fund_entry WHERE campaign_id=${op.campaign_id}::uuid AND kind IN ('refund_unused','refund_cancelled')`,
              )
            ).rows[0];
            args = {
              ...args,
              paymentIntentId: f.payment_intent_id,
              chargeId: f.charge_id,
              expectedRefundCents: Number(refunds.n),
            };
          }
        }
        const lease = await tx.execute(
          sql`UPDATE thesi.campaign_fund_operation SET args=${JSON.stringify(args)}::jsonb,state='processing',first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes' WHERE id=${id}::uuid RETURNING lease_until`,
        );
        return { ...op, args, lease_until: lease.rows[0].lease_until };
      });
      if (!prepared) return;
      const result = await this.gateway.execute(prepared);
      await this.db.transaction(async (tx) => {
        const op = (
          await tx.execute(
            sql`SELECT * FROM thesi.campaign_fund_operation WHERE id=${id}::uuid FOR UPDATE`,
          )
        ).rows[0] as any;
        if (op.state === 'succeeded') return;
        if (result.pending) {
          await tx.execute(
            sql`UPDATE thesi.campaign_fund_operation SET provider_id=${result.id},state='provider_pending',lease_until=NULL,next_attempt_at=now()+interval '5 minutes',last_error='Provider payment or refund is pending; no funds recorded as moved' WHERE id=${id}::uuid`,
          );
          return;
        }
        await tx.execute(
          sql`SELECT campaign_id FROM thesi.campaign_base_fund WHERE campaign_id=${op.campaign_id}::uuid FOR UPDATE`,
        );
        await tx.execute(
          sql`INSERT INTO thesi.campaign_fund_entry(campaign_id,operation_id,kind,amount_cents,provider_id) VALUES(${op.campaign_id}::uuid,${id}::uuid,${op.kind},${Number(op.amount_cents)},${result.id}) ON CONFLICT DO NOTHING`,
        );
        if (op.kind === 'deposit')
          await tx.execute(
            sql`UPDATE thesi.campaign_base_fund SET state='funded',payment_intent_id=${result.id},charge_id=${result.chargeId!} WHERE campaign_id=${op.campaign_id}::uuid`,
          );
        await tx.execute(
          sql`UPDATE thesi.campaign_fund_operation SET state='succeeded',provider_id=${result.id},lease_until=NULL,completed_at=now(),last_error=NULL WHERE id=${id}::uuid`,
        );
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Funding operation needs retry';
      // Retain the first attempt and immutable arguments even if the remote outcome is uncertain.
      await this.db.execute(
        sql`UPDATE thesi.campaign_fund_operation SET state=CASE WHEN state='provider_pending' THEN state ELSE 'pending' END,lease_until=NULL,next_attempt_at=now()+interval '5 minutes',last_error=${message.slice(0, 250)} WHERE id=${id}::uuid AND state NOT IN ('succeeded','review') AND ${prepared ? sql`lease_until=${new Date(prepared.lease_until).toISOString()}::timestamptz` : sql`(lease_until IS NULL OR lease_until<=now())`}`,
      );
    }
  }
}

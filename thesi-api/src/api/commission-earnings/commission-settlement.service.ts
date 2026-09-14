import {
  Inject,
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { isDeepStrictEqual } from 'node:util';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { ConnectService } from '../connect/connect.service';
type Actor = { sub: string; role: string };
type CombinedPayout = {
  groupId: string;
  totalCents: number;
  minimumCents: number;
  lineIds: string[];
};
type BatchLine = {
  orderLineId: string;
  creatorId: string;
  currency: string;
  earnedCents: string;
  netPaidCents: string;
  remainingCents: string;
  minimumPayoutCents: number;
  eligibleAt: string | null;
  ready: boolean;
  reasons: string[];
  combinedPayout?: CombinedPayout;
};
type BatchInput = {
  batchId: string;
  reason: string;
  lineIds?: string[];
  source?: 'manual' | 'scheduled';
};
export function applyCombinedBalancePolicy(
  lines: BatchLine[],
  combinedEnabled: boolean,
) {
  const groups = new Map<string, BatchLine[]>();
  for (const line of lines.filter((candidate) => candidate.ready)) {
    const key = `${line.creatorId}:${line.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  for (const group of groups.values()) {
    const groupLineIds = group.map((line) => line.orderLineId).sort();
    const totalCents = group.reduce(
      (sum, line) => sum + Number(line.remainingCents),
      0,
    );
    const groupId = `${group[0]?.creatorId ?? 'creator'}:${group[0]?.currency ?? 'USD'}:${groupLineIds.join(',')}`;
    for (const line of group) {
      if (line.minimumPayoutCents <= 0) continue;
      if (
        !combinedEnabled &&
        Number(line.remainingCents) < line.minimumPayoutCents
      ) {
        line.ready = false;
        line.reasons.push('individual_payout_below_minimum');
        continue;
      }
      if (combinedEnabled && totalCents >= line.minimumPayoutCents) {
        line.combinedPayout = {
          groupId,
          totalCents,
          minimumCents: line.minimumPayoutCents,
          lineIds: groupLineIds,
        };
        continue;
      }
      if (combinedEnabled) {
        line.ready = false;
        line.reasons.push('combined_balance_below_minimum');
      }
    }
  }
  return lines;
}
@Injectable()
export class CommissionSettlementService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private scheduledRunning = false;
  private readonly logger = new Logger(CommissionSettlementService.name);
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
    private readonly connect: ConnectService,
  ) {}
  async onApplicationBootstrap() {
    if (this.config.get('COMMISSION_SETTLEMENT_ENABLED') !== true) return;
    const r = await this.db.execute(
      sql`SELECT to_regclass('thesi.commission_settlement_request') IS NOT NULL AS ready`,
    );
    if (!r.rows[0]?.ready)
      throw new Error('Commission settlement requires Thesi V39');
    if (this.config.get('COMMISSION_SETTLEMENT_AUTO_ENABLED') === true) {
      await this.batchReady();
      const interval = this.scheduledIntervalMs();
      this.timer = setInterval(
        () => void this.runScheduledSettlements(),
        interval,
      );
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private enabled() {
    if (this.config.get('COMMISSION_SETTLEMENT_ENABLED') !== true)
      throw new ServiceUnavailableException(
        'Commission settlement is disabled',
      );
  }
  operator(user: Actor) {
    return String(this.config.get('SETTLEMENT_OPERATOR_USER_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(user.sub);
  }
  private async line(user: Actor, line: string, write = false) {
    this.enabled();
    const r = (
      await this.db.execute(
        sql`SELECT e.*,c.owner_user_id,w.owner_user_id AS workspace_owner FROM thesi.commission_earning_event e JOIN thesi.campaign c ON c.id=e.campaign_id JOIN thesi.brand_workspace w ON w.id=e.workspace_id WHERE e.order_line_id=${line}::uuid ORDER BY e.revision DESC LIMIT 1`,
      )
    ).rows[0] as any;
    if (!r) throw new BadRequestException('Attributed sale not found');
    const w = workspaceContext.getStore();
    const owner =
      user.role === 'brand' &&
      w?.actorUserId === user.sub &&
      w?.role === 'owner' &&
      w.workspaceId === r.workspace_id &&
      r.owner_user_id === user.sub &&
      r.workspace_owner === user.sub;
    if (
      !owner &&
      !(user.role === 'creator' && !write && r.creator_user_id === user.sub) &&
      !this.operator(user)
    )
      throw new ForbiddenException('Select the brand that owns this sale');
    return r;
  }
  protected async platform() {
    const stripe = new Stripe(
      this.config.getOrThrow<string>('STRIPE_SECRET_KEY'),
      { timeout: 10000, maxNetworkRetries: 0 },
    );
    const a = await stripe.accounts.retrieve(null);
    if (a.id !== this.config.get('SETTLEMENT_PLATFORM_ACCOUNT_ID'))
      throw new ConflictException('Thesi Stripe account needs verification');
    return a.id;
  }
  protected async commerce(action: string, body: unknown) {
    const r = await fetch(
      new URL(
        `/v1/internal/creator-settlements/${action}`,
        this.config.getOrThrow<string>('COMMERCE_SETTLEMENT_API_URL'),
      ),
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
        headers: {
          'Content-Type': 'application/json',
          'X-Thesi-Settlement-Key': this.config.getOrThrow<string>(
            'COMMERCE_SETTLEMENT_SERVICE_KEY',
          ),
        },
        body: JSON.stringify(body),
      },
    );
    const b = (await r.json()) as any;
    if (!r.ok)
      throw new ConflictException(
        typeof b.message === 'string'
          ? b.message
          : 'Settlement could not be confirmed',
      );
    return b.data;
  }
  private async batchReady() {
    const r = await this.db.execute(
      sql`SELECT to_regclass('thesi.commission_settlement_batch') IS NOT NULL AS ready`,
    );
    if (!r.rows[0]?.ready)
      throw new ServiceUnavailableException(
        'Commission settlement batches require Thesi V42',
      );
  }
  private combinedBalanceEnabled() {
    return (
      this.config.get('COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED') === true
    );
  }
  private scheduledIntervalMs() {
    const value = Number(
      this.config.get('COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS') ?? 3600000,
    );
    return Number.isSafeInteger(value) && value >= 60000 ? value : 3600000;
  }
  private scheduledLimit() {
    const value = Number(
      this.config.get('COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT') ?? 25,
    );
    return Number.isSafeInteger(value) && value > 0 && value <= 100
      ? value
      : 25;
  }
  private scheduledReason() {
    const value = String(
      this.config.get('COMMISSION_SETTLEMENT_AUTO_REASON') ??
        'Automatic scheduled commission settlement under accepted campaign terms.',
    ).trim();
    return (
      value ||
      'Automatic scheduled commission settlement under accepted campaign terms.'
    );
  }
  private async ownerWorkspace(user: Actor) {
    this.enabled();
    const w = workspaceContext.getStore();
    if (
      user.role !== 'brand' ||
      !w ||
      w.actorUserId !== user.sub ||
      w.role !== 'owner'
    )
      throw new ForbiddenException('Select the brand workspace owner account');
    const current = (
      await this.db.execute(
        sql`SELECT owner_user_id FROM thesi.brand_workspace WHERE id=${w.workspaceId}::uuid`,
      )
    ).rows[0] as any;
    if (!current || current.owner_user_id !== user.sub)
      throw new ForbiddenException('Select the brand workspace owner account');
    return w.workspaceId;
  }
  async preview(user: Actor, line: string) {
    const r = await this.line(user, line);
    const data = await this.commerce('preview', {
      orderLineId: line,
      receiptId: r.receipt_id,
    });
    if (data.receiptId !== r.receipt_id || data.creatorId !== r.creator_user_id)
      throw new ConflictException('Settlement receipt mismatch');
    const requests = (
      await this.db.execute(
        sql`SELECT id,state,last_error AS error FROM thesi.commission_settlement_request WHERE order_line_id=${line}::uuid AND actor_id=${user.sub} ORDER BY created_at DESC LIMIT 10`,
      )
    ).rows;
    return { ...data, canRecover: this.operator(user), requests };
  }
  async reviewRisk(
    user: Actor,
    line: string,
    input: {
      requestId: string;
      expectedRevision: number;
      status: 'hold' | 'clear';
      kind: 'suspected_self_referral' | 'fraud';
      reason: string;
    },
  ) {
    const r = await this.line(user, line, true);
    if (input.status === 'clear' && !this.operator(user))
      throw new ForbiddenException(
        'Only a ClothME settlement operator can clear a risk hold',
      );
    if (!input.reason.trim())
      throw new BadRequestException('Record review evidence');
    await this.commerce('risk', {
      ...input,
      orderLineId: line,
      receiptId: r.receipt_id,
      actorId: user.sub,
    });
    return this.preview(user, line);
  }
  async decide(
    user: Actor,
    line: string,
    input: {
      requestId: string;
      expectedRevision: number;
      action: 'qualify' | 'disqualify' | 'reconcile';
      reason: string;
      combinedPayout?: CombinedPayout;
    },
  ) {
    const r = await this.line(user, line, true);
    if (!input.reason.trim())
      throw new BadRequestException('Explain the qualification decision');
    const existing = (
      await this.db.execute(
        sql`SELECT * FROM thesi.commission_settlement_request WHERE id=${input.requestId}::uuid`,
      )
    ).rows[0] as any;
    if (existing) {
      if (
        existing.actor_id !== user.sub ||
        existing.order_line_id !== line ||
        !isDeepStrictEqual(existing.browser_input, input)
      )
        throw new ConflictException('Approval id reused');
      return this.replay(user, line, input.requestId);
    }
    const accountId = await this.platform();
    const remote = await this.commerce('platform', {});
    if (remote.accountId !== accountId)
      throw new ConflictException(
        'Commerce and Thesi must use the same verified Stripe platform',
      );
    let destination: string | undefined;
    if (input.action === 'qualify') {
      const ready = await this.connect.getCreatorPayoutReadiness(
        r.creator_user_id,
      );
      if (!ready.ready || !ready.accountId)
        throw new ConflictException('Creator payout setup is incomplete');
      destination = ready.accountId;
    }
    const command = {
      ...input,
      orderLineId: line,
      receiptId: r.receipt_id,
      actorId: user.sub,
      platformAccountId: accountId,
      ...(destination ? { destination } : {}),
    };
    await this.db.execute(
      sql`INSERT INTO thesi.commission_settlement_request(id,order_line_id,workspace_id,actor_id,browser_input,command) VALUES(${input.requestId}::uuid,${line}::uuid,${r.workspace_id}::uuid,${user.sub},${JSON.stringify(input)}::jsonb,${JSON.stringify(command)}::jsonb) ON CONFLICT DO NOTHING`,
    );
    const saved = (
      await this.db.execute(
        sql`SELECT browser_input,actor_id,order_line_id FROM thesi.commission_settlement_request WHERE id=${input.requestId}::uuid`,
      )
    ).rows[0] as any;
    if (
      saved.actor_id !== user.sub ||
      saved.order_line_id !== line ||
      !isDeepStrictEqual(saved.browser_input, input)
    )
      throw new ConflictException('Approval id reused');
    return this.replay(user, line, input.requestId);
  }
  async replay(user: Actor, line: string, id: string) {
    await this.line(user, line, true);
    const r = (
      await this.db.execute(
        sql`SELECT * FROM thesi.commission_settlement_request WHERE id=${id}::uuid AND order_line_id=${line}::uuid AND actor_id=${user.sub}`,
      )
    ).rows[0] as any;
    if (!r) throw new BadRequestException('Approval not found');
    if (r.state !== 'confirmed')
      try {
        const result = await this.commerce('decide', r.command);
        await this.db.execute(
          sql`UPDATE thesi.commission_settlement_request SET state='confirmed',result=${JSON.stringify(result)}::jsonb,last_error=NULL,confirmed_at=now() WHERE id=${id}::uuid`,
        );
      } catch (e) {
        await this.db.execute(
          sql`UPDATE thesi.commission_settlement_request SET last_error='Confirmation pending; replay this approval before creating another' WHERE id=${id}::uuid AND state='pending'`,
        );
        throw e;
      }
    return this.preview(user, line);
  }
  async retry(user: Actor, line: string, operationId: string) {
    const r = await this.line(user, line, true);
    await this.commerce('retry', {
      orderLineId: line,
      receiptId: r.receipt_id,
      operationId,
    });
    return this.preview(user, line);
  }
  async recover(
    user: Actor,
    line: string,
    operationId: string,
    providerId: string,
    reason: string,
  ) {
    if (!this.operator(user))
      throw new ForbiddenException('Settlement operator access required');
    const r = await this.line(user, line, true);
    await this.commerce('recover', {
      orderLineId: line,
      receiptId: r.receipt_id,
      operationId,
      providerId,
      reason,
      actorId: user.sub,
    });
    return this.preview(user, line);
  }

  private async batchCandidates(user: Actor, workspaceId: string) {
    const rows = (
      await this.db.execute(sql`WITH latest AS (
        SELECT DISTINCT ON(e.order_line_id) e.order_line_id,e.creator_user_id,e.currency,e.accrued_cents,e.state,e.reasons,e.received_at
        FROM thesi.commission_earning_event e
        WHERE e.workspace_id=${workspaceId}::uuid
        ORDER BY e.order_line_id,e.revision DESC
      )
      SELECT * FROM latest WHERE state='under_review' ORDER BY received_at LIMIT 50`)
    ).rows as any[];
    const lines: BatchLine[] = [];
    for (const row of rows) {
      try {
        const settlement = await this.preview(user, row.order_line_id);
        const readyAccount = await this.connect.getCreatorPayoutReadiness(
          settlement.creatorId,
        );
        const netPaid =
          Number(settlement.totals.creatorPaid ?? 0) -
          Number(settlement.totals.creatorRecovered ?? 0);
        const remainingCents = Math.max(
          0,
          Number(settlement.earnedCents) - netPaid,
        );
        const hasOpenOperation = settlement.operations.some((op: any) =>
          ['pending', 'processing', 'review'].includes(op.state),
        );
        const reviewOpen = Date.now() < Date.parse(settlement.eligibleAt);
        const hasRemainingCommission = remainingCents > 0;
        const minimumPayoutCents = Number(
          settlement.rules?.minimumPayoutCents ?? 0,
        );
        const reasons = [
          ...settlement.holdReasons,
          ...(settlement.disqualified ? ['disqualified'] : []),
          ...(reviewOpen ? ['review_period_open'] : []),
          ...(hasRemainingCommission ? [] : ['no_remaining_commission']),
          ...(hasOpenOperation ? ['open_settlement_operation'] : []),
          ...(readyAccount.ready
            ? []
            : [readyAccount.reason ?? 'payout_setup_incomplete']),
        ];
        const ready =
          !settlement.holdReasons.length &&
          !settlement.disqualified &&
          !reviewOpen &&
          hasRemainingCommission &&
          !hasOpenOperation &&
          readyAccount.ready === true;
        lines.push({
          orderLineId: row.order_line_id,
          creatorId: settlement.creatorId,
          currency: row.currency,
          earnedCents: String(settlement.earnedCents),
          netPaidCents: String(netPaid),
          remainingCents: String(remainingCents),
          minimumPayoutCents,
          eligibleAt: settlement.eligibleAt,
          ready,
          reasons,
        });
      } catch (e) {
        lines.push({
          orderLineId: row.order_line_id,
          creatorId: row.creator_user_id,
          currency: row.currency,
          earnedCents: String(row.accrued_cents ?? 0),
          netPaidCents: '0',
          remainingCents: String(row.accrued_cents ?? 0),
          minimumPayoutCents: 0,
          eligibleAt: null,
          ready: false,
          reasons: [e instanceof Error ? e.message : 'settlement_preview_failed'],
        });
      }
    }
    return applyCombinedBalancePolicy(lines, this.combinedBalanceEnabled());
  }

  async batchPreview(user: Actor) {
    await this.batchReady();
    const workspaceId = await this.ownerWorkspace(user);
    const lines = await this.batchCandidates(user, workspaceId);
    const ready = lines.filter((line) => line.ready);
    return {
      workspaceId,
      readyCount: ready.length,
      readyCents: String(
        ready.reduce(
          (sum, line) =>
            sum + Math.max(0, Number(line.earnedCents) - Number(line.netPaidCents)),
          0,
        ),
      ),
      currency: 'USD',
      lines,
      limit: 50,
    };
  }

  async runBatch(user: Actor, input: BatchInput) {
    await this.batchReady();
    if (!input.reason.trim() || input.reason.length > 2000)
      throw new BadRequestException('Explain the batch settlement review');
    const workspaceId = await this.ownerWorkspace(user);
    const browserInput = {
      reason: input.reason,
      lineIds: [...new Set(input.lineIds ?? [])].sort(),
      source: input.source ?? 'manual',
    };
    const existing = (
      await this.db.execute(
        sql`SELECT * FROM thesi.commission_settlement_batch WHERE id=${input.batchId}::uuid`,
      )
    ).rows[0] as any;
    if (existing) {
      if (
        existing.actor_id !== user.sub ||
        existing.workspace_id !== workspaceId ||
        !isDeepStrictEqual(existing.browser_input, browserInput)
      )
        throw new ConflictException('Batch id reused');
    } else {
      await this.db.execute(
        sql`INSERT INTO thesi.commission_settlement_batch(id,workspace_id,actor_id,reason,browser_input) VALUES(${input.batchId}::uuid,${workspaceId}::uuid,${user.sub},${input.reason},${JSON.stringify(browserInput)}::jsonb)`,
      );
    }
    const candidates = await this.batchCandidates(user, workspaceId);
    const selected = input.lineIds?.length
      ? candidates.filter((line) => input.lineIds!.includes(line.orderLineId))
      : candidates.filter((line) => line.ready);
    for (const candidate of selected) {
      const item = (
        await this.db.execute(sql`INSERT INTO thesi.commission_settlement_batch_item(batch_id,order_line_id,request_id)
          VALUES(${input.batchId}::uuid,${candidate.orderLineId}::uuid,${randomUUID()}::uuid)
          ON CONFLICT(batch_id,order_line_id) DO UPDATE SET order_line_id=EXCLUDED.order_line_id
          RETURNING *`)
      ).rows[0] as any;
      if (item.state === 'confirmed') continue;
      if (!candidate.ready) {
        await this.db.execute(
          sql`UPDATE thesi.commission_settlement_batch_item SET state='skipped',error=${candidate.reasons.join('; ').slice(0, 500)},completed_at=now() WHERE id=${item.id}::uuid AND state<>'confirmed'`,
        );
        continue;
      }
      try {
        const preview = await this.preview(user, candidate.orderLineId);
        const result = await this.decide(user, candidate.orderLineId, {
          requestId: item.request_id,
          expectedRevision: preview.revision,
          action: 'qualify',
          reason: input.reason,
          ...(candidate.combinedPayout
            ? { combinedPayout: candidate.combinedPayout }
            : {}),
        });
        await this.db.execute(
          sql`UPDATE thesi.commission_settlement_batch_item SET state='confirmed',result=${JSON.stringify(result)}::jsonb,error=NULL,completed_at=now() WHERE id=${item.id}::uuid`,
        );
      } catch (e) {
        await this.db.execute(
          sql`UPDATE thesi.commission_settlement_batch_item SET state='failed',error=${(e instanceof Error ? e.message : 'Batch item failed').slice(0, 500)},completed_at=now() WHERE id=${item.id}::uuid AND state<>'confirmed'`,
        );
      }
    }
    await this.db.execute(
      sql`UPDATE thesi.commission_settlement_batch SET state='completed',completed_at=now() WHERE id=${input.batchId}::uuid`,
    );
    return this.batchStatus(user, input.batchId);
  }

  async runScheduledSettlements() {
    if (this.scheduledRunning) return { skipped: true, reason: 'running' };
    if (this.config.get('COMMISSION_SETTLEMENT_AUTO_ENABLED') !== true)
      return { skipped: true, reason: 'disabled' };
    this.scheduledRunning = true;
    const lock = (
      await this.db.execute(
        sql`SELECT pg_try_advisory_lock(hashtextextended('thesi:commission-settlement:auto',0)) AS locked`,
      )
    ).rows[0] as any;
    if (!lock?.locked) {
      this.scheduledRunning = false;
      return { skipped: true, reason: 'locked' };
    }
    const results: {
      workspaceId: string;
      state: string;
      batchId?: string;
      totals?: Record<string, number>;
      error?: string;
    }[] = [];
    try {
      await this.batchReady();
      const rows = (
        await this.db.execute(sql`WITH latest AS (
          SELECT DISTINCT ON(e.order_line_id) e.workspace_id,e.state
          FROM thesi.commission_earning_event e
          ORDER BY e.order_line_id,e.revision DESC
        )
        SELECT DISTINCT w.id AS "workspaceId",w.owner_user_id AS "ownerUserId"
        FROM latest l
        JOIN thesi.brand_workspace w ON w.id=l.workspace_id
        WHERE w.status='active' AND l.state='under_review'
        ORDER BY w.id
        LIMIT ${this.scheduledLimit()}`)
      ).rows as { workspaceId: string; ownerUserId: string }[];
      for (const row of rows) {
        try {
          await workspaceContext.run(
            {
              workspaceId: row.workspaceId,
              actorUserId: row.ownerUserId,
              role: 'owner',
            },
            async () => {
              const user = { sub: row.ownerUserId, role: 'brand' };
              const preview = await this.batchPreview(user);
              if (!preview.readyCount) {
                results.push({ workspaceId: row.workspaceId, state: 'empty' });
                return;
              }
              const batch = await this.runBatch(user, {
                batchId: randomUUID(),
                reason: this.scheduledReason(),
                source: 'scheduled',
                lineIds: preview.lines
                  .filter((line) => line.ready)
                  .map((line) => line.orderLineId),
              });
              results.push({
                workspaceId: row.workspaceId,
                state: 'completed',
                batchId: batch.id,
                totals: batch.totals as Record<string, number>,
              });
            },
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : 'unknown error';
          this.logger.warn(
            `Scheduled commission settlement skipped workspace ${row.workspaceId}: ${message}`,
          );
          results.push({
            workspaceId: row.workspaceId,
            state: 'failed',
            error: message,
          });
        }
      }
      return { skipped: false, workspaces: results };
    } finally {
      await this.db.execute(
        sql`SELECT pg_advisory_unlock(hashtextextended('thesi:commission-settlement:auto',0))`,
      );
      this.scheduledRunning = false;
    }
  }

  async batchStatus(user: Actor, batchId: string) {
    await this.batchReady();
    const workspaceId = await this.ownerWorkspace(user);
    const batch = (
      await this.db.execute(
        sql`SELECT * FROM thesi.commission_settlement_batch WHERE id=${batchId}::uuid AND workspace_id=${workspaceId}::uuid`,
      )
    ).rows[0] as any;
    if (!batch) throw new BadRequestException('Settlement batch not found');
    const items = (
      await this.db.execute(
        sql`SELECT order_line_id AS "orderLineId",request_id AS "requestId",state,error,result,created_at AS "createdAt",completed_at AS "completedAt" FROM thesi.commission_settlement_batch_item WHERE batch_id=${batchId}::uuid ORDER BY created_at,order_line_id`,
      )
    ).rows;
    const totals = items.reduce(
      (acc: Record<string, number>, item: any) => {
        acc[item.state] = (acc[item.state] ?? 0) + 1;
        return acc;
      },
      {},
    );
    return {
      id: batch.id,
      workspaceId: batch.workspace_id,
      actorId: batch.actor_id,
      reason: batch.reason,
      state: batch.state,
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
      totals,
      items,
    };
  }
}

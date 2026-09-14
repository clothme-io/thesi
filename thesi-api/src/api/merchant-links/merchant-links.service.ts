import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';

type Db = NodePgDatabase<typeof schema>;
type Executor = Pick<Db, 'execute'>;
type Intent = {
  id: string; action: 'link' | 'open'; vendor_id: string; merchant_brand_id: string;
  vendor_name: string; merchant_brand_name: string; challenge: string; state: string;
  workspace_id: string | null; user_id: string | null; link_id: string | null;
  grant_hash: string | null; consumed_at: Date | null; expired: boolean;
};
type Link = { id: string; workspace_id: string; linked_by_user_id: string; vendor_id: string; merchant_brand_id: string };
export const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
const token = () => randomBytes(32).toString('base64url');
async function rows<T>(db: Executor, query: SQL): Promise<T[]> { return (await db.execute(query)).rows as T[]; }

@Injectable()
export class MerchantLinksService implements OnApplicationBootstrap {
  constructor(@Inject(DrizzleAsyncProvider) private readonly db: Db, private readonly config: ConfigService) {}

  private enabled() {
    if (this.config.get('MERCHANT_LINKING_ENABLED') !== true) throw new NotFoundException('Merchant linking is unavailable');
  }
  async onApplicationBootstrap() {
    if (this.config.get('MERCHANT_LINKING_ENABLED') !== true) return;
    const [result] = await rows<{ ready: boolean }>(this.db, sql`SELECT to_regclass('thesi.merchant_link_event') IS NOT NULL AS ready`);
    if (!result.ready) throw new Error('Merchant linking requires V35 before activation');
  }
  private async owner(db: Executor, userId: string, workspaceId: string) {
    const [workspace] = await rows<{ id: string; name: string; email: string }>(db, sql`
      SELECT w.id,w.name,u.email FROM thesi.brand_workspace w
      JOIN thesi.brand_workspace_member m ON m.workspace_id=w.id AND m.user_id=${userId}
      JOIN public.thesi_users u ON u.id=m.user_id
      WHERE w.id=${workspaceId}::uuid AND w.owner_user_id=${userId} AND w.status='active'
        AND m.role='owner' AND m.status='active' AND u.role='brand' AND u.must_change_password=false
      FOR SHARE OF w,m,u`);
    if (!workspace) throw new ForbiddenException('Sign in as the active Thesi brand owner. Complete any required password change first.');
    return workspace;
  }
  private async event(db: Executor, intent: Pick<Intent, 'id'|'vendor_id'|'merchant_brand_id'>, kind: string, actor: string, workspaceId?: string | null, linkId?: string | null) {
    await db.execute(sql`INSERT INTO thesi.merchant_link_event(intent_id,link_id,vendor_id,merchant_brand_id,workspace_id,actor,event)
      VALUES (${intent.id}::uuid,${linkId ?? null}::uuid,${intent.vendor_id}::uuid,${intent.merchant_brand_id}::uuid,${workspaceId ?? null}::uuid,${actor},${kind})`);
  }
  private async findIntent(db: Executor, code: string, grant = false) {
    const column = grant ? sql`grant_hash` : sql`token_hash`;
    const [intent] = await rows<Intent>(db, sql`SELECT *, expires_at <= now() AS expired FROM thesi.merchant_link_intent WHERE ${column}=${digest(code)} FOR UPDATE`);
    if (!intent || intent.expired) throw new BadRequestException('This connection request expired or is unavailable. Start again in Merchant Hub.');
    return intent;
  }
  private async activeLink(db: Executor, vendorId: string, brandId: string) {
    const [link] = await rows<Link>(db, sql`SELECT * FROM thesi.merchant_brand_link WHERE vendor_id=${vendorId}::uuid AND merchant_brand_id=${brandId}::uuid AND revoked_at IS NULL FOR UPDATE`);
    return link;
  }

  async start(input: { vendorId: string; brandId: string; vendorName: string; brandName: string; challenge: string; state: string; action: 'link'|'open' }) {
    this.enabled();
    const code = token();
    await this.db.transaction(async tx => {
      const existing = await this.activeLink(tx, input.vendorId, input.brandId);
      if (input.action === 'link' && existing) throw new ConflictException('This Merchant brand is already connected. Disconnect it before linking another brand.');
      if (input.action === 'open' && !existing) throw new NotFoundException('This Merchant brand is not connected');
      const [intent] = await rows<Intent>(tx, sql`INSERT INTO thesi.merchant_link_intent(token_hash,action,vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,state,challenge,link_id,expires_at)
        VALUES (${digest(code)},${input.action},${input.vendorId}::uuid,${input.brandId}::uuid,${input.vendorName},${input.brandName},${input.state},${input.challenge},${existing?.id ?? null}::uuid,now()+interval '10 minutes') RETURNING *`);
      await this.event(tx, intent, 'started', `merchant-owner:${input.vendorId}`);
    });
    const url = new URL('/merchant-link', this.config.getOrThrow<string>('THESI_WEB_URL'));
    url.hash = new URLSearchParams({ code }).toString();
    return { url: url.toString() };
  }

  async describe(code: string) {
    this.enabled();
    return this.db.transaction(async tx => {
      const intent = await this.findIntent(tx, code);
      if (intent.consumed_at || intent.grant_hash) throw new BadRequestException('This request has already been used. Return to Merchant Hub.');
      return { vendorName: intent.vendor_name, brandName: intent.merchant_brand_name, action: intent.action };
    });
  }

  async approve(userId: string, code: string, workspaceId?: string) {
    this.enabled();
    return this.db.transaction(async tx => {
      const intent = await this.findIntent(tx, code);
      if (intent.consumed_at || intent.grant_hash) throw new BadRequestException('This request has already been used. Start again in Merchant Hub.');
      if (intent.action === 'open') {
        const link = await this.activeLink(tx, intent.vendor_id, intent.merchant_brand_id);
        if (!link || link.id !== intent.link_id || link.linked_by_user_id !== userId) throw new ForbiddenException('Sign in to the Thesi account connected to this Merchant brand');
        await this.owner(tx, userId, link.workspace_id);
        await tx.execute(sql`UPDATE thesi.merchant_link_intent SET consumed_at=now(),user_id=${userId},workspace_id=${link.workspace_id}::uuid WHERE id=${intent.id}::uuid`);
        await this.event(tx, intent, 'opened', `thesi:${userId}`, link.workspace_id, link.id);
        return { workspaceId: link.workspace_id };
      }
      if (!workspaceId) throw new BadRequestException('Choose a Thesi brand');
      await this.owner(tx, userId, workspaceId);
      const [conflict] = await rows(tx, sql`SELECT id FROM thesi.merchant_brand_link WHERE revoked_at IS NULL AND (workspace_id=${workspaceId}::uuid OR (vendor_id=${intent.vendor_id}::uuid AND merchant_brand_id=${intent.merchant_brand_id}::uuid))`);
      if (conflict) throw new ConflictException('One of these brands is already connected. Disconnect the existing connection first.');
      const grant = token();
      await tx.execute(sql`UPDATE thesi.merchant_link_intent SET user_id=${userId},workspace_id=${workspaceId}::uuid,grant_hash=${digest(grant)},approved_at=now() WHERE id=${intent.id}::uuid`);
      await this.event(tx, intent, 'approved', `thesi:${userId}`, workspaceId);
      const url = new URL('/app/settings/integrations/thesi', this.config.getOrThrow<string>('MERCHANT_HUB_URL'));
      url.hash = new URLSearchParams({ code: grant, state: intent.state }).toString();
      return { url: url.toString() };
    });
  }

  private async verifiedGrant(db: Executor, input: { vendorId: string; brandId: string; code: string; verifier: string }) {
    const intent = await this.findIntent(db, input.code, true);
    if (intent.action !== 'link' || intent.vendor_id !== input.vendorId || intent.merchant_brand_id !== input.brandId || intent.challenge !== digest(input.verifier) || !intent.workspace_id || !intent.user_id) {
      throw new ForbiddenException('Connection verification failed. Start again in Merchant Hub.');
    }
    return intent as Intent & { workspace_id: string; user_id: string };
  }
  async review(input: { vendorId: string; brandId: string; code: string; verifier: string }) {
    this.enabled();
    return this.db.transaction(async tx => {
      const intent = await this.verifiedGrant(tx, input);
      if (intent.consumed_at) throw new BadRequestException('This connection has already been confirmed');
      const workspace = await this.owner(tx, intent.user_id, intent.workspace_id);
      return { workspaceName: workspace.name, accountEmail: workspace.email, merchantBrandName: intent.merchant_brand_name };
    });
  }
  async complete(input: { vendorId: string; brandId: string; code: string; verifier: string }) {
    this.enabled();
    try {
      return await this.db.transaction(async tx => {
        const intent = await this.verifiedGrant(tx, input);
        await this.owner(tx, intent.user_id, intent.workspace_id);
        if (intent.consumed_at) {
          const existing = await this.activeLink(tx, input.vendorId, input.brandId);
          if (!existing || existing.id !== intent.link_id) throw new ConflictException('This connection is no longer active. Start again.');
          return { id: existing.id };
        }
        const [link] = await rows<Link>(tx, sql`INSERT INTO thesi.merchant_brand_link(vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id)
          VALUES (${intent.vendor_id}::uuid,${intent.merchant_brand_id}::uuid,${intent.vendor_name},${intent.merchant_brand_name},${intent.workspace_id}::uuid,${intent.user_id}) RETURNING *`);
        await tx.execute(sql`UPDATE thesi.merchant_link_intent SET consumed_at=now(),link_id=${link.id}::uuid WHERE id=${intent.id}::uuid`);
        await this.event(tx, intent, 'linked', `merchant-owner:${input.vendorId}`, intent.workspace_id, link.id);
        return { id: link.id };
      });
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
      if (code === '23505') throw new ConflictException('One of these brands is already connected. Refresh Merchant Hub before retrying.');
      throw error;
    }
  }
  async status(vendorId: string, brandId: string) {
    this.enabled();
    const [link] = await rows<{ id: string; workspaceName: string; accountEmail: string }>(this.db, sql`
      SELECT l.id,w.name AS "workspaceName",u.email AS "accountEmail" FROM thesi.merchant_brand_link l
      JOIN thesi.brand_workspace w ON w.id=l.workspace_id JOIN public.thesi_users u ON u.id=l.linked_by_user_id
      WHERE l.vendor_id=${vendorId}::uuid AND l.merchant_brand_id=${brandId}::uuid AND l.revoked_at IS NULL`);
    return { link: link ?? null };
  }
  async mine(userId: string,workspaceId?:string) {
    this.enabled();
    return rows(this.db, sql`SELECT l.id,l.vendor_name AS "vendorName",l.merchant_brand_name AS "merchantBrandName",w.name AS "workspaceName"
      FROM thesi.merchant_brand_link l JOIN thesi.brand_workspace w ON w.id=l.workspace_id
      WHERE l.linked_by_user_id=${userId} AND w.owner_user_id=${userId} AND l.revoked_at IS NULL ${workspaceId?sql`AND l.workspace_id=${workspaceId}::uuid`:sql``} ORDER BY l.created_at DESC`);
  }
  async revoke(linkId: string, actor: { vendorId: string; brandId: string } | { userId: string;workspaceId?:string }) {
    this.enabled();
    return this.db.transaction(async tx => {
      const scope = 'vendorId' in actor ? sql`vendor_id=${actor.vendorId}::uuid AND merchant_brand_id=${actor.brandId}::uuid` : sql`linked_by_user_id=${actor.userId} ${actor.workspaceId?sql`AND workspace_id=${actor.workspaceId}::uuid`:sql``}`;
      const [link] = await rows<Link>(tx, sql`SELECT * FROM thesi.merchant_brand_link WHERE id=${linkId}::uuid AND ${scope} FOR UPDATE`);
      if (!link) throw new NotFoundException('Connection not found');
      const actorId = 'vendorId' in actor ? `merchant-owner:${actor.vendorId}` : `thesi:${actor.userId}`;
      const changed = await rows(tx, sql`UPDATE thesi.merchant_brand_link SET revoked_at=now(),revoked_by=${actorId} WHERE id=${linkId}::uuid AND revoked_at IS NULL RETURNING id`);
      if (changed.length) {
        await tx.execute(sql`INSERT INTO thesi.merchant_link_event(link_id,vendor_id,merchant_brand_id,workspace_id,actor,event) VALUES (${link.id}::uuid,${link.vendor_id}::uuid,${link.merchant_brand_id}::uuid,${link.workspace_id}::uuid,${actorId},'revoked')`);
        // Invalidate outstanding approvals as well as launches, preventing a
        // pre-disconnection grant from reconnecting either side afterward.
        await tx.execute(sql`UPDATE thesi.merchant_link_intent SET expires_at=now() WHERE consumed_at IS NULL AND (workspace_id=${link.workspace_id}::uuid OR (vendor_id=${link.vendor_id}::uuid AND merchant_brand_id=${link.merchant_brand_id}::uuid))`);
        if(this.config.get('MERCHANT_SSO_ENABLED')===true){
          await tx.execute(sql`UPDATE thesi.merchant_session SET revoked_at=now() WHERE link_id=${link.id}::uuid AND revoked_at IS NULL`);
          await tx.execute(sql`UPDATE thesi.merchant_login_request SET expires_at=now() WHERE consumed_at IS NULL AND assertion->>'vendorId'=${link.vendor_id} AND assertion->>'brandId'=${link.merchant_brand_id}`);
        }
      }
      return { revoked: true };
    });
  }
}

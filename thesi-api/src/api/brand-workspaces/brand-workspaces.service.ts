import { HttpException, Optional } from '@nestjs/common';
import { MerchantAccessService } from 'src/shared/auth/merchant-access.service';
import { BadRequestException, Inject, Injectable, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';

@Injectable()
export class BrandWorkspacesService implements OnApplicationBootstrap {
  private merchantSchema=false;
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
    @Optional() private readonly merchant?: MerchantAccessService,
  ) {}

  async onApplicationBootstrap() {
    this.merchantSchema=Boolean((await this.db.execute(sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='thesi' AND table_name='brand_workspace_member' AND column_name='merchant_identity_id') AS ready`)).rows[0]?.ready);
    const result = await this.db.execute(sql`SELECT to_regclass('thesi.brand_workspace') AS relation`);
    if (!result.rows[0]?.relation) throw new Error('Brand workspace schema V33 is required before this API image');
    const multiSchema = await this.db.execute(sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='thesi' AND table_name='brand_workspace' AND column_name='owner_user_id') AS ready`);
    if (this.config.get('BRAND_WORKSPACE_ACCESS_ENABLED') === true && !multiSchema.rows[0]?.ready) {
      throw new Error('Complete V33 backfill and V34 before enabling workspace access');
    }
    const existing = await this.db.select({ id: schema.brandWorkspace.id }).from(schema.brandWorkspace)
      .where(sql`${schema.brandWorkspace.legacyOwnerUserId} IS NULL`).limit(1);
    if (existing.length && (this.config.get('BRAND_WORKSPACE_ACCESS_ENABLED') !== true || this.config.get('BRAND_WORKSPACES_ENABLED') !== true)) {
      throw new Error('Secondary brands exist: workspace protection cannot be disabled');
    }
  }

  async resolveLegacyAccess(userId: string, selectedId?: string) {
    const [row] = await this.db.select({
      workspaceId: schema.brandWorkspace.id,
      name: schema.brandWorkspace.name,
      legacyOwnerUserId: schema.brandWorkspace.legacyOwnerUserId,
      ownerUserId: this.config.get('BRAND_WORKSPACE_ACCESS_ENABLED') === true ? schema.brandWorkspace.ownerUserId : schema.brandWorkspace.legacyOwnerUserId,
      role: schema.brandWorkspaceMember.role,
      merchantIdentityId: this.merchantSchema ? sql<string|null>`brand_workspace_member.merchant_identity_id` : sql<string|null>`NULL`,
    }).from(schema.brandWorkspaceMember)
      .innerJoin(schema.brandWorkspace, eq(schema.brandWorkspace.id, schema.brandWorkspaceMember.workspaceId))
      .innerJoin(schema.thesiUser, eq(schema.thesiUser.id, schema.brandWorkspaceMember.userId))
      .where(and(
        eq(schema.thesiUser.role, 'brand'),
        eq(schema.brandWorkspaceMember.userId, userId),
        eq(schema.brandWorkspaceMember.status, 'active'),
        eq(schema.brandWorkspace.status, 'active'),
        selectedId ? eq(schema.brandWorkspace.id, selectedId) : eq(schema.brandWorkspace.legacyOwnerUserId, userId),
      )).limit(1);
    // Do not fall back to user-only access for missing, revoked or unbackfilled
    // workspaces. Merchant-derived memberships require current authority.
    if (!row) throw new NotFoundException('Workspace not available');
    let role=row.role;
    if(row.merchantIdentityId){
      if(!this.merchant)throw new NotFoundException('Merchant membership unavailable');
      const authority=await this.merchant.membership(userId,row.workspaceId,row.merchantIdentityId);
      if(authority.permission==='owner' && row.ownerUserId!==userId)throw new NotFoundException('Workspace ownership changed');
      if(authority.permission!=='owner' && row.ownerUserId===userId)throw new NotFoundException('Staff cannot act as workspace owner');
      role=authority.permission;
    } else if(row.ownerUserId!==userId)throw new NotFoundException('Workspace not available');
    return { workspaceId: row.workspaceId, actorUserId: userId, ownerUserId:row.ownerUserId??undefined, role, isDefault: row.legacyOwnerUserId === userId, name: row.name };
  }

  async create(userId: string, name: string, creationKey: string) {
    if (this.config.get('MULTI_BRAND_ENABLED') !== true) throw new NotFoundException('Not found');
    const access = await this.resolveLegacyAccess(userId);
    if (access.role !== 'owner') throw new NotFoundException('Workspace not available');
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) throw new BadRequestException('Brand name must contain 1–120 characters');
    return this.db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`brand-create:${userId}:${creationKey}`}, 0))`);
      const [existing] = await tx.select().from(schema.brandWorkspace).where(and(eq(schema.brandWorkspace.ownerUserId, userId), eq(schema.brandWorkspace.creationKey, creationKey))).limit(1);
      if (existing) {
        if (existing.name !== trimmed || existing.status !== 'active') throw new BadRequestException('This request key has already been used');
        return { id: existing.id, name: existing.name };
      }
      const [created] = await tx.insert(schema.brandWorkspace).values({ ownerUserId: userId, name: trimmed, creationKey }).returning();
      await tx.insert(schema.brandWorkspaceMember).values({ workspaceId: created.id, userId, role: 'owner' });
      await tx.insert(schema.brandProfile).values({ userId: null, workspaceId: created.id, companyName: trimmed });
      return { id: created.id, name: created.name };
    });
  }

  async auditDelegatedAction(access:{workspaceId:string;actorUserId:string},controller:string,handler:string) {
    await this.db.execute(sql`INSERT INTO thesi.merchant_workspace_audit(workspace_id,actor_user_id,controller,handler) VALUES(${access.workspaceId}::uuid,${access.actorUserId},${controller},${handler})`);
  }

  async list(userId: string, selectedId?: string) {
    // No workspace query before the additive migration is deployed and verified.
    if (this.config.get('BRAND_WORKSPACES_ENABLED') !== true) {
      throw new NotFoundException('Not found');
    }
    const rows = await this.db.select({
      id: schema.brandWorkspace.id,
      name: schema.brandWorkspace.name,
      role: schema.brandWorkspaceMember.role,
      merchantIdentityId: this.merchantSchema ? sql<string|null>`brand_workspace_member.merchant_identity_id` : sql<string|null>`NULL`,
      isDefault: sql<boolean>`COALESCE(${schema.brandWorkspace.legacyOwnerUserId} = ${userId}, false)`,
      canCreate: sql<boolean>`COALESCE(${this.config.get('MULTI_BRAND_ENABLED') === true} AND ${schema.brandWorkspace.legacyOwnerUserId} = ${userId} AND ${schema.brandWorkspaceMember.role} = 'owner', false)`,
    }).from(schema.brandWorkspaceMember)
      .innerJoin(schema.brandWorkspace,
        eq(schema.brandWorkspace.id, schema.brandWorkspaceMember.workspaceId))
      .where(and(
        eq(schema.brandWorkspaceMember.userId, userId),
        eq(schema.brandWorkspaceMember.status, 'active'),
        eq(schema.brandWorkspace.status, 'active'),
        selectedId ? eq(schema.brandWorkspace.id, selectedId) : undefined,
      )).orderBy(asc(schema.brandWorkspace.createdAt), asc(schema.brandWorkspace.id));
    const checked = await Promise.all(rows.map(async ({merchantIdentityId, ...row}) => {
      if (!merchantIdentityId) return row;
      try {
        const current = await this.resolveLegacyAccess(userId, row.id);
        return {...row, role:current.role, canCreate:false};
      } catch (error) {
        if (error instanceof HttpException && [401,403,404].includes(error.getStatus())) return null;
        throw error; // An authority outage is not evidence that membership was removed.
      }
    }));
    return checked.filter((row): row is NonNullable<typeof row> => row !== null);
  }
}

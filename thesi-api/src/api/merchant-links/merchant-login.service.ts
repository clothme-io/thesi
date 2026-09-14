import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { MerchantAccessService, type MerchantAssertion } from 'src/shared/auth/merchant-access.service';
import { AuthService } from '../auth/auth.service';
import { digest } from './merchant-links.service';

@Injectable()
export class MerchantLoginService {
  constructor(@Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService, private readonly access: MerchantAccessService, private readonly auth: AuthService) {}

  async onApplicationBootstrap() {
    if(this.config.get('MERCHANT_SSO_ENABLED')!==true)return;
    const ready=(await this.db.execute(sql`SELECT to_regclass('thesi.merchant_session') IS NOT NULL AS ready`)).rows[0];
    if(!ready?.ready)throw new Error('Merchant sign-in requires Thesi V40');
  }

  entry(){this.access.enabled();return {url:new URL('/merchant-signin?start=1',this.config.getOrThrow<string>('THESI_WEB_URL')).toString()};}

  async revokeActor(identity:{vendorId:string;actorType:string;actorId:string}) {
    this.access.enabled();
    await this.db.transaction(async tx=>{
      await tx.execute(sql`UPDATE thesi.merchant_session SET revoked_at=now() WHERE identity_id IN (SELECT id FROM thesi.merchant_identity WHERE vendor_id=${identity.vendorId}::uuid AND actor_type=${identity.actorType} AND actor_id=${identity.actorId}::uuid) AND revoked_at IS NULL`);
      await tx.execute(sql`UPDATE thesi.merchant_login_request SET expires_at=now() WHERE assertion->>'vendorId'=${identity.vendorId} AND assertion->>'actorType'=${identity.actorType} AND assertion->>'actorId'=${identity.actorId} AND consumed_at IS NULL`);
    });
    return {revoked:true};
  }
  async begin(state:string,challenge:string) {
    this.access.enabled();
    const request=(await this.db.execute(sql`INSERT INTO thesi.merchant_login_request(state,challenge) VALUES(${state},${challenge}) RETURNING id`)).rows[0];
    const url=new URL('/app/settings/integrations/thesi/authorize',this.config.getOrThrow<string>('MERCHANT_HUB_URL'));
    url.hash=new URLSearchParams({requestId:String(request.id),state}).toString();
    return {url:url.toString()};
  }

  async authorize(requestId:string,identity: Pick<MerchantAssertion,'vendorId'|'brandId'|'actorId'|'actorType'>) {
    this.access.enabled();
    // Re-read the authority; assertions never supply an email, local user, permission or session.
    const {vendorId,brandId,actorType,actorId}=identity;
    const assertion=await this.access.authority({vendorId,brandId,actorType,actorId});
    const code=randomBytes(32).toString('base64url');
    const request=(await this.db.execute(sql`UPDATE thesi.merchant_login_request SET assertion=${JSON.stringify(assertion)}::jsonb,
      code_hash=${digest(code)},authorized_at=now() WHERE id=${requestId}::uuid AND expires_at>now() AND authorized_at IS NULL RETURNING state`)).rows[0];
    if(!request)throw new BadRequestException('Sign-in request expired or was already authorized. Start again.');
    const url=new URL('/merchant-signin',this.config.getOrThrow<string>('THESI_WEB_URL'));
    url.hash=new URLSearchParams({code,state:String(request.state)}).toString();
    return {url:url.toString()};
  }

  private async request(code:string,verifier:string) {
    const request=(await this.db.execute(sql`SELECT * FROM thesi.merchant_login_request WHERE code_hash=${digest(code)} AND challenge=${digest(verifier)} AND expires_at>now() AND consumed_at IS NULL`)).rows[0] as any;
    if(!request?.assertion)throw new BadRequestException('Sign-in request expired or was already used. Start again.');
    const {vendorId,brandId,actorId,actorType}=request.assertion;
    return {request,assertion:await this.access.authority({vendorId,brandId,actorId,actorType})};
  }

  async inspect(code:string,verifier:string) {
    this.access.enabled();
    const {assertion:a}=await this.request(code,verifier);
    const identity=(await this.db.execute(sql`SELECT i.id,u.id AS user_id,u.email FROM thesi.merchant_identity i JOIN public.thesi_users u ON u.id=i.user_id WHERE i.vendor_id=${a.vendorId}::uuid AND i.actor_type=${a.actorType} AND i.actor_id=${a.actorId}::uuid`)).rows[0];
    const existing=(await this.db.select({id:schema.thesiUser.id}).from(schema.thesiUser).where(eq(schema.thesiUser.email,a.email.trim().toLowerCase())).limit(1))[0];
    const link=(await this.db.execute(sql`SELECT w.name FROM thesi.merchant_brand_link l JOIN thesi.brand_workspace w ON w.id=l.workspace_id WHERE l.vendor_id=${a.vendorId}::uuid AND l.merchant_brand_id=${a.brandId}::uuid AND l.revoked_at IS NULL`)).rows[0];
    return {email:a.email,fullName:a.fullName,brandName:a.brandName,vendorName:a.vendorName,permission:a.permission,
      requiresAccountProof:!identity&&!!existing,linkedAccountId:identity?.user_id??null,linkedAccountEmail:identity?.email??null,connected:!!link,workspaceName:link?.name??null};
  }

  async finish(input:{code:string;verifier:string;consent:boolean;workspaceId?:string;replaceLocalAccess?:boolean}, authenticatedUserId?:string) {
    this.access.enabled();
    if(input.consent!==true)throw new BadRequestException('Confirm the Merchant identity and brand connection');
    const {request,assertion:a}=await this.request(input.code,input.verifier);
    const result=await this.db.transaction(async tx=>{
      // Identity locks also serialize different browser requests for the same Merchant actor.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`merchant-identity:${a.vendorId}:${a.actorType}:${a.actorId}`},0))`);
      const locked=(await tx.execute(sql`SELECT id FROM thesi.merchant_login_request WHERE id=${request.id}::uuid AND consumed_at IS NULL AND expires_at>now() FOR UPDATE`)).rows[0];
      if(!locked)throw new BadRequestException('Sign-in request was already used');
      let identity=(await tx.execute(sql`SELECT * FROM thesi.merchant_identity WHERE vendor_id=${a.vendorId}::uuid AND actor_type=${a.actorType} AND actor_id=${a.actorId}::uuid`)).rows[0] as any;
      let user: typeof schema.thesiUser.$inferSelect | undefined;
      let createdUser = false;
      if(identity) user=(await tx.select().from(schema.thesiUser).where(eq(schema.thesiUser.id,identity.user_id)))[0];
      else {
        user=(await tx.select().from(schema.thesiUser).where(eq(schema.thesiUser.email,a.email.trim().toLowerCase())))[0];
        if(authenticatedUserId){
          const chosen=(await tx.select().from(schema.thesiUser).where(eq(schema.thesiUser.id,authenticatedUserId)))[0];
          if(user&&user.id!==authenticatedUserId)throw new ConflictException('Sign in to the existing account for this Merchant email');
          user=chosen;
        }
        if(user&&user.id!==authenticatedUserId)throw new ConflictException('Sign in to your existing Thesi account to approve this identity');
        if(!user){
          [user]=await tx.insert(schema.thesiUser).values({id:randomUUID(),email:a.email.trim().toLowerCase(),fullName:a.fullName,
            companyName:a.brandName,role:'brand',passwordHash:`$external$${randomBytes(32).toString('hex')}`,
            mustChangePassword:false,onboardingCompleted:false,onboardingStep:'welcome'}).returning();
          createdUser = true;
        }
        if(user.role!=='brand'||user.mustChangePassword)throw new ForbiddenException('Use an active Thesi brand account; creator accounts are never converted');
        identity=(await tx.execute(sql`INSERT INTO thesi.merchant_identity(vendor_id,actor_type,actor_id,user_id) VALUES(${a.vendorId}::uuid,${a.actorType},${a.actorId}::uuid,${user.id}) RETURNING *`)).rows[0];
      }
      if(!user||user.role!=='brand'||user.mustChangePassword)throw new UnauthorizedException('Thesi brand account is unavailable');
      if(authenticatedUserId&&authenticatedUserId!==user.id)throw new ConflictException('Sign out of the other Thesi account before opening this Merchant identity');
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`merchant-brand:${a.brandId}`},0))`);
      let link=(await tx.execute(sql`SELECT l.*,w.owner_user_id,w.status FROM thesi.merchant_brand_link l JOIN thesi.brand_workspace w ON w.id=l.workspace_id WHERE l.vendor_id=${a.vendorId}::uuid AND l.merchant_brand_id=${a.brandId}::uuid AND l.revoked_at IS NULL FOR UPDATE OF l,w`)).rows[0] as any;
      if(!link){
        if(a.actorType!=='owner')throw new ForbiddenException('The Merchant owner must connect this brand first');
        let workspaceId=input.workspaceId;
        if(createdUser && !workspaceId){
          // V33 provisions the first workspace with the account. Reuse it rather
          // than leaving a duplicate empty brand behind after first sign-in.
          const provisioned=(await tx.execute(sql`SELECT id FROM thesi.brand_workspace WHERE legacy_owner_user_id=${user.id} AND owner_user_id=${user.id} FOR UPDATE`)).rows[0];
          workspaceId=provisioned ? String(provisioned.id) : undefined;
        }
        if(workspaceId){
          const owned=(await tx.execute(sql`SELECT w.id FROM thesi.brand_workspace w JOIN thesi.brand_workspace_member m ON m.workspace_id=w.id AND m.user_id=${user.id} WHERE w.id=${workspaceId}::uuid AND w.owner_user_id=${user.id} AND w.status='active' AND m.status='active' AND m.role='owner' FOR UPDATE OF w`)).rows[0];
          if(!owned)throw new ForbiddenException('Choose a workspace you own');
          const other=(await tx.execute(sql`SELECT 1 FROM thesi.brand_workspace_member WHERE workspace_id=${workspaceId}::uuid AND user_id<>${user.id} AND status='active'`)).rows[0];
          if(other){
            if(input.replaceLocalAccess!==true)throw new ConflictException('Confirm replacing existing local staff access with Merchant Hub permissions for this workspace');
            await tx.execute(sql`UPDATE thesi.brand_workspace_member SET status='revoked',updated_at=now() WHERE workspace_id=${workspaceId}::uuid AND user_id<>${user.id} AND status='active'`);
            await tx.execute(sql`INSERT INTO thesi.merchant_workspace_audit(workspace_id,actor_user_id,controller,handler,event) VALUES(${workspaceId}::uuid,${user.id},'MerchantLoginController','finish','local_staff_access_replaced')`);
          }
        } else {
          // Each explicit new-brand consent creates one workspace; the request/brand locks make retries safe.
          const w=(await tx.execute(sql`INSERT INTO thesi.brand_workspace(owner_user_id,name) VALUES(${user.id},${a.brandName}) RETURNING id`)).rows[0];
          workspaceId=String(w.id);
          await tx.execute(sql`INSERT INTO thesi.brand_workspace_member(workspace_id,user_id,role) VALUES(${workspaceId}::uuid,${user.id},'owner')`);
          await tx.execute(sql`INSERT INTO thesi.brand_profile(workspace_id,company_name) VALUES(${workspaceId}::uuid,${a.brandName})`);
        }
        link=(await tx.execute(sql`INSERT INTO thesi.merchant_brand_link(vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id)
          VALUES(${a.vendorId}::uuid,${a.brandId}::uuid,${a.vendorName},${a.brandName},${workspaceId}::uuid,${user.id}) RETURNING *`)).rows[0];
        link.owner_user_id=user.id;link.status='active';
      }
      if(link.status!=='active'||(a.actorType==='owner'&&link.owner_user_id!==user.id))throw new ForbiddenException('Sign in and link the Merchant identity to the Thesi account that owns this brand');
      if(a.actorType==='staff'&&link.owner_user_id===user.id)throw new ForbiddenException('Staff cannot assume the workspace owner identity');
      if(input.workspaceId&&input.workspaceId!==link.workspace_id)throw new ConflictException('This Merchant brand is connected to another workspace');
      await tx.execute(sql`INSERT INTO thesi.brand_workspace_member(workspace_id,user_id,role,merchant_identity_id) VALUES(${link.workspace_id}::uuid,${user.id},${a.permission},${identity.id}::uuid)
        ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active',merchant_identity_id=EXCLUDED.merchant_identity_id,updated_at=now()`);
      const session=(await tx.execute(sql`INSERT INTO thesi.merchant_session(identity_id,link_id,user_id) VALUES(${identity.id}::uuid,${link.id}::uuid,${user.id}) RETURNING id`)).rows[0];
      await tx.execute(sql`UPDATE thesi.merchant_login_request SET consumed_at=now() WHERE id=${request.id}::uuid`);
      await tx.execute(sql`INSERT INTO thesi.merchant_login_audit(request_id,session_id,actor_user_id,event) VALUES(${request.id}::uuid,${session.id}::uuid,${user.id},'merchant_session_created')`);
      return {user,sessionId:String(session.id),workspaceId:String(link.workspace_id)};
    });
    return {...await this.auth.createSession(result.user,result.sessionId),workspaceId:result.workspaceId};
  }
}

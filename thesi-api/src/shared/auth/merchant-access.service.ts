import { Inject, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';

export type MerchantAssertion = {
  vendorId: string; brandId: string; actorType: 'owner'|'staff'; actorId: string;
  email: string; fullName: string; vendorName: string; brandName: string;
  permission: 'owner'|'viewer'|'member';
};

@Injectable()
export class MerchantAccessService {
  constructor(@Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase,
    private readonly config: ConfigService) {}

  enabled() {
    if (this.config.get('MERCHANT_SSO_ENABLED') !== true)
      throw new UnauthorizedException('Merchant sign-in is unavailable');
  }

  async authority(identity: Pick<MerchantAssertion,'vendorId'|'brandId'|'actorType'|'actorId'>): Promise<MerchantAssertion> {
    this.enabled();
    let response: Response;
    try {
      response = await fetch(new URL('/v1/internal/thesi/identity', this.config.getOrThrow<string>('MERCHANT_API_URL')), {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(8000),
        headers:{'Content-Type':'application/json','X-Thesi-Identity-Key':this.config.getOrThrow<string>('MERCHANT_IDENTITY_SERVICE_KEY')},
        body:JSON.stringify(identity),
      });
    } catch { throw new ServiceUnavailableException('Merchant access could not be verified. Please retry.'); }
    if ([401,403,404].includes(response.status)) throw new UnauthorizedException('Merchant access has been removed');
    if (!response.ok) throw new ServiceUnavailableException('Merchant access verification is unavailable');
    let envelope: any;
    try { envelope = await response.json(); }
    catch { throw new ServiceUnavailableException('Invalid Merchant identity response'); }
    const value = envelope.result;
    if (!value || Object.entries(identity).some(([key,val])=>value[key]!==val)
      || !['owner','viewer','member'].includes(value.permission)
      || (identity.actorType==='staff' && value.permission==='owner')
      || (identity.actorType==='owner' && value.permission!=='owner')
      || typeof value.email!=='string' || typeof value.fullName!=='string'
      || typeof value.brandName!=='string' || typeof value.vendorName!=='string')
      throw new ServiceUnavailableException('Invalid Merchant identity response');
    return value;
  }

  async session(userId: string, sessionId: string) {
    this.enabled();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new UnauthorizedException('Invalid Merchant session');
    const row = (await this.db.execute(sql`SELECT s.id,l.workspace_id,l.merchant_brand_id,w.owner_user_id,i.vendor_id,i.actor_type,i.actor_id,m.role
      FROM thesi.merchant_session s JOIN thesi.merchant_identity i ON i.id=s.identity_id
      JOIN thesi.merchant_brand_link l ON l.id=s.link_id
      JOIN thesi.brand_workspace w ON w.id=l.workspace_id
      JOIN thesi.brand_workspace_member m ON m.workspace_id=w.id AND m.user_id=s.user_id
      WHERE s.id=${sessionId}::uuid AND s.user_id=${userId} AND i.user_id=${userId}
      AND s.revoked_at IS NULL AND s.expires_at>now() AND l.revoked_at IS NULL
      AND l.vendor_id=i.vendor_id AND m.merchant_identity_id=i.id
      AND w.status='active' AND m.status='active'`)).rows[0] as any;
    if (!row) throw new UnauthorizedException('Merchant session expired or was revoked');
    if ((row.actor_type==='owner') !== (row.owner_user_id===userId))
      throw new UnauthorizedException('Merchant workspace ownership changed');
    const authority = await this.authority({vendorId:row.vendor_id,brandId:String(row.merchant_brand_id),actorType:row.actor_type,actorId:row.actor_id});
    return {workspaceId:row.workspace_id as string,permission:authority.permission,identity:authority};
  }

  async membership(userId: string, workspaceId: string, identityId: string) {
    const row = (await this.db.execute(sql`SELECT i.vendor_id,i.actor_type,i.actor_id,l.merchant_brand_id
      FROM thesi.merchant_identity i JOIN thesi.merchant_brand_link l ON l.vendor_id=i.vendor_id
      WHERE i.id=${identityId}::uuid AND i.user_id=${userId} AND l.workspace_id=${workspaceId}::uuid AND l.revoked_at IS NULL`)).rows[0] as any;
    if (!row) throw new UnauthorizedException('Merchant membership is no longer linked');
    return this.authority({vendorId:row.vendor_id,brandId:row.merchant_brand_id,actorType:row.actor_type,actorId:row.actor_id});
  }

  async revoke(userId: string, sessionId: string) {
    await this.db.execute(sql`UPDATE thesi.merchant_session SET revoked_at=now() WHERE id=${sessionId}::uuid AND user_id=${userId}`);
  }
}

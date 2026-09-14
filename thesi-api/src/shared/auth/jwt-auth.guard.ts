import { Optional } from '@nestjs/common';
import { MerchantAccessService } from './merchant-access.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type AuthJwtPayload = {
  sub: string;
  email: string;
  role: string;
  merchantSessionId?: string;
  merchantWorkspaceId?: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthJwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService, @Optional() private readonly merchant?: MerchantAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    try {
      req.user = this.jwtService.verify<AuthJwtPayload>(token);

    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (req.user.merchantSessionId) {
      if (!this.merchant) throw new UnauthorizedException('Merchant session verification unavailable');
      const access = await this.merchant.session(req.user.sub, req.user.merchantSessionId);
      req.user.merchantWorkspaceId = access.workspaceId;
    }
    return true;
  }
}

function extractBearer(req: Request): string | undefined {
  const raw = req.headers.authorization;
  if (!raw || Array.isArray(raw)) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1]?.trim() || undefined;
}

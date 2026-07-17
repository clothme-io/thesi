import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.configService.getOrThrow<string>('ADMIN_API_KEY');

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-api-key'];
    const key = Array.isArray(provided) ? provided[0] : provided;

    if (!key || key !== configured) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthJwtPayload, AuthenticatedRequest } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthJwtPayload => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new Error('CurrentUser used without JwtAuthGuard');
    }
    return req.user;
  },
);

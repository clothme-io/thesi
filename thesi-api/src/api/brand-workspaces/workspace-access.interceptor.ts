import { BadRequestException, ForbiddenException, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from 'src/shared/auth/jwt-auth.guard';
import { BrandWorkspacesService } from './brand-workspaces.service';
import { workspaceContext } from './workspace-context';

const WORKSPACE_CONTROLLERS = new Set([
  'CommissionSettlementController', 'CampaignFundingController', 'CommissionEarningsController', 'CampaignsController', 'MarketplaceController', 'ProfilesController',
  'InboxController', 'InvitesController', 'CreatorsController', 'BillingController',
]);
const FINANCIAL_HANDLERS = new Set(['getPlatformFee', 'payPlatformFee', 'listPayouts', 'payCreator']);

@Injectable()
export class WorkspaceAccessInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService, private readonly workspaces: BrandWorkspacesService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const selected = req.headers['x-thesi-workspace-id'];
    if (selected !== undefined && (typeof selected !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected))) {
      throw new BadRequestException('Invalid workspace identifier');
    }
    const controller = context.getClass().name;
    const enabled = this.config.get('BRAND_WORKSPACE_ACCESS_ENABLED') === true;
    if (!enabled || req.user?.role !== 'brand' || !WORKSPACE_CONTROLLERS.has(controller)) {
      if (selected !== undefined) throw new BadRequestException('Workspace selection is unavailable for this request');
      return next.handle();
    }

    if(req.user.merchantWorkspaceId && selected && selected!==req.user.merchantWorkspaceId)throw new ForbiddenException('Open this brand from Merchant Hub to start its session');
    const access = await this.workspaces.resolveLegacyAccess(req.user.sub, (selected as string | undefined)??req.user.merchantWorkspaceId);
    const mutation=!['GET','HEAD','OPTIONS'].includes(req.method);
    if(access.role!=='owner'){
      const allowed=new Set(['CampaignsController','MarketplaceController','InvitesController','InboxController','CreatorsController','ProfilesController','CommissionEarningsController']);
      if(!allowed.has(controller))throw new ForbiddenException('Only the account owner can manage campaign funds and payments');
      if(mutation && !new Set(['CampaignsController','MarketplaceController','InvitesController','InboxController','CreatorsController']).has(controller))throw new ForbiddenException('Only the owner can change brand settings');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && access.role === 'viewer') {
      throw new ForbiddenException('Workspace is read-only');
    }
    // Billing still uses the historical account payer. A workspace membership
    // alone must not confer access to that account's cards, invoices or charges.
    if ((controller === 'BillingController' || FINANCIAL_HANDLERS.has(context.getHandler().name)) && access.role !== 'owner') {
      throw new ForbiddenException('Only the account owner can access billing');
    }
    if (access.isDefault === false && (controller === 'BillingController' || ['payCreator', 'payPlatformFee'].includes(context.getHandler().name))) {
      throw new ForbiddenException('Billing for this brand must be explicitly configured before charging');
    }

    if(access.role!=='owner'&&mutation)await this.workspaces.auditDelegatedAction(access,controller,context.getHandler().name);
    return new Observable(subscriber => {
      const subscription = workspaceContext.run(Object.freeze(access), () => next.handle().subscribe(subscriber));
      return () => subscription.unsubscribe();
    });
  }
}

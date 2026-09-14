import { AsyncLocalStorage } from 'node:async_hooks';
import { getTableName, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export type WorkspaceContext = Readonly<{
  workspaceId: string;
  actorUserId: string;
  ownerUserId?: string;
  role: string;
  isDefault?: boolean;
  name?: string;
}>;

export const workspaceContext = new AsyncLocalStorage<WorkspaceContext>();

export function workspaceWrite() {
  const context = workspaceContext.getStore();
  return context ? { workspaceId: context.workspaceId } : {};
}

export function brandProfileFilter(table: PgTable, userColumn: SQL, userId: string): SQL {
  return workspaceContext.getStore() ? workspaceFilter(table) : sql`${userColumn} = ${userId}`;
}

// V33 columns are required by table projections even when access is disabled.
// Once secondary brands exist, startup prevents disabling workspace protection.
export function workspaceFilter(table: PgTable): SQL {
  const context = workspaceContext.getStore();
  return context
    ? sql`${sql.identifier(getTableName(table))}.${sql.identifier('workspace_id')} = ${context.workspaceId}::uuid`
    : sql`true`;
}

export function workspaceCampaignFilter(campaignId: SQL): SQL {
  const context = workspaceContext.getStore();
  return context ? sql`EXISTS (SELECT 1 FROM thesi.campaign AS workspace_campaign
    WHERE workspace_campaign.id::text = ${campaignId}::text
      AND workspace_campaign.workspace_id = ${context.workspaceId}::uuid)` : sql`true`;
}

export function workspaceThreadFilter(threadId: SQL): SQL {
  const context = workspaceContext.getStore();
  return context ? sql`EXISTS (SELECT 1 FROM thesi.inbox_thread AS workspace_thread
    WHERE workspace_thread.id = ${threadId}
      AND workspace_thread.workspace_id = ${context.workspaceId}::uuid)` : sql`true`;
}

/** Legacy service parameters describe the owning brand account, not the authenticated actor.
 * The signed actor stays in WorkspaceContext and is recorded by the access audit.
 * Only use from workspace-protected brand business controllers, never auth/billing. */
export function workspaceResourceOwner(actorUserId: string): string {
  const context=workspaceContext.getStore();
  if(!context)return actorUserId;
  if(context.actorUserId!==actorUserId)throw new Error('Workspace actor mismatch');
  return context.ownerUserId??actorUserId;
}

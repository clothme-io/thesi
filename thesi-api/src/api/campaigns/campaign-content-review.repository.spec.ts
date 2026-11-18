import { PgDialect } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from 'src/dbConfig/drizzle/schema';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { PostgresCampaignContentReviewRepository } from './campaign-content-review.repository';

describe('CampaignContentReviewRepository campaign access', () => {
  const campaignId = '11111111-1111-1111-1111-111111111111';
  const workspaceId = '10000000-0000-4000-8000-000000000001';

  it('requires the selected workspace for brand campaign lookup and leaves creator lookup unscoped', async () => {
    const predicates: unknown[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: (predicate: unknown) => {
            predicates.push(predicate);
            return { limit: async () => [] };
          },
        }),
      }),
    } as unknown as NodePgDatabase<typeof schema>;
    const repository = new PostgresCampaignContentReviewRepository(db);
    const dialect = new PgDialect();

    await workspaceContext.run({ workspaceId, actorUserId: 'staff-1', ownerUserId: 'brand-1', role: 'member' }, () => repository.getCampaign(campaignId));
    const brandQuery = dialect.sqlToQuery(predicates[0] as Parameters<PgDialect['sqlToQuery']>[0]);
    expect(brandQuery.sql).toContain('"campaign"."workspace_id"');
    expect(brandQuery.params).toEqual([workspaceId, campaignId]);

    await repository.getCampaign(campaignId);
    const creatorQuery = dialect.sqlToQuery(predicates[1] as Parameters<PgDialect['sqlToQuery']>[0]);
    expect(creatorQuery.sql).not.toContain('"campaign"."workspace_id"');
    expect(creatorQuery.params).toEqual([campaignId]);
  });
});

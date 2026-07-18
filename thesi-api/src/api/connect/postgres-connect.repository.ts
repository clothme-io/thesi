import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type { ConnectRepository, ConnectUser } from './connect.repository';

@Injectable()
export class PostgresConnectRepository implements ConnectRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<ConnectUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        stripeConnectAccountId: schema.thesiUser.stripeConnectAccountId,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async saveStripeConnectAccountId(
    userId: string,
    stripeConnectAccountId: string,
  ): Promise<void> {
    await this.db
      .update(schema.thesiUser)
      .set({
        stripeConnectAccountId,
        updatedAt: new Date(),
      })
      .where(eq(schema.thesiUser.id, userId));
  }
}

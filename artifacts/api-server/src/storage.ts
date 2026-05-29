import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class Storage {
  async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    return user ?? null;
  }

  async getUserByStripeCustomerId(customerId: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.stripeCustomerId, customerId));
    return user ?? null;
  }

  async upsertUser(email: string, patch: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }) {
    const [user] = await db
      .insert(usersTable)
      .values({ id: email, email, ...patch })
      .onConflictDoUpdate({ target: usersTable.email, set: patch })
      .returning();
    return user;
  }
}

export const storage = new Storage();

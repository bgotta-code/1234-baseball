import { db, usersTable, licensesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

export class Storage {
  // ── Users ─────────────────────────────────────────────────────────────────

  async upsertUser(email: string, patch: { stripeCustomerId?: string }) {
    const [user] = await db
      .insert(usersTable)
      .values({ id: email, email, ...patch })
      .onConflictDoUpdate({ target: usersTable.email, set: patch })
      .returning();
    return user;
  }

  // ── Licenses ──────────────────────────────────────────────────────────────

  async getLicense(key: string) {
    const [license] = await db
      .select()
      .from(licensesTable)
      .where(eq(licensesTable.key, key));
    return license ?? null;
  }

  async getLicenseBySessionId(sessionId: string) {
    const [license] = await db
      .select()
      .from(licensesTable)
      .where(eq(licensesTable.stripeSessionId, sessionId));
    return license ?? null;
  }

  async createLicense(data: { key: string; email: string; stripeSessionId: string }) {
    const [license] = await db
      .insert(licensesTable)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return license ?? null;
  }
}

export const storage = new Storage();

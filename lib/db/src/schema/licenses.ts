import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const licensesTable = pgTable('licenses', {
  key: text('key').primaryKey(),
  email: text('email').notNull(),
  stripeSessionId: text('stripe_session_id').notNull().unique(),
  purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
});

export type License = typeof licensesTable.$inferSelect;

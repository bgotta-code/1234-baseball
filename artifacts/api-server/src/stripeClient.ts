import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is required`);
  return val;
}

// Returns a fresh Stripe client each call — do not cache
export function getUncachableStripeClient(): Stripe {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'));
}

export function getStripePublishableKey(): string {
  return requireEnv('STRIPE_PUBLISHABLE_KEY');
}

// StripeSync holds a DB pool — keep as singleton
let _sync: StripeSync | null = null;

export function getStripeSync(): StripeSync {
  if (!_sync) {
    _sync = new StripeSync({
      poolConfig: { connectionString: requireEnv('DATABASE_URL') },
      stripeSecretKey: requireEnv('STRIPE_SECRET_KEY'),
    });
  }
  return _sync;
}

import Stripe from 'stripe';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is required`);
  return val;
}

export function getUncachableStripeClient(): Stripe {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'));
}

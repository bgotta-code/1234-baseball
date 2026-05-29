/**
 * Creates the "1234 Baseball Pro" subscription product in Stripe.
 * Safe to run multiple times — skips creation if the product already exists.
 *
 * Usage: pnpm --filter @workspace/scripts run seed-products
 */
import { getUncachableStripeClient } from './stripeClient.js';

async function seed() {
  const stripe = getUncachableStripeClient();

  console.log('Checking for existing 1234 Baseball Pro product…');
  const existing = await stripe.products.search({
    query: "name:'1234 Baseball Pro' AND active:'true'",
  });

  if (existing.data.length > 0) {
    const prod = existing.data[0];
    console.log(`Product already exists: ${prod.id}`);
    const prices = await stripe.prices.list({ product: prod.id, active: true });
    for (const p of prices.data) {
      const interval = (p.recurring?.interval ?? 'one_time');
      const amount = ((p.unit_amount ?? 0) / 100).toFixed(2);
      console.log(`  Price ${p.id}: $${amount}/${interval}`);
    }
    return;
  }

  console.log('Creating product…');
  const product = await stripe.products.create({
    name: '1234 Baseball Pro',
    description: 'Host games up to 9 innings and enjoy shorter ads.',
    metadata: { tier: 'pro' },
  });
  console.log(`Created product: ${product.id}`);

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 299, // $2.99
    currency: 'usd',
    recurring: { interval: 'month' },
  });
  console.log(`Created monthly price: $2.99/month — ${monthly.id}`);

  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: 1999, // $19.99
    currency: 'usd',
    recurring: { interval: 'year' },
  });
  console.log(`Created yearly price: $19.99/year — ${yearly.id}`);

  console.log('\n✓ Done. Stripe webhooks will sync these to the database automatically.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

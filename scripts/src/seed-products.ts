/**
 * Ensures the "1234 Baseball Pro" one-time purchase product exists in Stripe.
 * Safe to re-run — skips if already present.
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

  for (const product of existing.data) {
    const prices = await stripe.prices.list({ product: product.id, active: true, type: 'one_time' });
    if (prices.data.length > 0) {
      console.log(`Product already has a one-time price — no action needed.`);
      console.log(`  Product: ${product.id}`);
      for (const p of prices.data) {
        const amount = ((p.unit_amount ?? 0) / 100).toFixed(2);
        console.log(`  Price:   ${p.id}  $${amount} one-time`);
      }
      return;
    }
  }

  // Archive any old subscription prices on existing product
  if (existing.data.length > 0) {
    const product = existing.data[0];
    console.log(`Found product ${product.id} — archiving old subscription prices…`);
    const oldPrices = await stripe.prices.list({ product: product.id, active: true });
    for (const p of oldPrices.data) {
      await stripe.prices.update(p.id, { active: false });
      console.log(`  Archived price ${p.id}`);
    }
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 299,
      currency: 'usd',
    });
    console.log(`✓ Created one-time price $2.99 — ${price.id}`);
    return;
  }

  // No product at all — create from scratch
  console.log('Creating product…');
  const product = await stripe.products.create({
    name: '1234 Baseball Pro',
    description: 'Unlock 5, 7, and 9-inning games plus shorter ads. Yours forever.',
    metadata: { tier: 'pro' },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 299,
    currency: 'usd',
  });
  console.log(`✓ Created product ${product.id} with one-time price $2.99 — ${price.id}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { Router, type IRouter } from 'express';
import { storage } from '../storage.js';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient.js';
import { generateLicenseKey } from '../licenseKey.js';

const router: IRouter = Router();

// Public key for frontend Stripe.js initialisation
router.get('/stripe/config', (_req, res) => {
  res.json({ publishableKey: getStripePublishableKey() });
});

// Create a Stripe Checkout session (one-time payment)
// Body: { email, successUrl, cancelUrl }
router.post('/stripe/checkout', async (req, res) => {
  const { email, successUrl, cancelUrl } = req.body as {
    email: string; successUrl: string; cancelUrl: string;
  };

  if (!email || !successUrl || !cancelUrl) {
    res.status(400).json({ error: 'email, successUrl, and cancelUrl are required' });
    return;
  }

  const stripe = getUncachableStripeClient();

  // Find or create the one-time price for $2.99
  const priceId = await getOrCreateOneTimePrice(stripe);

  // Find or create customer
  const existing = await stripe.customers.list({ email, limit: 1 });
  let customerId: string;
  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
  }

  await storage.upsertUser(email, { stripeCustomerId: customerId });

  // Generate the license key now so we can embed it in the success URL
  const licenseKey = generateLicenseKey();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${successUrl}?license=${encodeURIComponent(licenseKey)}`,
    cancel_url: cancelUrl,
    metadata: { licenseKey, email },
  });

  res.json({ url: session.url });
});

export default router;

// ── helpers ──────────────────────────────────────────────────────────────────

let _cachedPriceId: string | null = null;

async function getOrCreateOneTimePrice(stripe: ReturnType<typeof getUncachableStripeClient>): Promise<string> {
  if (_cachedPriceId) return _cachedPriceId;

  // Look for an existing active product with a one-time $2.99 price
  const products = await stripe.products.search({
    query: "name:'1234 Baseball Pro' AND active:'true'",
  });

  for (const product of products.data) {
    const prices = await stripe.prices.list({ product: product.id, active: true, type: 'one_time' });
    if (prices.data.length > 0) {
      _cachedPriceId = prices.data[0].id;
      return _cachedPriceId;
    }
  }

  // None found — create product + price on the fly
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
  _cachedPriceId = price.id;
  return _cachedPriceId;
}

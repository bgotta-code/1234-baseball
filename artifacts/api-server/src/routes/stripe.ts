import { Router, type IRouter } from 'express';
import { storage } from '../storage.js';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient.js';

const router: IRouter = Router();

// Public key for frontend Stripe.js initialisation
router.get('/stripe/config', (_req, res) => {
  res.json({ publishableKey: getStripePublishableKey() });
});

// List active products with prices — fetched directly from Stripe API
router.get('/stripe/products', async (_req, res) => {
  const stripe = getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });

  const data = await Promise.all(
    products.data.map(async (product) => {
      const prices = await stripe.prices.list({ product: product.id, active: true });
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        metadata: product.metadata,
        prices: prices.data.map((p) => ({
          id: p.id,
          unitAmount: p.unit_amount,
          currency: p.currency,
          recurring: p.recurring,
        })),
      };
    }),
  );

  res.json({ data });
});

// Create a Stripe Checkout session
// Body: { email, priceId, successUrl, cancelUrl }
router.post('/stripe/checkout', async (req, res) => {
  const { email, priceId, successUrl, cancelUrl } = req.body as {
    email: string; priceId: string; successUrl: string; cancelUrl: string;
  };

  if (!email || !priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: 'email, priceId, successUrl, and cancelUrl are required' });
    return;
  }

  const stripe = getUncachableStripeClient();

  // Find or create Stripe customer by email
  const existing = await stripe.customers.list({ email, limit: 1 });
  let customerId: string;
  if (existing.data.length > 0) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
  }

  await storage.upsertUser(email, { stripeCustomerId: customerId });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  res.json({ url: session.url });
});

// Check whether an email has an active Pro subscription
// GET /api/stripe/check-pro?email=...
router.get('/stripe/check-pro', async (req, res) => {
  const email = req.query['email'] as string | undefined;
  if (!email) {
    res.status(400).json({ error: 'email query param required' });
    return;
  }

  const user = await storage.getUserByEmail(email);
  if (!user?.stripeSubscriptionId) {
    res.json({ isPro: false });
    return;
  }

  // Verify subscription status directly from Stripe
  const stripe = getUncachableStripeClient();
  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  const isPro = sub.status === 'active' || sub.status === 'trialing';
  res.json({ isPro });
});

// Billing portal — lets customers manage their subscription
// Body: { email, returnUrl }
router.post('/stripe/portal', async (req, res) => {
  const { email, returnUrl } = req.body as { email: string; returnUrl: string };
  if (!email || !returnUrl) {
    res.status(400).json({ error: 'email and returnUrl are required' });
    return;
  }

  const user = await storage.getUserByEmail(email);
  if (!user?.stripeCustomerId) {
    res.status(404).json({ error: 'No billing account found for this email' });
    return;
  }

  const stripe = getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  res.json({ url: session.url });
});

export default router;

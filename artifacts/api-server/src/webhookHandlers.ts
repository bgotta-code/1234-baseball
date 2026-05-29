import Stripe from 'stripe';
import { getUncachableStripeClient } from './stripeClient.js';
import { storage } from './storage.js';
import { logger } from './lib/logger.js';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'Webhook payload must be a Buffer. ' +
        'Make sure the webhook route is registered BEFORE app.use(express.json()).',
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getUncachableStripeClient();

    let event: Stripe.Event;
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    logger.info({ type: event.type }, 'Stripe webhook received');

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only handle one-time payments (not subscriptions)
      if (session.mode !== 'payment') return;

      const licenseKey = session.metadata?.['licenseKey'];
      const email = session.metadata?.['email'] ?? session.customer_details?.email;

      if (!licenseKey || !email) {
        logger.warn({ sessionId: session.id }, 'Missing licenseKey or email in session metadata');
        return;
      }

      // Idempotent: create the license if it doesn't exist yet
      const existing = await storage.getLicenseBySessionId(session.id);
      if (!existing) {
        await storage.createLicense({ key: licenseKey, email, stripeSessionId: session.id });
        logger.info({ email, licenseKey }, 'License created');
      }
    }
  }
}

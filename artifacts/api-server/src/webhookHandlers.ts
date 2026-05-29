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
      // No secret configured — parse as-is (dev only; add STRIPE_WEBHOOK_SECRET in production)
      logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    logger.info({ type: event.type }, 'Stripe webhook received');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email ?? session.customer_email;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
        if (email && subscriptionId) {
          await storage.upsertUser(email, {
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId,
          });
          logger.info({ email, subscriptionId }, 'User upgraded to Pro');
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          await storage.upsertUser(user.email, { stripeSubscriptionId: sub.id });
          logger.info({ email: user.email, status: sub.status }, 'Subscription updated');
        }
        break;
      }

      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event');
    }
  }
}

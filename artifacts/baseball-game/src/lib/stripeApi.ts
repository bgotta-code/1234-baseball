const BASE = '/api/stripe';

export interface StripePrice {
  id: string;
  unitAmount: number | null;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string>;
  prices: StripePrice[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getProducts(): Promise<StripeProduct[]> {
  const data = await json<{ data: StripeProduct[] }>(await fetch(`${BASE}/products`));
  return data.data;
}

export async function checkPro(email: string): Promise<boolean> {
  const data = await json<{ isPro: boolean }>(
    await fetch(`${BASE}/check-pro?email=${encodeURIComponent(email)}`),
  );
  return data.isPro;
}

export async function createCheckoutSession(opts: {
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const data = await json<{ url: string }>(
    await fetch(`${BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }),
  );
  return data.url;
}

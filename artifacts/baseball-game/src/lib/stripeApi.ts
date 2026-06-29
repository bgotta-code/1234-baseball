const BASE = '/api';

export async function getPublishableKey(): Promise<string> {
  const res = await fetch(`${BASE}/stripe/config`);
  const data = await res.json() as { publishableKey: string };
  return data.publishableKey;
}

export async function createCheckoutSession(opts: {
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const res = await fetch(`${BASE}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { url: string };
  return data.url;
}

export async function verifyLicenseKey(key: string): Promise<boolean> {
  const res = await fetch(`${BASE}/license/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) return false;
  const data = await res.json() as { valid: boolean };
  return data.valid;
}

export async function restoreLicenseByEmail(email: string): Promise<{ key: string } | { error: string }> {
  const res = await fetch(`${BASE}/license/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json() as { key?: string; error?: string };
  if (!res.ok) return { error: data.error ?? 'No purchase found for that email address.' };
  return { key: data.key! };
}

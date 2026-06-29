import { Router, type IRouter, type Request } from 'express';
import { storage } from '../storage.js';

const router: IRouter = Router();

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
// Prevents bulk enumeration of license keys by email.
// 5 restore attempts per IP per 15-minute window.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const restoreAttempts = new Map<string, number[]>();

function ipOf(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (restoreAttempts.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (window.length >= MAX_ATTEMPTS) return true;
  window.push(now);
  restoreAttempts.set(ip, window);
  return false;
}

// ── Verify a license key ──────────────────────────────────────────────────────
// POST /api/license/verify   body: { key: string }
router.post('/license/verify', async (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== 'string') {
    res.status(400).json({ error: 'key is required' });
    return;
  }

  const license = await storage.getLicense(key.trim().toUpperCase());
  res.json({ valid: !!license });
});

// ── Restore Pro access by email ───────────────────────────────────────────────
// POST /api/license/restore   body: { email: string }
// Looks up the license tied to this email and re-activates it on the client.
// Rate-limited to 5 attempts per IP per 15 minutes to prevent enumeration.
router.post('/license/restore', async (req, res) => {
  const ip = ipOf(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
    return;
  }

  const { email } = req.body as { email?: string };
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  const license = await storage.getLicenseByEmail(email);
  if (!license) {
    // Return the same 404 regardless — don't distinguish "no account" from "wrong email"
    res.status(404).json({ error: 'No purchase found for that email address.' });
    return;
  }

  res.json({ key: license.key });
});

export default router;

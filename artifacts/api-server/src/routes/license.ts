import { Router, type IRouter } from 'express';
import { storage } from '../storage.js';

const router: IRouter = Router();

// Verify a license key
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

// Restore a license key by email
// POST /api/license/restore   body: { email: string }
// Returns the license key so the client can re-activate without manual entry.
router.post('/license/restore', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  const license = await storage.getLicenseByEmail(email);
  if (!license) {
    res.status(404).json({ error: 'No purchase found for that email address.' });
    return;
  }

  res.json({ key: license.key });
});

export default router;

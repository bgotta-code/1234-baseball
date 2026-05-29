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

export default router;

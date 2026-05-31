import { useEffect, useState } from 'react';
import type { AdConfig } from '@/components/AdScreen';

const GITHUB_URL =
  'https://raw.githubusercontent.com/bgotta-code/1234-baseball/main/artifacts/baseball-game/public/ads.json';
const FALLBACK_URL = '/ads.json';
const TTL_MS = 5 * 60 * 1000;

let cached: AdConfig[] | null = null;
let fetchedAt = 0;

async function loadAds(): Promise<AdConfig[]> {
  if (cached && Date.now() - fetchedAt < TTL_MS) return cached;
  for (const url of [GITHUB_URL, FALLBACK_URL]) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) continue;
      const data: AdConfig[] = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        cached = data;
        fetchedAt = Date.now();
        return cached;
      }
    } catch {
      // try next
    }
  }
  cached = [{ type: 'placeholder' }];
  fetchedAt = Date.now();
  return cached;
}

export function useRandomAd(): AdConfig | undefined {
  const [ads, setAds] = useState<AdConfig[]>(cached ?? []);

  useEffect(() => {
    loadAds().then(setAds);
  }, []);

  if (ads.length === 0) return undefined;
  return ads[Math.floor(Math.random() * ads.length)];
}

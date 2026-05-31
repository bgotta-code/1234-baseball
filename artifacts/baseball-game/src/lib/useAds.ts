import { useEffect, useState } from 'react';
import type { AdConfig } from '@/components/AdScreen';

let cached: AdConfig[] | null = null;

export function useRandomAd(): AdConfig | undefined {
  const [ads, setAds] = useState<AdConfig[]>(cached ?? []);

  useEffect(() => {
    if (cached) { setAds(cached); return; }
    fetch('/ads.json')
      .then(r => r.json())
      .then((data: AdConfig[]) => {
        cached = Array.isArray(data) && data.length > 0 ? data : [{ type: 'placeholder' }];
        setAds(cached);
      })
      .catch(() => {
        cached = [{ type: 'placeholder' }];
        setAds(cached);
      });
  }, []);

  if (ads.length === 0) return undefined;
  return ads[Math.floor(Math.random() * ads.length)];
}

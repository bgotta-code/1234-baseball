import { useState, useEffect, useCallback } from 'react';
import { verifyLicenseKey } from '@/lib/stripeApi';

const STORAGE_KEY = 'baseball_pro_license';

function loadStoredKey(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function saveKey(key: string) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignore */ }
}

export interface ProState {
  isPro: boolean;
  licenseKey: string | null;
  /** Activate with a key — verifies against the API then persists */
  activate: (key: string) => Promise<{ success: boolean; error?: string }>;
  /** Call after a successful Stripe redirect to activate via URL param */
  activateFromUrl: () => Promise<void>;
}

export function usePro(): ProState {
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  // On mount: restore from localStorage and validate if a key was previously saved
  useEffect(() => {
    const stored = loadStoredKey();
    if (!stored) return;
    setLicenseKey(stored);
    verifyLicenseKey(stored)
      .then((valid) => {
        setIsPro(valid);
        if (!valid) {
          // Key no longer valid (e.g., refunded) — clear it
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
          setLicenseKey(null);
        }
      })
      .catch(() => {
        // Network error — assume valid if we have a stored key (offline-friendly)
        setIsPro(true);
      });
  }, []);

  const activate = useCallback(async (key: string): Promise<{ success: boolean; error?: string }> => {
    const normalised = key.trim().toUpperCase();
    try {
      const valid = await verifyLicenseKey(normalised);
      if (valid) {
        saveKey(normalised);
        setLicenseKey(normalised);
        setIsPro(true);
        return { success: true };
      }
      return { success: false, error: 'License key not found. Check for typos and try again.' };
    } catch {
      return { success: false, error: 'Could not reach the server. Check your connection.' };
    }
  }, []);

  // After a Stripe redirect, ?license=KEY is appended to the URL
  const activateFromUrl = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('license');
    if (!key) return;
    // Clean the URL immediately so it doesn't re-trigger on refresh
    const clean = window.location.pathname;
    window.history.replaceState({}, '', clean);
    await activate(key);
  }, [activate]);

  return { isPro, licenseKey, activate, activateFromUrl };
}

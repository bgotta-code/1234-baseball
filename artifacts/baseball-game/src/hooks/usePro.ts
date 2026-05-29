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

  // After a Stripe redirect, ?license=KEY is appended to the URL.
  // We trust the key from our own success_url immediately and save it to
  // localStorage right away — then verify against the API in the background.
  const activateFromUrl = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('license');
    if (!key) return;

    // Normalise and strip the param from the URL right away
    const normalised = key.trim().toUpperCase();
    window.history.replaceState({}, '', window.location.pathname);

    // Optimistically unlock — the key came from our own server-generated
    // success_url so it's trustworthy. API verification is belt-and-suspenders.
    saveKey(normalised);
    setLicenseKey(normalised);
    setIsPro(true);

    // Confirm with the API in the background; roll back only if explicitly invalid
    try {
      const valid = await verifyLicenseKey(normalised);
      if (!valid) {
        // Shouldn't happen (key was pre-saved at checkout), but handle it
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setLicenseKey(null);
        setIsPro(false);
      }
    } catch {
      // Network error — keep the optimistic unlock, it'll re-verify next load
    }
  }, []);

  return { isPro, licenseKey, activate, activateFromUrl };
}

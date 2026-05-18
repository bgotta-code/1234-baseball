const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[push] Service worker registration failed:', e);
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
  } catch (e) {
    console.warn('[push] Subscription failed:', e);
    return null;
  }
}

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

const GAME_URL = 'https://1234baseball.com';
const DESKTOP_BREAKPOINT = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT,
  );
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

export function DesktopGate({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const [dismissed, setDismissed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(GAME_URL, {
      width: 160,
      margin: 1,
      color: { dark: '#ffffff', light: '#00000000' },
    }).then(setQrDataUrl).catch(() => {});
  }, []);

  if (!isDesktop || dismissed) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)' }}
    >
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">
        <div className="text-5xl">⚾</div>

        <div className="flex flex-col gap-2">
          <h1 className="text-white font-black text-2xl leading-tight">
            Built for mobile
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            1,2,3,4 Baseball is designed to be played on two phones — one per
            player. Scan the code or open the link on your phone to play.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border border-white/15 flex flex-col items-center"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR code for 1234baseball.com" width={160} height={160} />
          ) : (
            <div className="w-40 h-40 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }} />
          )}
          <p className="text-white/40 text-[11px] mt-3 tracking-wide">
            1234baseball.com
          </p>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-white/25 text-xs underline underline-offset-2 hover:text-white/50 transition-colors"
        >
          Continue on desktop anyway
        </button>
      </div>
    </div>
  );
}

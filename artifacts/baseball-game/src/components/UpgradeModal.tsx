import { useState, useEffect, useRef } from 'react';
import { createCheckoutSession, restoreLicenseByEmail } from '@/lib/stripeApi';

interface UpgradeModalProps {
  onClose: () => void;
  onActivate: (key: string) => Promise<{ success: boolean; error?: string }>;
}

export function UpgradeModal({ onClose, onActivate }: UpgradeModalProps) {
  const [tab, setTab] = useState<'buy' | 'redeem'>('buy');
  const backdropReady = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { backdropReady.current = true; }, 400);
    return () => clearTimeout(t);
  }, []);

  // Buy tab
  const [email, setEmail] = useState('');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  // Redeem tab — key entry mode
  const [key, setKey] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemOk, setRedeemOk] = useState(false);

  // Redeem tab — email restore mode
  const [restoreMode, setRestoreMode] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const handleBuy = async () => {
    if (!email.trim()) { setBuyError('Enter your email to receive the license key.'); return; }
    setBuying(true);
    setBuyError('');
    try {
      const successUrl = window.location.origin + window.location.pathname;
      const cancelUrl = window.location.origin + window.location.pathname;
      const url = await createCheckoutSession({ email: email.trim(), successUrl, cancelUrl });
      window.location.href = url;
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBuying(false);
    }
  };

  const handleRedeem = async () => {
    if (key.trim().length < 10) { setRedeemError('Enter your full license key.'); return; }
    setRedeeming(true);
    setRedeemError('');
    const result = await onActivate(key);
    setRedeeming(false);
    if (result.success) {
      setRedeemOk(true);
      setTimeout(onClose, 1400);
    } else {
      setRedeemError(result.error ?? 'Invalid key.');
    }
  };

  const handleRestore = async () => {
    if (!restoreEmail.trim() || !restoreEmail.includes('@')) {
      setRestoreError('Enter the email you used when you paid.');
      return;
    }
    setRestoring(true);
    setRestoreError('');
    const result = await restoreLicenseByEmail(restoreEmail.trim());
    if ('error' in result) {
      setRestoring(false);
      setRestoreError(result.error);
      return;
    }
    // Activate the recovered key
    const activation = await onActivate(result.key);
    setRestoring(false);
    if (activation.success) {
      setRedeemOk(true);
      setTimeout(onClose, 1400);
    } else {
      setRestoreError(activation.error ?? 'Could not activate the recovered key.');
    }
  };

  const formatKey = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12)].filter(Boolean);
    return parts.join('-');
  };

  const switchToRedeem = () => {
    setTab('redeem');
    setRestoreMode(false);
    setRedeemError('');
    setRestoreError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (backdropReady.current && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl overflow-hidden"
        style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 100%)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="text-4xl mb-2">⚾</div>
          <h2 className="text-white font-black text-xl">Go Pro</h2>
          <p className="text-white/50 text-sm mt-1">
            One-time purchase · Yours forever
          </p>
          <div className="mt-3 inline-flex items-baseline gap-1">
            <span className="text-white font-black text-3xl">$2.99</span>
            <span className="text-white/40 text-sm">once</span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-left max-w-[220px] mx-auto">
            {[
              '5, 7 & 9-inning games',
              '5-second ads (free = 15s)',
              'Unlimited extra innings',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[13px] text-white/75">
                <span className="text-green-400 text-base leading-none">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Tabs */}
        <div className="mx-5 mb-3 flex rounded-xl overflow-hidden border border-white/15">
          {(['buy', 'redeem'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setRestoreMode(false); setRedeemError(''); setRestoreError(''); }}
              className="flex-1 py-2 text-[13px] font-bold transition-all"
              style={{
                background: tab === t ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.04)',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t === 'buy' ? 'Buy $2.99' : 'I have a key'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-6 flex flex-col gap-3">
          {tab === 'buy' && (
            <>
              <p className="text-[12px] text-white/40 text-center -mt-1">
                Your license key will appear on screen after purchase — save it somewhere safe.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-[16px] text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuy(); }}
              />
              {buyError && <p className="text-red-400 text-[12px] -mt-1">{buyError}</p>}
              <button
                onClick={handleBuy}
                disabled={buying}
                className="w-full py-3.5 rounded-xl font-black text-[15px] text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}
              >
                {buying ? 'Redirecting…' : 'Buy for $2.99 →'}
              </button>
            </>
          )}

          {tab === 'redeem' && (
            <>
              {redeemOk ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-green-400 font-black text-lg">Pro unlocked!</p>
                </div>
              ) : restoreMode ? (
                <>
                  <p className="text-[12px] text-white/40 text-center -mt-1">
                    Enter the email you used when you paid — we'll look up your key automatically.
                  </p>
                  <input
                    type="email"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    className="w-full rounded-xl px-4 py-3 text-[16px] text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRestore(); }}
                  />
                  {restoreError && <p className="text-red-400 text-[12px] -mt-1 text-center">{restoreError}</p>}
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="w-full py-3.5 rounded-xl font-black text-[15px] text-white transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}
                  >
                    {restoring ? 'Looking up…' : 'Restore Pro Access →'}
                  </button>
                  <button
                    onClick={() => { setRestoreMode(false); setRestoreError(''); }}
                    className="text-white/30 text-[12px] text-center py-1"
                  >
                    ← I have my key
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-white/40 text-center -mt-1">
                    Enter the license key from your purchase.
                  </p>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(formatKey(e.target.value))}
                    placeholder="XXXX-XXXX-XXXX"
                    autoFocus
                    maxLength={14}
                    autoCapitalize="characters"
                    className="w-full rounded-xl px-4 py-3 text-[18px] font-black text-white tracking-[0.2em] placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors text-center"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
                  />
                  {redeemError && <p className="text-red-400 text-[12px] -mt-1 text-center">{redeemError}</p>}
                  <button
                    onClick={handleRedeem}
                    disabled={redeeming || key.trim().length < 10}
                    className="w-full py-3.5 rounded-xl font-black text-[15px] text-white transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}
                  >
                    {redeeming ? 'Verifying…' : 'Activate License'}
                  </button>
                  <button
                    onClick={() => { setRestoreMode(true); setRedeemError(''); }}
                    className="text-white/40 text-[12px] text-center py-1 hover:text-white/60 transition-colors"
                  >
                    Don't have your key? Restore by email →
                  </button>
                </>
              )}
            </>
          )}

          {!redeemOk && (
            <button
              onClick={onClose}
              className="text-white/30 text-[12px] text-center py-1"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

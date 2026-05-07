import { useState } from 'react';
import { unlockAudio, playStartCheer } from '@/lib/audio';

interface SetupProps {
  onStart: (awayName: string, homeName: string) => void;
}

export function Setup({ onStart }: SetupProps) {
  const [awayName, setAwayName] = useState('');
  const [homeName, setHomeName] = useState('');

  const handleStart = () => {
    unlockAudio();
    playStartCheer();
    onStart(
      awayName.trim() || 'Away',
      homeName.trim() || 'Home',
    );
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Logo / title */}
        <div className="text-center">
          <div className="text-6xl mb-3">⚾</div>
          <h1 className="text-3xl font-black text-white tracking-wide">1,2,3,4 Baseball</h1>
          <p className="text-white/50 text-sm mt-1">Two-player · pass the phone</p>
        </div>

        {/* Team name inputs */}
        <div
          className="rounded-2xl border border-white/15 p-5 flex flex-col gap-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <p className="text-white/60 text-[12px] uppercase tracking-widest font-semibold text-center">
            Enter Team Names
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wide pl-1">
              Away Team
            </label>
            <input
              type="text"
              value={awayName}
              onChange={e => setAwayName(e.target.value)}
              placeholder="Away"
              maxLength={16}
              className="w-full rounded-xl px-4 py-3 text-[16px] font-semibold text-white placeholder-white/25 outline-none border border-white/20 focus:border-blue-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-white/45 font-semibold uppercase tracking-wide pl-1">
              Home Team
            </label>
            <input
              type="text"
              value={homeName}
              onChange={e => setHomeName(e.target.value)}
              placeholder="Home"
              maxLength={16}
              className="w-full rounded-xl px-4 py-3 text-[16px] font-semibold text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
            />
          </div>
        </div>

        {/* How to play */}
        <div
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-2">How to Play</p>
          <ul className="text-[13px] text-white/55 flex flex-col gap-1.5 list-none">
            <li>⚾ Pitcher secretly picks a number 1–4</li>
            <li>📱 Hand device to the batter</li>
            <li>🏏 Batter guesses the same number</li>
            <li>✅ Match = 1 Single · 2 Double · 3 Triple · 4 HR</li>
            <li>❌ No match = Out · 3 outs = change sides</li>
          </ul>
        </div>

        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-[18px] text-white tracking-wide transition-all active:scale-95 shadow-lg"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.35)' }}
        >
          Play Ball!
        </button>
      </div>
    </div>
  );
}

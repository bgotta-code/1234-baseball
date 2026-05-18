import { useState } from 'react';
import { unlockAudio, playStartCheer } from '@/lib/audio';

interface SetupProps {
  isPaid: boolean;
  onStart: (awayName: string, homeName: string, innings: number) => void;
  onCreateOnline: (awayName: string, homeName: string, innings: number) => void;
  onJoinOnline: (code: string, teamName: string) => void;
}

const INNING_OPTIONS = [3, 5, 7, 9];

export function Setup({ isPaid, onStart, onCreateOnline, onJoinOnline }: SetupProps) {
  const [awayName, setAwayName] = useState('');
  const [homeName, setHomeName] = useState('');
  const [innings, setInnings] = useState(3);
  const [onlinePanel, setOnlinePanel] = useState<'closed' | 'join'>('closed');
  const [joinCode, setJoinCode] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');

  const away = awayName.trim() || 'Away';
  const home = homeName.trim() || 'Home';

  const handleStart = () => {
    unlockAudio();
    playStartCheer();
    onStart(away, home, innings);
  };

  const handleCreateOnline = () => {
    unlockAudio();
    onCreateOnline(away, home, innings);
  };

  const handleJoin = () => {
    if (joinCode.trim().length < 4) return;
    unlockAudio();
    onJoinOnline(joinCode.trim(), joinTeamName.trim() || 'Home');
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

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
          <p className="text-white/50 text-sm mt-1">Two-player · online multiplayer</p>
        </div>

        {/* Team name inputs */}
        <div
          className="rounded-2xl border border-white/15 p-5 flex flex-col gap-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <p className="text-white/60 text-[12px] uppercase tracking-widest font-semibold text-center">
            Team Names
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

        {/* Inning selector */}
        <div
          className="rounded-2xl border border-white/15 p-4 flex flex-col gap-3"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <p className="text-white/60 text-[12px] uppercase tracking-widest font-semibold text-center">
            Game Length
          </p>
          <div className="grid grid-cols-4 gap-2">
            {INNING_OPTIONS.map(n => {
              const locked = !isPaid && n > 3;
              const selected = innings === n;
              return (
                <button
                  key={n}
                  onClick={() => { if (!locked) setInnings(n); }}
                  disabled={locked}
                  className={`relative flex flex-col items-center justify-center py-3 rounded-xl border font-black text-[18px] transition-all ${
                    locked
                      ? 'border-white/10 text-white/20 cursor-not-allowed'
                      : selected
                        ? 'border-green-500/60 text-white'
                        : 'border-white/20 text-white/60 active:scale-95'
                  }`}
                  style={{
                    background: locked
                      ? 'rgba(255,255,255,0.03)'
                      : selected
                        ? 'linear-gradient(135deg,rgba(22,163,74,0.35),rgba(21,128,61,0.35))'
                        : 'rgba(255,255,255,0.06)',
                    boxShadow: selected ? '0 0 12px rgba(22,163,74,0.25)' : 'none',
                  }}
                >
                  {n}
                  <span className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${
                    locked ? 'text-white/20' : selected ? 'text-green-400' : 'text-white/35'
                  }`}>
                    {`inning${n > 1 ? 's' : ''}`}
                  </span>
                  {locked && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] opacity-40">🔒</span>
                  )}
                </button>
              );
            })}
          </div>
          {!isPaid && (
            <p className="text-[10px] text-white/30 text-center">
              Upgrade to Pro for 5, 7 and 9-inning games.<br />Shorter ads and unlimited extra innings.
            </p>
          )}
        </div>

        {/* How to play */}
        <div
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-2">How to Play</p>
          <ul className="text-[13px] text-white/55 flex flex-col gap-1.5 list-none">
            <li>🎯 Pitcher selects a number 1–4 on their device</li>
            <li>🏏 Batter guesses on a separate device — can't see pitcher's pick</li>
            <li>✅ Match = 1 Single · 2 Double · 3 Triple · 4 HR</li>
            <li>❌ No match = Out</li>
            <li>🔄 3 outs = change sides</li>
          </ul>
        </div>

        {/* Solo button */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-[18px] text-white tracking-wide transition-all active:scale-95 shadow-lg"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.35)' }}
        >
          Play Ball!
        </button>

        {/* Online section */}
        <div className="rounded-2xl border border-white/15 overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold text-center">
              🌐 Play Online
            </p>

            {/* Online instructions */}
            <div
              className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-0.5">How to Start</p>
              <ol className="text-[12px] text-white/50 flex flex-col gap-1 list-none">
                <li><span className="text-white/30 font-bold mr-1">1.</span>Enter your team name above</li>
                <li><span className="text-white/30 font-bold mr-1">2.</span>Tap <span className="text-blue-400/80">Create Game</span> to get a room code</li>
                <li><span className="text-white/30 font-bold mr-1">3.</span>Text or email the code + this link to your opponent:<br />
                  <span className="text-white/40 break-all">{appUrl}</span>
                </li>
                <li><span className="text-white/30 font-bold mr-1">4.</span>They open the link, enter your code, and tap <span className="text-amber-400/80">Join Game</span></li>
                <li><span className="text-white/30 font-bold mr-1">5.</span>Game starts automatically — no download required</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateOnline}
                className="flex-1 py-3 rounded-xl font-bold text-[14px] text-white border border-blue-500/40 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.4),rgba(29,78,216,0.4))' }}
              >
                Create Game
              </button>
              <button
                onClick={() => setOnlinePanel(p => p === 'join' ? 'closed' : 'join')}
                className={`flex-1 py-3 rounded-xl font-bold text-[14px] transition-all active:scale-95 border ${
                  onlinePanel === 'join'
                    ? 'border-amber-500/50 text-amber-300'
                    : 'border-white/20 text-white/60'
                }`}
                style={{ background: onlinePanel === 'join' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)' }}
              >
                Join Game
              </button>
            </div>

            {onlinePanel === 'join' && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={joinTeamName}
                  onChange={e => setJoinTeamName(e.target.value)}
                  placeholder="Your team name"
                  maxLength={16}
                  className="w-full rounded-xl px-4 py-3 text-[16px] font-semibold text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="Room code"
                    maxLength={6}
                    className="flex-1 rounded-xl px-4 py-3 text-[16px] font-bold text-white placeholder-white/25 outline-none border border-white/20 focus:border-amber-400 transition-colors tracking-widest uppercase"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                  />
                  <button
                    onClick={handleJoin}
                    disabled={joinCode.trim().length < 4}
                    className={`px-5 py-3 rounded-xl font-bold text-[14px] transition-all border ${
                      joinCode.trim().length >= 4
                        ? 'border-transparent text-white active:scale-95'
                        : 'border-white/10 text-white/25 cursor-not-allowed'
                    }`}
                    style={{
                      background: joinCode.trim().length >= 4
                        ? 'linear-gradient(135deg,#d97706,#b45309)'
                        : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    Join
                  </button>
                </div>
              </div>
            )}

            <p className="text-[10px] text-white/25 text-center">
              Host = Away team · Opponent picks their own team name when joining
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

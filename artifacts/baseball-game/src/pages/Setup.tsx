import { useState } from 'react';
import { unlockAudio } from '@/lib/audio';

interface SetupProps {
  isPaid: boolean;
  onStart: (awayName: string, homeName: string, innings: number) => void;
  onCreateOnline: (hostName: string, innings: number, hostRole: 'home' | 'away') => void;
  onJoinOnline: (code: string, teamName: string) => void;
}

const INNING_OPTIONS = [3, 5, 7, 9] as const;

export function Setup({ isPaid, onStart, onCreateOnline, onJoinOnline }: SetupProps) {
  const [panel, setPanel] = useState<'closed' | 'create' | 'join'>('closed');

  // Create game state
  const [createName, setCreateName] = useState('');
  const [hostRole, setHostRole] = useState<'away' | 'home'>('away');
  const [innings, setInnings] = useState(3);

  // Join game state
  const [joinTeamName, setJoinTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCreateRoom = () => {
    unlockAudio();
    onCreateOnline(createName.trim() || 'Away', innings, hostRole);
  };

  const handleJoin = () => {
    if (joinCode.trim().length < 4) return;
    unlockAudio();
    onJoinOnline(joinCode.trim(), joinTeamName.trim() || 'Home');
  };

  const bg = 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)';

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Logo */}
        <div className="text-center">
          <div className="text-6xl mb-3">⚾</div>
          <h1 className="text-3xl font-black text-white tracking-wide">1,2,3,4 Baseball</h1>
          <p className="text-white/50 text-sm mt-1">Two-player · online multiplayer</p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-white/15 overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="p-4 flex flex-col gap-3">

            {/* Instructions */}
            <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-0.5">How to Start</p>
              <ol className="text-[12px] text-white/55 flex flex-col gap-1.5 list-none">
                <li><span className="text-white/30 font-bold mr-1.5">1.</span>Tap <span className="text-green-400/90 font-semibold">Play Ball</span> and enter your team name</li>
                <li><span className="text-white/30 font-bold mr-1.5">2.</span>Choose Home or Away and game length</li>
                <li><span className="text-white/30 font-bold mr-1.5">3.</span>Text or email the link + stadium passcode to your opponent</li>
                <li><span className="text-white/30 font-bold mr-1.5">4.</span>They open the link, enter their name and your code, and tap <span className="text-amber-400/80 font-semibold">Join Game</span></li>
                <li><span className="text-white/30 font-bold mr-1.5">5.</span>Game starts automatically — no download required</li>
              </ol>
            </div>

            {/* Primary buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setPanel(p => p === 'create' ? 'closed' : 'create')}
                className={`flex-1 py-3.5 rounded-xl font-black text-[15px] transition-all active:scale-95 border ${
                  panel === 'create'
                    ? 'border-green-500/60 text-white'
                    : 'border-transparent text-white'
                }`}
                style={{
                  background: panel === 'create'
                    ? 'linear-gradient(135deg,rgba(22,163,74,0.5),rgba(21,128,61,0.5))'
                    : 'linear-gradient(135deg,#16a34a,#15803d)',
                  boxShadow: panel === 'create' ? 'none' : '0 4px 20px rgba(22,163,74,0.35)',
                }}
              >
                Play Ball
              </button>
              <button
                onClick={() => setPanel(p => p === 'join' ? 'closed' : 'join')}
                className={`flex-1 py-3.5 rounded-xl font-bold text-[14px] transition-all active:scale-95 border ${
                  panel === 'join'
                    ? 'border-amber-500/50 text-amber-300'
                    : 'border-white/20 text-white/60'
                }`}
                style={{ background: panel === 'join' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)' }}
              >
                Join Game
              </button>
            </div>

            {/* ── Create panel ─────────────────────────────────── */}
            {panel === 'create' && (
              <div className="flex flex-col gap-3 pt-1 border-t border-white/10">

                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="Your team name"
                  maxLength={16}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-[16px] font-semibold text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />

                {/* Home / Away toggle */}
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-1.5 pl-1">I am the…</p>
                  <div className="flex rounded-xl overflow-hidden border border-white/20">
                    {(['away', 'home'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setHostRole(r)}
                        className="flex-1 py-2.5 font-bold text-[13px] transition-all"
                        style={{
                          background: hostRole === r
                            ? r === 'away'
                              ? 'rgba(37,99,235,0.5)'
                              : 'rgba(234,88,12,0.5)'
                            : 'rgba(255,255,255,0.04)',
                          color: hostRole === r ? '#fff' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {r === 'away' ? '✈️ Away team' : '🏠 Home team'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/25 pl-1 mt-1">
                    {hostRole === 'away' ? 'Away bats first · Home bats last' : 'Home bats last · Away bats first'}
                  </p>
                </div>

                {/* Innings */}
                <div>
                  <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-1.5 pl-1">Game length</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {INNING_OPTIONS.map(n => {
                      const locked = !isPaid && n > 3;
                      const selected = innings === n;
                      return (
                        <button
                          key={n}
                          onClick={() => { if (!locked) setInnings(n); }}
                          disabled={locked}
                          className={`relative flex flex-col items-center justify-center py-2.5 rounded-xl border font-black text-[16px] transition-all ${
                            locked
                              ? 'border-white/10 text-white/20 cursor-not-allowed'
                              : selected
                                ? 'border-green-500/60 text-white'
                                : 'border-white/20 text-white/50 active:scale-95'
                          }`}
                          style={{
                            background: locked
                              ? 'rgba(255,255,255,0.03)'
                              : selected
                                ? 'linear-gradient(135deg,rgba(22,163,74,0.35),rgba(21,128,61,0.35))'
                                : 'rgba(255,255,255,0.06)',
                          }}
                        >
                          {n}
                          <span className={`text-[8px] font-bold uppercase tracking-wide mt-0.5 ${
                            locked ? 'text-white/20' : selected ? 'text-green-400' : 'text-white/30'
                          }`}>inn</span>
                          {locked && <span className="absolute top-1 right-1 text-[8px] opacity-40">🔒</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 rounded-xl font-black text-[16px] text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}
                >
                  Enter Stadium →
                </button>
              </div>
            )}

            {/* ── Join panel ───────────────────────────────────── */}
            {panel === 'join' && (
              <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                <input
                  type="text"
                  value={joinTeamName}
                  onChange={e => setJoinTeamName(e.target.value)}
                  placeholder="Your team name"
                  maxLength={16}
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-[16px] font-semibold text-white placeholder-white/25 outline-none border border-white/20 focus:border-green-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="Stadium Passcode"
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

            <p className="text-[10px] text-white/20 text-center">
              {panel === 'join'
                ? 'Enter the stadium passcode your opponent shared with you'
                : 'Creator shares code · Opponent picks their own team name'}
            </p>
          </div>
        </div>

        {/* Solo play */}
        <button
          onClick={() => { unlockAudio(); onStart('Away', 'Home', 3); }}
          className="text-white/25 text-[12px] text-center underline underline-offset-2 py-1"
        >
          Play solo (pass-the-phone)
        </button>

      </div>
    </div>
  );
}

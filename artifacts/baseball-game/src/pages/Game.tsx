import { useState, useEffect, useRef, useCallback } from 'react';
import { Stadium } from '@/components/Stadium';
import { LineScore } from '@/components/LineScore';
import {
  unlockAudio,
  playSwoosh,
  playHitSound,
  playOutSound,
  isMuted,
  toggleMute,
} from '@/lib/audio';
import {
  initState,
  resolveAtBat,
  nextHalf,
  INNINGS,
  GameState,
} from '@/lib/gameLogic';

interface GameProps {
  awayTeam: string;
  homeTeam: string;
  onNewGame: () => void;
}

type Screen = 'game' | 'ad' | 'gameover';
type ResultInfo = { message: string; type: 'hit' | 'out' | 'side-retired' } | null;
type RevealInfo = { pitcherNum: number } | null;

export function Game({ awayTeam, homeTeam, onNewGame }: GameProps) {
  const [state, setState] = useState<GameState>(initState);
  const [screen, setScreen] = useState<Screen>('game');
  const [result, setResult] = useState<ResultInfo>(null);
  const [reveal, setReveal] = useState<RevealInfo>(null);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [adCountdown, setAdCountdown] = useState(15);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postAdCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener('touchstart', handler, false);
    document.addEventListener('touchend', handler, false);
    document.addEventListener('click', handler, false);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('touchend', handler);
      document.removeEventListener('click', handler);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  const showReveal = useCallback((pitcherNum: number) => {
    setReveal({ pitcherNum });
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setReveal(null), 2500);
  }, []);

  const startAd = useCallback((callback: () => void) => {
    postAdCallback.current = callback;
    setAdCountdown(15);
    setScreen('ad');
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    let count = 15;
    adTimerRef.current = setInterval(() => {
      count--;
      setAdCountdown(count);
      if (count <= 0) {
        if (adTimerRef.current) clearInterval(adTimerRef.current);
        setScreen('game');
        postAdCallback.current?.();
      }
    }, 1000);
  }, []);

  const handleSelectNumber = (n: number) => {
    unlockAudio();
    setSelectedNum(n);
    if (state.phase === 'pitch') {
      setState(s => ({ ...s, pitcherChoice: n }));
    } else {
      setState(s => ({ ...s, batterChoice: n }));
    }
  };

  const handleSubmit = () => {
    if (selectedNum === null) return;
    setSelectedNum(null);

    if (state.phase === 'pitch') {
      playSwoosh();
      setState(s => ({ ...s, phase: 'swing' }));
      setResult(null);
    } else {
      const atBatResult = resolveAtBat(state);

      if (atBatResult.type === 'hit') {
        playHitSound(atBatResult.hitDist!);
        setResult({ message: atBatResult.message, type: 'hit' });
        setState(atBatResult.newState);
      } else if (atBatResult.type === 'out') {
        playOutSound(state.half);
        showReveal(state.pitcherChoice!);
        setResult({ message: 'Out', type: 'out' });
        setState(atBatResult.newState);
      } else {
        playOutSound(state.half);
        showReveal(state.pitcherChoice!);
        setResult({ message: 'Out — side retired', type: 'out' });
        setState(atBatResult.newState);
        setTimeout(() => {
          startAd(() => {
            const { newState, gameOver } = nextHalf(atBatResult.newState);
            if (gameOver) {
              setState(newState);
              setScreen('gameover');
            } else {
              setState(newState);
              setResult(null);
              setReveal(null);
            }
          });
        }, 2500);
      }
    }
  };

  const isPitchPhase = state.phase === 'pitch';
  const battingTeamIdx = state.half as 0 | 1;
  const battingTeamName = state.half === 0 ? awayTeam : homeTeam;
  const submitLabel = isPitchPhase ? 'Pitch' : 'Swing!';
  const actionLabel = isPitchPhase
    ? `${battingTeamName} Pitcher — choose your pitch`
    : `${battingTeamName} Batter — guess the pitch`;
  const statusMsg = isPitchPhase
    ? `${battingTeamName} pitcher — choose your pitch`
    : '📱 Hand the device to the batter';

  const inningLabel = `Inning ${state.inning} — ${state.half === 0 ? 'Top' : 'Bottom'}`;

  // ── AD SCREEN ────────────────────────────────────────────────
  if (screen === 'ad') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg,#0a2a0a 0%,#1a4a1a 100%)' }}>
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/20 p-6 text-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-4 font-semibold">Advertisement</p>
            <div className="rounded-xl h-28 flex items-center justify-center mb-5 border border-white/10"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-sm text-white/30">Your ad here</p>
            </div>
            <p className="text-sm text-white/55">
              Next inning in{' '}
              <span className="font-black text-white text-xl">{adCountdown}</span>
              {' '}seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── GAME OVER SCREEN ─────────────────────────────────────────
  if (screen === 'gameover') {
    const [away, home] = state.scores;
    const winner = away === home ? null : away > home ? 0 : 1;
    const title = away === home
      ? "It's a Tie!"
      : `${winner === 0 ? awayTeam : homeTeam} Wins!`;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg,#0a2a0a 0%,#1a4a1a 100%)' }}>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center">
            <div className="text-5xl mb-3">⚾</div>
            <h2 className="text-2xl font-black text-white">{title}</h2>
            <p className="text-white/40 text-sm mt-1">Final · {INNINGS} innings</p>
          </div>

          <div className="flex gap-3">
            {[awayTeam, homeTeam].map((team, i) => (
              <div key={team} className={`flex-1 rounded-2xl p-4 text-center border ${
                winner === i
                  ? 'border-yellow-400/50'
                  : 'border-white/15'
              }`}
                style={{ background: winner === i ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.35)' }}>
                <div className="text-[10px] text-white/45 font-bold uppercase tracking-widest mb-1 truncate">
                  {team}
                </div>
                <div className={`text-5xl font-black ${winner === i ? 'text-yellow-300' : 'text-white'}`}>
                  {state.scores[i]}
                </div>
                {winner === i && (
                  <div className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Winner ✓
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Linescore */}
          <div className="rounded-2xl border border-white/15 p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">Box Score</p>
            <LineScore
              lineScore={state.lineScore}
              scores={state.scores}
              currentInning={state.inning}
              currentHalf={state.half}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onNewGame}
              className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white/70 border border-white/20 active:opacity-70"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              Change Teams
            </button>
            <button
              onClick={() => {
                setState(initState());
                setScreen('game');
                setResult(null);
                setReveal(null);
                setSelectedNum(null);
              }}
              className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN GAME SCREEN ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex justify-center py-3 px-3"
      style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)' }}>
      <div className="w-full max-w-sm flex flex-col gap-2.5">

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="w-9" />
          <div className="flex items-center gap-2">
            <span className="text-base">⚾</span>
            <h1 className="text-[16px] font-black text-white tracking-wide">1,2,3,4 Baseball</h1>
          </div>
          <button
            onClick={() => { setMuted(toggleMute()); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/15 transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.07)', fontSize: 18 }}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Score strip */}
        <div className="grid grid-cols-3 items-center gap-0 rounded-2xl overflow-hidden border border-white/15"
          style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="text-center py-3 px-2">
            <div className="text-[9px] text-white/45 font-bold uppercase tracking-widest mb-0.5 truncate px-1">
              {awayTeam}
            </div>
            <div className={`text-[38px] font-black leading-none ${state.half === 0 ? 'text-white' : 'text-white/60'}`}>
              {state.scores[0]}
            </div>
            {state.half === 0 && (
              <div className="text-[8px] text-orange-400 font-bold uppercase mt-0.5">batting</div>
            )}
          </div>
          <div className="text-center py-2 border-x border-white/10">
            <div className="text-[10px] text-white/55 font-semibold leading-snug">{inningLabel}</div>
            <div className="flex justify-center gap-1.5 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full border-[1.5px] transition-all duration-200 ${
                  state.outs > i ? 'bg-red-400 border-red-600' : 'bg-transparent border-white/35'
                }`} />
              ))}
            </div>
          </div>
          <div className="text-center py-3 px-2">
            <div className="text-[9px] text-white/45 font-bold uppercase tracking-widest mb-0.5 truncate px-1">
              {homeTeam}
            </div>
            <div className={`text-[38px] font-black leading-none ${state.half === 1 ? 'text-white' : 'text-white/60'}`}>
              {state.scores[1]}
            </div>
            {state.half === 1 && (
              <div className="text-[8px] text-orange-400 font-bold uppercase mt-0.5">batting</div>
            )}
          </div>
        </div>

        {/* Stadium */}
        <div className="rounded-2xl overflow-hidden border border-white/15"
          style={{ background: 'rgba(0,0,0,0.15)' }}>
          <Stadium
            bases={state.bases}
            phase={state.phase}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            battingTeam={battingTeamIdx}
          />
        </div>

        {/* Linescore */}
        <div className="rounded-2xl border border-white/15 px-3 py-2.5"
          style={{ background: 'rgba(0,0,0,0.38)' }}>
          <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-1.5">Linescore</p>
          <LineScore
            lineScore={state.lineScore}
            scores={state.scores}
            currentInning={state.inning}
            currentHalf={state.half}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
          />
        </div>

        {/* Result / reveal */}
        {result && (
          <div className={`rounded-xl px-4 py-2.5 text-center text-[15px] font-black border ${
            result.type === 'hit'
              ? 'border-green-500/40 text-green-300'
              : 'border-red-500/40 text-red-300'
          }`}
            style={{ background: result.type === 'hit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
            {result.message}
          </div>
        )}
        {reveal && (
          <div className="rounded-xl px-4 py-2 text-center text-[13px] font-bold text-amber-300 border border-amber-400/35"
            style={{ background: 'rgba(251,191,36,0.12)' }}>
            Pitcher threw a {reveal.pitcherNum}
          </div>
        )}

        {/* Status */}
        <p className="text-[11px] text-white/40 text-center min-h-[15px]">{statusMsg}</p>

        {/* Action panel */}
        <div className="rounded-2xl border border-white/15 p-3.5"
          style={{ background: 'rgba(0,0,0,0.42)' }}>
          <p className="text-[10px] text-white/45 mb-2.5 font-bold uppercase tracking-wide">{actionLabel}</p>

          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => handleSelectNumber(n)}
                className={`h-14 rounded-xl font-black text-2xl transition-all active:scale-90 border ${
                  selectedNum === n
                    ? 'border-blue-400 text-white shadow-lg'
                    : 'border-white/20 text-white/75 active:bg-white/15'
                }`}
                style={{
                  background: selectedNum === n
                    ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
                    : 'rgba(255,255,255,0.07)',
                  boxShadow: selectedNum === n ? '0 0 20px rgba(37,99,235,0.4)' : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={selectedNum === null}
            className={`w-full py-3.5 rounded-xl font-black text-[17px] transition-all border ${
              selectedNum !== null
                ? 'border-transparent text-white active:scale-95'
                : 'border-white/10 text-white/20 cursor-not-allowed'
            }`}
            style={{
              background: selectedNum !== null
                ? isPitchPhase
                  ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
                  : 'linear-gradient(135deg,#16a34a,#15803d)'
                : 'rgba(255,255,255,0.04)',
              boxShadow: selectedNum !== null
                ? isPitchPhase
                  ? '0 4px 20px rgba(37,99,235,0.3)'
                  : '0 4px 20px rgba(22,163,74,0.3)'
                : 'none',
            }}
          >
            {submitLabel}
          </button>
        </div>

        <p className="text-[9px] text-white/20 text-center pb-1">
          {INNINGS}-inning game · pass the phone between pitcher and batter
        </p>
      </div>
    </div>
  );
}

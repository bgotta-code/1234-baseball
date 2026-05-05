import { useState, useEffect, useRef, useCallback } from 'react';
import { Stadium } from '@/components/Stadium';
import { LineScore } from '@/components/LineScore';
import {
  unlockAudio,
  playSwoosh,
  playHitSound,
  playOutSound,
} from '@/lib/audio';
import {
  initState,
  resolveAtBat,
  nextHalf,
  INNINGS,
  GameState,
} from '@/lib/gameLogic';

type Screen = 'game' | 'ad' | 'gameover';
type ResultInfo = { message: string; type: 'hit' | 'out' | 'side-retired' } | null;
type RevealInfo = { pitcherNum: number } | null;

export function Game() {
  const [state, setState] = useState<GameState>(initState);
  const [screen, setScreen] = useState<Screen>('game');
  const [result, setResult] = useState<ResultInfo>(null);
  const [reveal, setReveal] = useState<RevealInfo>(null);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
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

  const handleRestart = () => {
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setState(initState());
    setScreen('game');
    setResult(null);
    setReveal(null);
    setSelectedNum(null);
  };

  const isPitchPhase = state.phase === 'pitch';
  const teamLabel = state.half === 0 ? 'Away' : 'Home';
  const submitLabel = isPitchPhase ? 'Pitch' : 'Swing!';
  const actionLabel = isPitchPhase
    ? `${teamLabel} Pitcher — choose your pitch`
    : 'Batter — guess the pitch number';
  const statusMsg = isPitchPhase
    ? `${teamLabel} pitcher — choose your pitch`
    : '📱 Hand the device to the batter';

  const inningLabel = `Inning ${state.inning} — ${state.half === 0 ? 'Top' : 'Bottom'}`;

  // ── AD SCREEN ──────────────────────────────────────────────────
  if (screen === 'ad') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg,#0a2a0a 0%,#1a4a1a 100%)' }}>
        <div className="w-full max-w-sm">
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 text-center">
            <p className="text-[10px] text-white/50 uppercase tracking-widest mb-4 font-medium">Advertisement</p>
            <div className="bg-white/10 border border-white/15 rounded-xl h-28 flex items-center justify-center mb-5">
              <p className="text-sm text-white/40">Your ad here</p>
            </div>
            <p className="text-sm text-white/60">
              Next inning in{' '}
              <span className="font-bold text-white text-lg">{adCountdown}</span>
              {' '}seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── GAME OVER SCREEN ───────────────────────────────────────────
  if (screen === 'gameover') {
    const [away, home] = state.scores;
    const title = away === home ? 'Tie Game!' : away > home ? 'Away Wins!' : 'Home Wins!';
    const winner = away === home ? null : away > home ? 0 : 1;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg,#0a2a0a 0%,#1a4a1a 100%)' }}>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center">
            <div className="text-5xl mb-3">⚾</div>
            <h2 className="text-3xl font-bold text-white">{title}</h2>
            <p className="text-white/50 text-sm mt-1">Final</p>
          </div>

          <div className="flex gap-3">
            {(['Away', 'Home'] as const).map((team, i) => (
              <div key={team} className={`flex-1 rounded-2xl p-5 text-center border ${
                winner === i
                  ? 'bg-yellow-400/20 border-yellow-400/50'
                  : 'bg-white/8 border-white/15'
              }`}>
                <div className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-1">{team}</div>
                <div className={`text-5xl font-bold ${winner === i ? 'text-yellow-300' : 'text-white'}`}>
                  {state.scores[i]}
                </div>
                {winner === i && <div className="text-yellow-300 text-xs mt-1 font-semibold">WINNER</div>}
              </div>
            ))}
          </div>

          {/* Final linescore */}
          <div className="bg-white/8 rounded-2xl border border-white/15 p-4">
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-3 font-medium">Box Score</p>
            <div className="text-white">
              <LineScore
                lineScore={state.lineScore}
                scores={state.scores}
                currentInning={state.inning}
                currentHalf={state.half}
              />
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="w-full py-4 rounded-2xl font-bold text-[16px] transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#2ecc71,#27ae60)' }}
          >
            New Game
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN GAME SCREEN ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex justify-center py-3 px-3"
      style={{ background: 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)' }}>
      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-lg">⚾</span>
          <h1 className="text-[17px] font-bold text-white tracking-wide">1,2,3,4 Baseball</h1>
        </div>

        {/* Score strip */}
        <div className="grid grid-cols-3 items-center gap-1 rounded-2xl overflow-hidden border border-white/15"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="text-center py-3 px-2">
            <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest mb-0.5">Away</div>
            <div className="text-[36px] font-black text-white leading-none">{state.scores[0]}</div>
          </div>
          <div className="text-center py-2">
            <div className="text-[11px] text-white/60 font-medium leading-tight">{inningLabel}</div>
            <div className="flex justify-center gap-1.5 mt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-3 h-3 rounded-full border-[1.5px] transition-all duration-200 ${
                  state.outs > i ? 'bg-red-400 border-red-600' : 'bg-transparent border-white/40'
                }`} />
              ))}
            </div>
          </div>
          <div className="text-center py-3 px-2">
            <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest mb-0.5">Home</div>
            <div className="text-[36px] font-black text-white leading-none">{state.scores[1]}</div>
          </div>
        </div>

        {/* Stadium field */}
        <div className="rounded-2xl overflow-hidden border border-white/15" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <Stadium bases={state.bases} phase={state.phase} />
        </div>

        {/* Linescore */}
        <div className="rounded-2xl border border-white/15 px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium mb-1.5">Linescore</p>
          <div className="text-white/90">
            <LineScore
              lineScore={state.lineScore}
              scores={state.scores}
              currentInning={state.inning}
              currentHalf={state.half}
            />
          </div>
        </div>

        {/* Result / reveal banners */}
        {result && (
          <div className={`rounded-xl px-4 py-2.5 text-center text-[15px] font-bold border ${
            result.type === 'hit'
              ? 'bg-green-500/20 text-green-300 border-green-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
          }`}>
            {result.message}
          </div>
        )}
        {reveal && (
          <div className="rounded-xl px-4 py-2 text-center text-[13px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/35">
            Pitcher threw a {reveal.pitcherNum}
          </div>
        )}

        {/* Status hint */}
        <p className="text-[12px] text-white/45 text-center min-h-[16px]">{statusMsg}</p>

        {/* Action panel */}
        <div className="rounded-2xl border border-white/15 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <p className="text-[12px] text-white/50 mb-3 font-semibold uppercase tracking-wide">{actionLabel}</p>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => handleSelectNumber(n)}
                className={`h-14 rounded-xl font-black text-2xl transition-all active:scale-90 border ${
                  selectedNum === n
                    ? 'bg-blue-500 border-blue-300 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/8 border-white/20 text-white/80 hover:bg-white/15'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={selectedNum === null}
            className={`w-full py-3.5 rounded-xl font-bold text-[17px] transition-all border ${
              selectedNum !== null
                ? isPitchPhase
                  ? 'bg-blue-600 border-blue-400 text-white active:scale-95 shadow-lg shadow-blue-600/30'
                  : 'bg-green-600 border-green-400 text-white active:scale-95 shadow-lg shadow-green-600/30'
                : 'bg-white/5 border-white/10 text-white/25 cursor-not-allowed'
            }`}
          >
            {submitLabel}
          </button>
        </div>

        <p className="text-[10px] text-white/25 text-center pb-2">
          {INNINGS}-inning game · Pass the phone between pitcher and batter
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Stadium } from '@/components/Stadium';
import { LineScore } from '@/components/LineScore';
import {
  unlockAudio,
  playSwoosh,
  playHitSound,
  playOutSound,
  playScoreRipple,
  isMuted,
  toggleMute,
} from '@/lib/audio';
import {
  initState,
  resolveAtBat,
  nextHalf,
  GameState,
} from '@/lib/gameLogic';

interface GameProps {
  awayTeam: string;
  homeTeam: string;
  innings: number;
  isPaid: boolean;
  onNewGame: () => void;
}

type Screen = 'game' | 'ad' | 'gameover';
type ResultInfo = { message: string; type: 'hit' | 'out' | 'side-retired' } | null;
type RevealInfo = { pitcherNum: number } | null;

// Ball landing coordinates by hit distance (SVG viewBox 0 0 300 295)
const BALL_LANDINGS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 80, y: 140 }, { x: 150, y: 110 }, { x: 220, y: 140 }], // single – in front of LF/CF/RF
  2: [{ x: 30, y: 158 }, { x: 270, y: 158 }],                      // double – left/right corner
  3: [{ x: 112, y: 88 }, { x: 188, y: 88 }],                       // triple – LF-CF/RF-CF gap
  4: [{ x: 150, y: -8 }],                                            // HR – over the CF fence
};
function pickLanding(dist: number): { x: number; y: number } {
  const arr = BALL_LANDINGS[dist] ?? BALL_LANDINGS[1];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function Game({ awayTeam, homeTeam, innings, isPaid, onNewGame }: GameProps) {
  const [state, setState] = useState<GameState>(initState);
  const [screen, setScreen] = useState<Screen>('game');
  const [result, setResult] = useState<ResultInfo>(null);
  const [reveal, setReveal] = useState<RevealInfo>(null);
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [adCountdown, setAdCountdown] = useState(15);
  const [animRunners, setAnimRunners] = useState<Array<{ id: string; pos: number; maxPos: number }> | null>(null);
  const [homeFlashes, setHomeFlashes] = useState<Array<{ id: string; delay: number }>>([]);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postAdCallback = useRef<(() => void) | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ballTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runnerIdRef = useRef(0);

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
      animTimersRef.current.forEach(clearTimeout);
      ballTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Animate runners advancing base by base after a hit.
  // prevBases = bases state before the hit; dist = 1–4; twoOut = 2 outs were on the board
  const startRunnerAnimation = useCallback((
    prevBases: [boolean, boolean, boolean],
    dist: number,
    twoOut: boolean,
  ) => {
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    const nextId = () => String(++runnerIdRef.current);

    // With 2 outs, existing runners advance hitDist+1 bases (matching gameLogic).
    // Batter always advances exactly hitDist bases.
    // On HR everyone scores regardless — twoOut doesn't add extra steps.
    const runnerAdv = (twoOut && dist < 4) ? dist + 1 : dist;
    const batterAdv = dist; // batter always lands at hitDist-th base (or home on HR)
    const totalSteps = Math.max(runnerAdv, batterAdv); // usually runnerAdv ≥ batterAdv

    // Each runner knows their maxPos so we cap instead of filter mid-animation.
    // pos 4 = HOME (scored) — runner stays visible there until cleanT removes them.
    const initial: Array<{ id: string; pos: number; maxPos: number }> = [];
    if (prevBases[2]) initial.push({ id: nextId(), pos: 3, maxPos: 4 });
    if (prevBases[1]) initial.push({ id: nextId(), pos: 2, maxPos: 4 });
    if (prevBases[0]) initial.push({ id: nextId(), pos: 1, maxPos: 4 });
    initial.push({ id: nextId(), pos: 0, maxPos: batterAdv }); // batter caps at their base

    // How many runners will cross home plate on this hit?
    const scoringCount =
      (prevBases[2] && 3 + runnerAdv >= 4 ? 1 : 0) +
      (prevBases[1] && 2 + runnerAdv >= 4 ? 1 : 0) +
      (prevBases[0] && 1 + runnerAdv >= 4 ? 1 : 0) +
      (batterAdv >= 4 ? 1 : 0);

    setAnimRunners(initial);

    const STEP_MS = 500;

    for (let step = 1; step <= totalSteps; step++) {
      const t = setTimeout(() => {
        setAnimRunners(prev =>
          prev === null ? null :
          // Cap each runner at their individual maxPos — no mid-animation removal
          prev.map(r => ({ ...r, pos: Math.min(r.pos + 1, r.maxPos) }))
        );
      }, step * STEP_MS);
      animTimersRef.current.push(t);
    }

    // Remove scored runners (pos > 3) + fire flash + sound after CSS transition done
    const cleanT = setTimeout(() => {
      setAnimRunners(prev =>
        prev === null ? null : prev.filter(r => r.pos <= 3)
      );
      if (scoringCount > 0) {
        for (let i = 0; i < scoringCount; i++) {
          setTimeout(() => playScoreRipple(), i * 220);
        }
        const flashes = Array.from({ length: scoringCount }, (_, i) => ({
          id: `${Date.now()}-${i}`,
          delay: i * 220,
        }));
        setHomeFlashes(f => [...f, ...flashes]);
        setTimeout(() => {
          setHomeFlashes(f => f.filter(x => !flashes.some(n => n.id === x.id)));
        }, 1100);
      }
    }, totalSteps * STEP_MS + 460);
    animTimersRef.current.push(cleanT);

    // Hand back control to game state after animation fully completes
    const endT = setTimeout(() => setAnimRunners(null), (totalSteps + 0.7) * STEP_MS + 460);
    animTimersRef.current.push(endT);
  }, []);

  const showReveal = useCallback((pitcherNum: number) => {
    setReveal({ pitcherNum });
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setReveal(null), 2500);
  }, []);

  const startAd = useCallback((callback: () => void) => {
    const adDuration = isPaid ? 5 : 15;
    postAdCallback.current = callback;
    setAdCountdown(adDuration);
    setScreen('ad');
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    let count = adDuration;
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
        // Capture bases BEFORE state update so animation starts from correct positions
        const prevBases = [...state.bases] as [boolean, boolean, boolean];
        const dist = atBatResult.hitDist!;
        // Ball travel animation: start at batter, travel to landing spot
        ballTimersRef.current.forEach(clearTimeout);
        ballTimersRef.current = [];
        const landing = pickLanding(dist);
        setBallPos({ x: 160, y: 268 }); // batter contact point
        ballTimersRef.current.push(setTimeout(() => setBallPos(landing), 50));
        ballTimersRef.current.push(setTimeout(() => setBallPos(null), 800));
        startRunnerAnimation(prevBases, dist, state.outs === 2);
        playHitSound(dist, state.half);

        // Walk-off: bottom of last inning (or extra), home team takes the lead
        const ns = atBatResult.newState;
        const isWalkoff =
          state.half === 1 &&
          state.inning >= innings &&
          atBatResult.runs > 0 &&
          ns.scores[1] > ns.scores[0];

        if (isWalkoff) {
          setResult({ message: `Walk-off ${atBatResult.message}`, type: 'hit' });
          setState(ns);
          setTimeout(() => {
            const { newState } = nextHalf(ns, { innings, isPaid });
            setState(newState);
            setScreen('gameover');
          }, 4000);
        } else {
          setResult({ message: atBatResult.message, type: 'hit' });
          setState(ns);
        }
      } else if (atBatResult.type === 'out') {
        playOutSound(state.half);
        showReveal(state.pitcherChoice!);
        setResult({ message: `${state.outs + 1} Out${state.outs + 1 > 1 ? 's' : ''}`, type: 'out' });
        setState(atBatResult.newState);
      } else {
        playOutSound(state.half);
        showReveal(state.pitcherChoice!);
        const ns3 = atBatResult.newState;
        const isEndOfInning = state.half === 1 && state.inning >= innings;
        const isTied = ns3.scores[0] === ns3.scores[1];
        const sideRetiredMsg =
          isEndOfInning && isTied ? 'Extra Innings!' : '3 Outs — Side Retired';
        setResult({ message: sideRetiredMsg, type: 'out' });
        setState(ns3);
        setTimeout(() => {
          startAd(() => {
            const { newState, gameOver } = nextHalf(atBatResult.newState, { innings, isPaid });
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

  const isExtraInning = state.inning > innings;
  const inningLabel = isExtraInning
    ? `Extra Inning — ${state.half === 0 ? 'Top' : 'Bottom'}`
    : `Inning ${state.inning} — ${state.half === 0 ? 'Top' : 'Bottom'}`;

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
            <p className="text-white/40 text-sm mt-1">
              Final · {innings + state.extraInnings} innings
            </p>
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
              innings={innings}
              lineScore={state.lineScore}
              scores={state.scores}
              currentInning={state.inning}
              currentHalf={state.half}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
              isGameOver
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
            runners={animRunners ?? undefined}
            homeFlashes={homeFlashes}
            ball={ballPos ?? undefined}
          />
        </div>

        {/* Linescore */}
        <div className="rounded-2xl border border-white/15 px-3 py-2.5"
          style={{ background: 'rgba(0,0,0,0.38)' }}>
          <p className="text-[9px] text-white/35 uppercase tracking-widest font-bold mb-1.5">Linescore</p>
          <LineScore
            innings={innings}
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
          <p className={`text-[11px] mb-2.5 font-bold uppercase tracking-wide ${
          selectedNum === null ? 'text-white prompt-flash' : 'text-white/45'
        }`}>{actionLabel}</p>

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

        <div className="flex items-center justify-between pb-1 px-1">
          <p className="text-[9px] text-white/20">
            {innings}-inning game · pass the phone between pitcher and batter
          </p>
          {confirmAbandon ? (
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                className="text-[9px] text-white/35 underline"
                onClick={() => {
                  if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
                  setConfirmAbandon(false);
                }}
              >
                Cancel
              </button>
              <button
                className="text-[9px] text-red-400/70 font-bold underline"
                onClick={onNewGame}
              >
                Abandon?
              </button>
            </div>
          ) : (
            <button
              className="text-[9px] text-white/20 underline shrink-0 ml-2"
              onClick={() => {
                setConfirmAbandon(true);
                if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
                abandonTimerRef.current = setTimeout(() => setConfirmAbandon(false), 4000);
              }}
            >
              Abandon
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Diamond } from '@/components/Diamond';
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
        // side-retired
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
  const submitLabel = isPitchPhase ? 'Pitch' : 'Swing';
  const actionLabel = isPitchPhase
    ? `${teamLabel} Pitcher — choose your pitch`
    : 'Batter — guess the pitch';
  const statusMsg = isPitchPhase
    ? `${teamLabel} pitcher — choose your pitch`
    : 'Hand the device to the batter';

  const inningLabel = `Inning ${state.inning} — ${state.half === 0 ? 'Top' : 'Bottom'}`;

  if (screen === 'ad') {
    return (
      <div className="min-h-screen bg-[hsl(40,20%,96%)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-[hsl(35,12%,86%)] p-6 text-center shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4 font-medium">Advertisement</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl h-28 flex items-center justify-center mb-5">
              <p className="text-sm text-gray-400">Your ad here</p>
            </div>
            <p className="text-sm text-gray-500">
              Next inning in <span className="font-semibold text-gray-800">{adCountdown}</span> seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'gameover') {
    const [away, home] = state.scores;
    const title = away === home ? 'Tie Game!' : away > home ? 'Away Wins!' : 'Home Wins!';
    const body = `Final score: Away ${away} — Home ${home}`;
    const winner = away === home ? null : away > home ? 'away' : 'home';

    return (
      <div className="min-h-screen bg-[hsl(40,20%,96%)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-[hsl(35,12%,86%)] p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">⚾</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">{title}</h2>
            <p className="text-gray-500 mb-2 text-sm">Game over</p>
            <div className="flex gap-3 justify-center my-6">
              <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Away</div>
                <div className={`text-4xl font-semibold ${winner === 'away' ? 'text-[hsl(214,72%,38%)]' : 'text-gray-800'}`}>{away}</div>
              </div>
              <div className="flex items-center text-gray-300 text-2xl font-light">—</div>
              <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Home</div>
                <div className={`text-4xl font-semibold ${winner === 'home' ? 'text-[hsl(214,72%,38%)]' : 'text-gray-800'}`}>{home}</div>
              </div>
            </div>
            <button
              onClick={handleRestart}
              className="w-full py-3 rounded-xl bg-[hsl(214,72%,38%)] text-white font-medium text-[15px] active:opacity-80 transition-opacity"
            >
              New Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(40,20%,96%)] flex justify-center py-4 px-3">
      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Header */}
        <h1 className="text-[18px] font-medium text-center text-gray-800 mt-1">⚾ 1,2,3,4 Baseball</h1>

        {/* Scoreboard */}
        <div className="bg-[hsl(38,16%,91%)] border border-[hsl(35,12%,82%)] rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Away</div>
              <div className="text-[32px] font-semibold text-gray-800 leading-tight">{state.scores[0]}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Home</div>
              <div className="text-[32px] font-semibold text-gray-800 leading-tight">{state.scores[1]}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3 px-0.5">
            <span className="text-[13px] text-gray-500 font-medium">{inningLabel}</span>
            <div className="flex gap-2 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-[1.5px] transition-all duration-200 ${
                    state.outs > i
                      ? 'bg-red-500 border-red-700'
                      : 'bg-transparent border-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>

          <Diamond bases={state.bases} />
        </div>

        {/* Result banner */}
        {result && (
          <div
            className={`rounded-xl px-4 py-3 text-center text-[15px] font-semibold border transition-all ${
              result.type === 'hit'
                ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#97C459]'
                : 'bg-[#FCEBEB] text-[#A32D2D] border-[#F09595]'
            }`}
          >
            {result.message}
          </div>
        )}

        {/* Pitcher reveal */}
        {reveal && (
          <div className="rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold bg-[#FAEEDA] text-[#854F0B] border border-[#EF9F27]">
            Pitcher threw a {reveal.pitcherNum}
          </div>
        )}

        {/* Status */}
        <p className="text-[13px] text-gray-400 text-center min-h-[18px]">{statusMsg}</p>

        {/* Action area */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-[13px] text-gray-400 mb-3 font-medium">{actionLabel}</p>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => handleSelectNumber(n)}
                className={`h-14 rounded-xl border font-semibold text-xl transition-all active:scale-95 ${
                  selectedNum === n
                    ? 'bg-[#deeaf8] border-[#185FA5] text-[#0C447C]'
                    : 'bg-[#f5f5f0] border-gray-300 text-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={selectedNum === null}
            className={`w-full py-3 rounded-xl border font-semibold text-[16px] transition-all ${
              selectedNum !== null
                ? 'bg-[hsl(214,72%,38%)] border-[hsl(214,72%,30%)] text-white active:opacity-80'
                : 'bg-[#f0f0ea] border-gray-300 text-gray-400 opacity-50 cursor-not-allowed'
            }`}
          >
            {submitLabel}
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-[11px] text-gray-400 text-center pb-2">
          {INNINGS}-inning game · Pass the phone between pitcher and batter
        </p>
      </div>
    </div>
  );
}

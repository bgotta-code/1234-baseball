import { useState, useEffect, useRef, useCallback } from 'react';
import {
  subscribeRoom, setupPresence, writePitcherChoice, writeBatterChoice,
  writeResolution, writePushSubscription, readPushSubscription,
  ParsedRoomDoc, RoomSetup,
} from '@/lib/roomLogic';
import { subscribeToPush, isPushSupported } from '@/lib/pushNotifications';
import { resolveAtBat, nextHalf, GameState } from '@/lib/gameLogic';
import { playHitSound, playOutSound, playSwoosh, playScoreRipple, isMuted, toggleMute, unlockAudio } from '@/lib/audio';
import { LineScore } from '@/components/LineScore';
import { Stadium } from '@/components/Stadium';

interface OnlineGameProps {
  roomCode: string;
  role: 'host' | 'guest';
  setup: RoomSetup;
  isPaid: boolean;
  onLeave: () => void;
}

type ResultInfo = { message: string; type: 'hit' | 'out' | 'side-retired' } | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWalkoffHit(result: ReturnType<typeof resolveAtBat>, gs: GameState, innings: number) {
  return (
    result.type === 'hit' &&
    result.runs > 0 &&
    gs.half === 1 &&
    gs.inning >= innings &&
    result.newState.scores[1] > result.newState.scores[0]
  );
}

function computeDisplayMsg(
  result: ReturnType<typeof resolveAtBat>,
  gs: GameState,
  innings: number,
  walkoff: boolean,
): string {
  if (walkoff) return `Walk-off ${result.message}`;
  if (result.type === 'side-retired') {
    const endOfReg = gs.half === 1 && gs.inning >= innings;
    const tied = result.newState.scores[0] === result.newState.scores[1];
    return endOfReg && tied ? 'Extra Innings!' : '3 Outs — Side Retired';
  }
  return result.message;
}

const BALL_LANDINGS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 80, y: 140 }, { x: 150, y: 110 }, { x: 220, y: 140 }],
  2: [{ x: 30, y: 158 }, { x: 270, y: 158 }],
  3: [{ x: 112, y: 88 }, { x: 188, y: 88 }],
  4: [{ x: 150, y: -8 }],
};
function pickLanding(dist: number) {
  const arr = BALL_LANDINGS[dist] ?? BALL_LANDINGS[1];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OnlineGame({ roomCode, role, setup, isPaid, onLeave }: OnlineGameProps) {
  const [roomData, setRoomData] = useState<ParsedRoomDoc | null>(null);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [localResult, setLocalResult] = useState<ResultInfo>(null);
  const [reveal, setReveal] = useState<{ p: number; b: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showRules, setShowRules] = useState(true);
  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);
  const [animRunners, setAnimRunners] = useState<Array<{ id: string; pos: number; maxPos: number }> | null>(null);
  const [homeFlashes, setHomeFlashes] = useState<Array<{ id: string; delay: number }>>([]);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentTimeout, setOpponentTimeout] = useState(false);

  const resolving = useRef(false);
  const lastResolvedSeq = useRef(-1);
  const lastShownSeq = useRef(-1);
  const roomDataRef = useRef<ParsedRoomDoc | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postAdCallback = useRef<(() => void) | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ballTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runnerIdRef = useRef(0);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keep roomDataRef current so timeouts can read the latest phase ──────────
  useEffect(() => { roomDataRef.current = roomData; }, [roomData]);

  // ── Firebase subscription + presence ───────────────────────────────────────
  useEffect(() => {
    unlockAudio();
    const cleanupPres = setupPresence(roomCode, role);
    const unsub = subscribeRoom(roomCode, setRoomData);
    return () => { unsub(); cleanupPres(); };
  }, [roomCode, role]);

  // ── Push notification subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!isPushSupported()) return;
    subscribeToPush().then((sub) => {
      if (sub) writePushSubscription(roomCode, role, sub).catch(() => {});
    });
  }, [roomCode, role]);

  // ── Re-unlock audio on any touch/click (handles iOS/Android suspension) ───
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

  // ── Two-tier opponent-absence detection ───────────────────────────────────
  // 30 s  → "called timeout" banner (non-blocking, game waits)
  // 5 min → true disconnect screen
  useEffect(() => {
    const oppOnline = roomData
      ? (role === 'host' ? roomData.players.guest : roomData.players.host)
      : true;
    if (oppOnline === false && roomData?.phase === 'playing') {
      if (!timeoutTimerRef.current) {
        timeoutTimerRef.current = setTimeout(() => setOpponentTimeout(true), 30000);
      }
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => setOpponentDisconnected(true), 5 * 60 * 1000);
      }
    } else {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setOpponentTimeout(false);
      setOpponentDisconnected(false);
    }
  }, [roomData?.players.host, roomData?.players.guest, roomData?.phase, role]);

  // ── Reset myChoice when a new at-bat starts ────────────────────────────────
  const atBatSeq = roomData?.atBat.seq;
  const atBatPC = roomData?.atBat.pitcherChoice;
  const atBatBC = roomData?.atBat.batterChoice;
  useEffect(() => {
    if (atBatPC === null && atBatBC === null) {
      setMyChoice(null);
      setReveal(null);
    }
  }, [atBatSeq, atBatPC, atBatBC]);

  // ── Ad display ─────────────────────────────────────────────────────────────
  const startAd = useCallback((callback: () => void) => {
    const adDuration = isPaid ? 5 : 15;
    postAdCallback.current = callback;
    setAdCountdown(adDuration);
    setShowAd(true);
    if (adTimerRef.current) clearInterval(adTimerRef.current);
    let count = adDuration;
    adTimerRef.current = setInterval(() => {
      count--;
      setAdCountdown(count);
      if (count <= 0) {
        if (adTimerRef.current) clearInterval(adTimerRef.current);
        setShowAd(false);
        postAdCallback.current?.();
      }
    }, 1000);
  }, [isPaid]);

  // ── Runner + ball animation ────────────────────────────────────────────────
  const startRunnerAnimation = useCallback((
    prevBases: [boolean, boolean, boolean],
    dist: number,
    twoOut: boolean,
  ) => {
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
    const nextId = () => String(++runnerIdRef.current);
    const runnerAdv = (twoOut && dist < 4) ? dist + 1 : dist;
    const batterAdv = dist;
    const totalSteps = Math.max(runnerAdv, batterAdv);
    const initial: Array<{ id: string; pos: number; maxPos: number }> = [];
    if (prevBases[2]) initial.push({ id: nextId(), pos: 3, maxPos: 4 });
    if (prevBases[1]) initial.push({ id: nextId(), pos: 2, maxPos: 4 });
    if (prevBases[0]) initial.push({ id: nextId(), pos: 1, maxPos: 4 });
    initial.push({ id: nextId(), pos: 0, maxPos: batterAdv });
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
          prev === null ? null : prev.map(r => ({ ...r, pos: Math.min(r.pos + 1, r.maxPos) }))
        );
      }, step * STEP_MS);
      animTimersRef.current.push(t);
    }
    const cleanT = setTimeout(() => {
      setAnimRunners(prev => prev === null ? null : prev.filter(r => r.pos <= 3));
      if (scoringCount > 0) {
        for (let i = 0; i < scoringCount; i++) setTimeout(() => playScoreRipple(), i * 220);
        const flashes = Array.from({ length: scoringCount }, (_, i) => ({
          id: `${Date.now()}-${i}`,
          delay: i * 220,
        }));
        setHomeFlashes(f => [...f, ...flashes]);
        setTimeout(() => setHomeFlashes(f => f.filter(x => !flashes.some(n => n.id === x.id))), 1100);
      }
    }, totalSteps * STEP_MS + 460);
    animTimersRef.current.push(cleanT);
    const endT = setTimeout(() => setAnimRunners(null), (totalSteps + 0.7) * STEP_MS + 460);
    animTimersRef.current.push(endT);
  }, []);

  // ── HOST: resolve when both choices present ────────────────────────────────
  useEffect(() => {
    if (!roomData || role !== 'host' || resolving.current) return;
    if (roomData.phase !== 'playing' || !roomData.gameState) return;
    const { atBat, gameState } = roomData;
    if (atBat.pitcherChoice === null || atBat.batterChoice === null) return;
    if (atBat.seq <= lastResolvedSeq.current) return;

    resolving.current = true;
    lastResolvedSeq.current = atBat.seq;

    const prevBases = gameState.bases; // capture bases BEFORE resolution
    const state: GameState = {
      ...gameState,
      pitcherChoice: atBat.pitcherChoice,
      batterChoice: atBat.batterChoice,
    };
    const atBatResult = resolveAtBat(state);
    const walkoff = isWalkoffHit(atBatResult, gameState, setup.innings);
    const displayMsg = computeDisplayMsg(atBatResult, gameState, setup.innings, walkoff);

    setReveal({ p: atBat.pitcherChoice, b: atBat.batterChoice });
    setLocalResult({ message: displayMsg, type: atBatResult.type });

    if (atBatResult.type === 'hit') {
      ballTimersRef.current.forEach(clearTimeout);
      ballTimersRef.current = [];
      const landing = pickLanding(atBatResult.hitDist!);
      setBallPos({ x: 160, y: 268 });
      ballTimersRef.current.push(setTimeout(() => setBallPos(landing), 50));
      ballTimersRef.current.push(setTimeout(() => setBallPos(null), 800));
      startRunnerAnimation(prevBases, atBatResult.hitDist!, gameState.outs === 2);
      playHitSound(atBatResult.hitDist!, gameState.half);
    } else {
      playOutSound(gameState.half);
    }

    const delay = walkoff ? 4000 : 2500;
    resultTimerRef.current = setTimeout(async () => {
      setLocalResult(null);

      if (atBatResult.type === 'side-retired') {
        const { newState, gameOver } = nextHalf(atBatResult.newState, { innings: setup.innings, isPaid });
        const doWrite = async () => {
          setSwitching(true);
          await writeResolution(
            roomCode, newState, gameOver, atBatResult, displayMsg,
            atBat.seq + 1, gameState.half, false,
            atBat.pitcherChoice!, atBat.batterChoice!, prevBases,
          );
          switchTimerRef.current = setTimeout(() => setSwitching(false), 2000);
          resolving.current = false;
        };
        if (gameOver) {
          await doWrite();
        } else {
          startAd(doWrite);
        }
      } else if (walkoff) {
        const { newState } = nextHalf(atBatResult.newState, { innings: setup.innings, isPaid });
        await writeResolution(
          roomCode, newState, true, atBatResult, displayMsg,
          atBat.seq + 1, gameState.half, true,
          atBat.pitcherChoice!, atBat.batterChoice!, prevBases,
        );
        resolving.current = false;
      } else {
        await writeResolution(
          roomCode, atBatResult.newState, false, atBatResult, displayMsg,
          atBat.seq + 1, gameState.half, false,
          atBat.pitcherChoice!, atBat.batterChoice!, prevBases,
        );
        resolving.current = false;
      }
    }, delay);
  }, [atBatPC, atBatBC, atBatSeq]);

  // ── GUEST: display result from lastAtBat ───────────────────────────────────
  const lastAtBatSeq = roomData?.lastAtBat?.seq;
  useEffect(() => {
    if (!roomData || role !== 'guest' || !roomData.lastAtBat) return;
    const la = roomData.lastAtBat;
    if (la.seq <= lastShownSeq.current) return;
    lastShownSeq.current = la.seq;

    setReveal({ p: la.pitcherNum, b: la.batterNum });
    setLocalResult({ message: la.message, type: la.type });

    if (la.type === 'hit') {
      ballTimersRef.current.forEach(clearTimeout);
      ballTimersRef.current = [];
      const landing = pickLanding(la.hitDist ?? 1);
      setBallPos({ x: 160, y: 268 });
      ballTimersRef.current.push(setTimeout(() => setBallPos(landing), 50));
      ballTimersRef.current.push(setTimeout(() => setBallPos(null), 800));
      const prevB = la.prevBases?.length === 3 ? la.prevBases : [false, false, false] as [boolean, boolean, boolean];
      const twoOut = (roomData.gameState?.outs ?? 0) === 2;
      startRunnerAnimation(prevB, la.hitDist ?? 1, twoOut);
      playHitSound(la.hitDist ?? 1, la.half);
    } else {
      playOutSound(la.half);
    }

    const delay = la.walkoff ? 4000 : 2500;
    resultTimerRef.current = setTimeout(() => {
      setLocalResult(null);
      if (la.type === 'side-retired' && roomDataRef.current?.phase !== 'gameover') {
        startAd(() => {
          setSwitching(true);
          switchTimerRef.current = setTimeout(() => setSwitching(false), 2000);
        });
      }
    }, delay);

    return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
  }, [lastAtBatSeq]);

  const handleMuteToggle = useCallback(() => setMuted(toggleMute()), []);

  const handleSelectNumber = useCallback((n: number) => {
    if (localResult || switching) return;
    setMyChoice(n);
  }, [localResult, switching]);

  const handleSubmit = useCallback(async () => {
    if (!myChoice || !roomData?.gameState) return;
    const gs = roomData.gameState;
    const hr = setup.hostRole ?? 'away';
    const isPitcherNow = hr === 'home'
      ? (role === 'host' && gs.half === 0) || (role === 'guest' && gs.half === 1)
      : (role === 'host' && gs.half === 1) || (role === 'guest' && gs.half === 0);
    if (isPitcherNow) {
      playSwoosh();
      await writePitcherChoice(roomCode, myChoice);
      const batterRole = role === 'host' ? 'guest' : 'host';
      readPushSubscription(roomCode, batterRole).then((sub) => {
        if (!sub) return;
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub,
            title: '⚾ Pitcher has chosen!',
            body: 'Your turn — open the game to pick your swing.',
          }),
        }).catch(() => {});
      }).catch(() => {});
    } else {
      await writeBatterChoice(roomCode, myChoice);
    }
  }, [myChoice, roomData, role, roomCode]);

  const bg = 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!roomData || !roomData.gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <p className="text-white/50 animate-pulse">Connecting…</p>
      </div>
    );
  }

  // ── Ad screen ─────────────────────────────────────────────────────────────
  if (showAd) {
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

  // ── Disconnection ──────────────────────────────────────────────────────────
  if (opponentDisconnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
        <div className="w-full max-w-sm text-center flex flex-col gap-4">
          <div className="text-5xl">📵</div>
          <h2 className="text-xl font-black text-white">Opponent disconnected</h2>
          <button
            onClick={onLeave}
            className="w-full py-4 rounded-2xl font-black text-[18px] text-white"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
          >
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const { gameState } = roomData;
  const hostRole = setup.hostRole ?? 'away';
  // Away team pitches in the bottom (half=1), home team pitches in the top (half=0)
  const isPitcher = hostRole === 'home'
    ? (role === 'host' && gameState.half === 0) || (role === 'guest' && gameState.half === 1)
    : (role === 'host' && gameState.half === 1) || (role === 'guest' && gameState.half === 0);
  const myTeamName = role === 'host'
    ? (hostRole === 'home' ? setup.homeTeam : setup.awayTeam)
    : (hostRole === 'home' ? setup.awayTeam : setup.homeTeam);
  const isExtraInning = gameState.inning > setup.innings;
  const inningLabel = isExtraInning
    ? `Extra Inning — ${gameState.half === 0 ? 'Top' : 'Bottom'}`
    : `Inning ${gameState.inning} — ${gameState.half === 0 ? 'Top' : 'Bottom'}`;

  const pitcherReady = roomData.atBat.pitcherChoice !== null;
  // Track whether the local choice has actually been sent to Firebase (not just selected locally)
  const sentToFirebase = isPitcher
    ? roomData.atBat.pitcherChoice !== null
    : roomData.atBat.batterChoice !== null;

  // ── Game Over ──────────────────────────────────────────────────────────────
  if (roomData.phase === 'gameover') {
    const [away, home] = gameState.scores;
    const tied = away === home;
    const hostWins = setup.hostRole === 'away' ? (away > home) : (home > away);
    const iWin = tied ? false : (role === 'host' ? hostWins : !hostWins);
    const title = tied ? "It's a Tie!" : iWin ? '🏆 You Win!' : '🤝 Good Game!';
    const totalInnings = setup.innings + gameState.extraInnings;
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="text-center">
            <div className="text-5xl mb-3">⚾</div>
            <h2 className="text-2xl font-black text-white">{title}</h2>
            <p className="text-white/40 text-sm mt-1">Final · {totalInnings} innings</p>
          </div>

          <div className="flex gap-3">
            {[setup.awayTeam, setup.homeTeam].map((team, i) => {
              const score = gameState.scores[i];
              const win = !tied && ((i === 0 && hostWins) || (i === 1 && !hostWins));
              return (
                <div key={team} className={`flex-1 rounded-2xl p-4 text-center border ${win ? 'border-yellow-400/50' : 'border-white/15'}`}
                  style={{ background: win ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.35)' }}>
                  <div className="text-[10px] text-white/45 font-bold uppercase tracking-widest mb-1 truncate">{team}</div>
                  <div className={`text-4xl font-black ${win ? 'text-yellow-300' : 'text-white'}`}>{score}</div>
                  {win && <div className="text-[10px] text-yellow-400 mt-1 font-bold">WINNER</div>}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/15 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">Box Score</p>
            <LineScore
              innings={setup.innings}
              lineScore={gameState.lineScore}
              scores={gameState.scores}
              currentInning={gameState.inning}
              currentHalf={gameState.half}
              awayTeam={setup.awayTeam}
              homeTeam={setup.homeTeam}
              isGameOver
            />
          </div>

          <button
            onClick={onLeave}
            className="w-full py-4 rounded-2xl font-black text-[18px] text-white"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.35)' }}
          >
            New Game
          </button>
        </div>
      </div>
    );
  }

  // ── Main game screen ───────────────────────────────────────────────────────
  const actionLabel = isPitcher
    ? sentToFirebase ? 'Waiting for batter…' : 'Choose your pitch'
    : !pitcherReady ? 'Pitcher is choosing…'
    : sentToFirebase ? 'Waiting for result…'
    : '⚡ Pitcher is ready — pick your swing!';

  // canPick: can the player still interact with number buttons (not yet sent to Firebase)
  const canPick = !sentToFirebase && !localResult && !switching &&
    (isPitcher || pitcherReady);
  // canSubmit: has a local selection and hasn't sent to Firebase yet
  const canSubmit = canPick && myChoice !== null;

  const submitLabel = isPitcher ? 'Pitch' : 'Swing!';
  const submitGradient = isPitcher
    ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
    : 'linear-gradient(135deg,#16a34a,#15803d)';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6"
      style={{ background: bg }}>

      {/* ── Timeout banner ───────────────────────────────────────────────── */}
      {opponentTimeout && !opponentDisconnected && (
        <div className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-3 pointer-events-none">
          <div className="rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl"
            style={{ background: 'rgba(10,30,10,0.92)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span className="text-lg">⏸</span>
            <p className="text-[13px] font-semibold text-white/80">Opponent has called timeout</p>
          </div>
        </div>
      )}

      {/* ── Rules overlay ─────────────────────────────────────────────────── */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/20 p-6 relative" style={{ background: 'rgba(8,24,8,0.98)' }}>
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white/80 text-2xl font-black leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
            <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold mb-4">How to Play</p>
            <ul className="text-[13px] text-white/70 flex flex-col gap-2.5 list-none mb-5">
              <li>🎯 Pitcher selects a number 1–4 on their device</li>
              <li>🏏 Batter guesses which number was chosen</li>
              <li>✅ Correct guess = 1 Single · 2 Double · 3 Triple · 4 HR</li>
              <li>❌ Incorrect guess = Out</li>
              <li>🔄 3 outs = change sides</li>
              <li className="text-white/45 text-[12px] pt-1 border-t border-white/10">
                🆓 Free version = 3-inning game + 1 extra inning if needed
              </li>
              <li className="text-white/45 text-[12px]">
                ⭐ Upgrade for 5, 7 &amp; 9-inning games, unlimited extra innings + shorter ads
              </li>
            </ul>
            <button
              onClick={() => setShowRules(false)}
              className="w-full py-3.5 rounded-xl font-black text-[16px] text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}
            >
              Got it — Play Ball!
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/35 uppercase tracking-widest">{inningLabel}</p>
            <p className="text-white font-bold text-sm">{myTeamName} · {isPitcher ? '🎯 Pitching' : '🏏 Batting'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">{roomCode}</span>
            <button onClick={handleMuteToggle} className="text-white/40 text-lg w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="rounded-2xl border border-white/15 px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.42)' }}>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-white/40 truncate">{setup.awayTeam}</p>
            <p className="text-3xl font-black text-white">{gameState.scores[0]}</p>
          </div>
          <div className="text-center px-2">
            <p className="text-white/20 text-xs font-bold">OUTS</p>
            <div className="flex gap-1 justify-center mt-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < gameState.outs ? 'border-amber-400 bg-amber-400' : 'border-white/30'}`} />
              ))}
            </div>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-white/40 truncate">{setup.homeTeam}</p>
            <p className="text-3xl font-black text-white">{gameState.scores[1]}</p>
          </div>
        </div>

        {/* Stadium */}
        <div className="rounded-2xl border border-white/15 overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.35)' }}>
          <Stadium
            bases={gameState.bases}
            phase={gameState.phase}
            awayTeam={setup.awayTeam}
            homeTeam={setup.homeTeam}
            battingTeam={gameState.half as 0 | 1}
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
            innings={setup.innings}
            lineScore={gameState.lineScore}
            scores={gameState.scores}
            currentInning={gameState.inning}
            currentHalf={gameState.half}
            awayTeam={setup.awayTeam}
            homeTeam={setup.homeTeam}
          />
        </div>

        {/* Result banner */}
        {localResult && (
          <div className={`rounded-xl px-4 py-2.5 text-center text-[15px] font-black border ${
            localResult.type === 'hit' ? 'border-green-500/40 text-green-300' : 'border-red-500/40 text-red-300'
          }`} style={{ background: localResult.type === 'hit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
            {localResult.message}
          </div>
        )}

        {/* Reveal */}
        {reveal && (
          <div className="rounded-xl px-4 py-2 text-center text-[13px] font-bold text-amber-300 border border-amber-400/35"
            style={{ background: 'rgba(251,191,36,0.12)' }}>
            Pitcher: {reveal.p} · Batter: {reveal.b}
          </div>
        )}

        {/* Switching sides overlay */}
        {switching && (
          <div className="rounded-xl px-4 py-3 text-center text-[14px] font-bold text-white/70 border border-white/15 animate-pulse"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            ⚾ Switching sides…
          </div>
        )}

        {/* Action panel */}
        <div className="rounded-2xl border border-white/15 p-3.5"
          style={{ background: 'rgba(0,0,0,0.42)' }}>
          <p className={`text-[11px] mb-2.5 font-bold uppercase tracking-wide ${
            canPick ? 'text-white' : 'text-white/40'
          }`}>{actionLabel}</p>

          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => canPick && handleSelectNumber(n)}
                disabled={!canPick}
                className={`h-14 rounded-xl font-black text-2xl transition-all border ${
                  !canPick
                    ? 'border-white/10 text-white/20 cursor-not-allowed'
                    : myChoice === n
                      ? 'border-blue-400 text-white shadow-lg active:scale-90'
                      : 'border-white/20 text-white/75 active:scale-90 active:bg-white/15'
                }`}
                style={{
                  background: !canPick
                    ? 'rgba(255,255,255,0.03)'
                    : myChoice === n
                      ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
                      : 'rgba(255,255,255,0.07)',
                  boxShadow: myChoice === n ? '0 0 20px rgba(37,99,235,0.4)' : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-3.5 rounded-xl font-black text-[17px] transition-all border ${
              canSubmit
                ? 'border-transparent text-white active:scale-95'
                : 'border-white/10 text-white/20 cursor-not-allowed'
            }`}
            style={{
              background: canSubmit ? submitGradient : 'rgba(255,255,255,0.04)',
              boxShadow: canSubmit ? '0 4px 20px rgba(37,99,235,0.3)' : 'none',
            }}
          >
            {submitLabel}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pb-1 px-1">
          <p className="text-[9px] text-white/20">
            {setup.innings}-inning game · online
          </p>
          {confirmLeave ? (
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button className="text-[9px] text-white/35 underline"
                onClick={() => {
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  setConfirmLeave(false);
                }}>
                Cancel
              </button>
              <button className="text-[9px] text-red-400/70 font-bold underline" onClick={onLeave}>
                Leave?
              </button>
            </div>
          ) : (
            <button
              className="text-[9px] text-white/20 underline shrink-0 ml-2"
              onClick={() => {
                setConfirmLeave(true);
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = setTimeout(() => setConfirmLeave(false), 4000);
              }}
            >
              Leave Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import {
  createRoom, joinRoom, cancelRoom, startGame, subscribeRoom,
  setupPresence, ParsedRoomDoc, RoomSetup,
} from '@/lib/roomLogic';
import { unlockAudio, playPlayBallJingle } from '@/lib/audio';

interface OnlineLobbyProps {
  mode: 'host' | 'guest';
  roomCode: string;
  setup?: RoomSetup;
  guestTeamName?: string;
  onGameReady: (setup: RoomSetup, roomCode: string, role: 'host' | 'guest') => void;
  onLeave: () => void;
}

export function OnlineLobby({ mode, roomCode, setup, guestTeamName, onGameReady, onLeave }: OnlineLobbyProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [roomData, setRoomData] = useState<ParsedRoomDoc | null>(null);
  const started = useRef(false);
  const cleanupPresence = useRef<(() => void) | null>(null);

  useEffect(() => {
    unlockAudio();

    async function init() {
      if (mode === 'host') {
        if (!setup) { setStatus('error'); setErrorMsg('Missing game setup.'); return; }
        await createRoom(roomCode, setup);
        cleanupPresence.current = setupPresence(roomCode, 'host');
        setStatus('waiting');
        return subscribeRoom(roomCode, setRoomData);
      } else {
        const result = await joinRoom(roomCode, guestTeamName);
        if (result === 'not-found') {
          setStatus('error'); setErrorMsg('No game found with that passcode. Double-check with your opponent.');
          return;
        }
        if (result === 'cancelled') {
          setStatus('error'); setErrorMsg('This game was rained out. Ask your opponent to create a new one.');
          return;
        }
        if (result === 'full') {
          setStatus('error'); setErrorMsg('This game is already full or has started.');
          return;
        }
        cleanupPresence.current = setupPresence(roomCode, 'guest');
        setStatus('waiting');
        return subscribeRoom(roomCode, setRoomData);
      }
    }

    let unsub: (() => void) | undefined;
    init().then(u => { unsub = u; });
    return () => {
      unsub?.();
      cleanupPresence.current?.();
    };
  }, []);

  useEffect(() => {
    if (!roomData || started.current) return;

    if (mode === 'host' && roomData.players.guest && roomData.phase === 'lobby') {
      started.current = true;
      playPlayBallJingle();
      startGame(roomCode).then(() => {
        onGameReady(setup!, roomCode, 'host');
      });
    }

    if (mode === 'guest' && roomData.phase === 'playing' && roomData.gameState) {
      started.current = true;
      playPlayBallJingle();
      onGameReady(roomData.setup, roomCode, 'guest');
    }
  }, [roomData]);

  const bg = 'linear-gradient(170deg,#0c2c0c 0%,#1e4a1e 60%,#2a5a2a 100%)';

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
        <div className="w-full max-w-sm flex flex-col gap-5 text-center">
          <div className="text-5xl">😕</div>
          <p className="text-white font-bold text-lg">{errorMsg}</p>
          <button
            onClick={onLeave}
            className="w-full py-4 rounded-2xl font-black text-[18px] text-white"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'host' && status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
        <div className="w-full max-w-sm flex flex-col gap-5">
          <div className="text-center">
            <div className="text-5xl mb-2">⚾</div>
            <h2 className="text-2xl font-black text-white">Game Created!</h2>
            <p className="text-white/50 text-sm mt-1">Share the code below with your opponent</p>
          </div>

          <div
            className="rounded-2xl border border-white/20 p-6 text-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2">Stadium Passcode</p>
            <p className="text-5xl font-black text-white tracking-[0.15em] mb-3">{roomCode}</p>
            <p className="text-[11px] text-white/30">
              {setup?.awayTeam ?? 'Away'} vs {setup?.homeTeam ?? 'Home'} · {setup?.innings} innings
            </p>
          </div>

          <div
            className="rounded-2xl border border-white/10 p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {roomData?.players.guest ? (
              <p className="text-green-400 font-bold text-sm animate-pulse">
                Opponent joined! Starting game…
              </p>
            ) : (
              <>
                <p className="text-white/55 text-sm animate-pulse">Waiting for opponent…</p>
                <p className="text-white/25 text-xs mt-2">
                  You are the {setup?.hostRole === 'home' ? 'Home' : 'Away'} team
                </p>
              </>
            )}
          </div>

          {!roomData?.players.guest && (
            <button
              onClick={() => {
                const text = `Join my 1,2,3,4 Baseball game!\nStadium passcode: ${roomCode}\nTap to join: ${window.location.origin}?join=${roomCode}`;
                if (navigator.share) {
                  navigator.share({ title: '1,2,3,4 Baseball', text }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(text).catch(() => {});
                }
              }}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white border border-white/20 transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              📱 Text / Share Invite
            </button>
          )}

          <button
            onClick={() => { cancelRoom(roomCode).catch(() => {}); onLeave(); }}
            className="text-white/30 text-sm underline text-center"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: bg }}>
      <div className="w-full max-w-sm flex flex-col gap-5 text-center">
        <div className="text-5xl mb-2">⚾</div>
        <h2 className="text-2xl font-black text-white">Joining…</h2>
        <p className="text-white/50 text-sm animate-pulse">Connecting to game {roomCode}</p>
        <div
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          {roomData ? (
            <p className="text-white/55 text-sm animate-pulse">Waiting for host to start…</p>
          ) : (
            <p className="text-white/35 text-sm animate-pulse">Connecting…</p>
          )}
        </div>
        <button onClick={onLeave} className="text-white/30 text-sm underline">Start over</button>
      </div>
    </div>
  );
}

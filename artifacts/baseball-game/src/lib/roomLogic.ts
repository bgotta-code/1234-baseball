import { getDb } from './firebase';
import {
  ref, set, get, update, onValue, off, onDisconnect as fbOnDisconnect,
} from 'firebase/database';
import { GameState, initState, AtBatResult } from './gameLogic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomSetup {
  awayTeam: string;
  homeTeam: string;
  innings: number;
}

export interface AtBat {
  seq: number;
  pitcherChoice: number | null;
  batterChoice: number | null;
}

export interface LastAtBat {
  seq: number;
  type: 'hit' | 'out' | 'side-retired';
  message: string;
  runs: number;
  hitDist: number;
  half: number;
  walkoff: boolean;
  pitcherNum: number;
  batterNum: number;
}

export type RoomPhase = 'lobby' | 'playing' | 'gameover';

export interface ParsedRoomDoc {
  setup: RoomSetup;
  players: { host: boolean; guest: boolean };
  phase: RoomPhase;
  gameState: GameState | null;
  atBat: AtBat;
  lastAtBat: LastAtBat | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toArr<T>(v: unknown): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'object') {
    const o = v as Record<string, T>;
    const keys = Object.keys(o).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) return [];
    const arr: T[] = new Array(keys[keys.length - 1] + 1).fill(null);
    for (const k of keys) arr[k] = o[k];
    return arr;
  }
  return [];
}

export function parseGameState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ls = r.lineScore as Record<string, unknown> | null | undefined;
  return {
    scores: toArr<number>(r.scores) as [number, number],
    inning: (r.inning as number) ?? 1,
    half: (r.half as number) ?? 0,
    outs: (r.outs as number) ?? 0,
    bases: toArr<boolean>(r.bases) as [boolean, boolean, boolean],
    pitcherChoice: (r.pitcherChoice as number | null) ?? null,
    batterChoice: (r.batterChoice as number | null) ?? null,
    phase: (r.phase as 'pitch' | 'swing') ?? 'pitch',
    lineScore: [
      toArr<number>(ls?.[0] ?? []),
      toArr<number>(ls?.[1] ?? []),
    ],
    halfInningStartScores: toArr<number>(r.halfInningStartScores) as [number, number],
    extraInnings: (r.extraInnings as number) ?? 0,
  };
}

function parseRoomDoc(raw: unknown): ParsedRoomDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const atBatRaw = r.atBat as Record<string, unknown> | null | undefined;
  const lastAtBatRaw = r.lastAtBat as Record<string, unknown> | null | undefined;
  const playersRaw = r.players as Record<string, unknown> | null | undefined;
  return {
    setup: (r.setup as RoomSetup) ?? { awayTeam: 'Away', homeTeam: 'Home', innings: 3 },
    players: {
      host: (playersRaw?.host as boolean) ?? false,
      guest: (playersRaw?.guest as boolean) ?? false,
    },
    phase: (r.phase as RoomPhase) ?? 'lobby',
    gameState: parseGameState(r.gameState),
    atBat: {
      seq: (atBatRaw?.seq as number) ?? 0,
      pitcherChoice: (atBatRaw?.pitcherChoice as number | null) ?? null,
      batterChoice: (atBatRaw?.batterChoice as number | null) ?? null,
    },
    lastAtBat: lastAtBatRaw ? {
      seq: (lastAtBatRaw.seq as number) ?? 0,
      type: (lastAtBatRaw.type as LastAtBat['type']) ?? 'out',
      message: (lastAtBatRaw.message as string) ?? '',
      runs: (lastAtBatRaw.runs as number) ?? 0,
      hitDist: (lastAtBatRaw.hitDist as number) ?? 0,
      half: (lastAtBatRaw.half as number) ?? 0,
      walkoff: (lastAtBatRaw.walkoff as boolean) ?? false,
      pitcherNum: (lastAtBatRaw.pitcherNum as number) ?? 0,
      batterNum: (lastAtBatRaw.batterNum as number) ?? 0,
    } : null,
  };
}

// ── Room code generation ──────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('');
}

// ── Firebase operations ───────────────────────────────────────────────────────

function roomRef(code: string) {
  return ref(getDb(), `rooms/${code}`);
}

export async function createRoom(code: string, setup: RoomSetup): Promise<void> {
  await set(roomRef(code), {
    setup,
    players: { host: true, guest: false },
    phase: 'lobby',
    gameState: null,
    atBat: { seq: 0, pitcherChoice: null, batterChoice: null },
    lastAtBat: null,
    createdAt: Date.now(),
  });
}

export async function joinRoom(code: string, guestTeamName?: string): Promise<'ok' | 'not-found' | 'full'> {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return 'not-found';
  const data = snap.val() as Record<string, unknown>;
  const players = data.players as Record<string, boolean>;
  if (players.guest) return 'full';
  if (data.phase !== 'lobby') return 'full';
  await update(ref(getDb(), `rooms/${code}/players`), { guest: true });
  if (guestTeamName) {
    await update(ref(getDb(), `rooms/${code}/setup`), { homeTeam: guestTeamName });
  }
  return 'ok';
}

export async function startGame(code: string): Promise<void> {
  const initialState = initState();
  await update(roomRef(code), {
    phase: 'playing',
    gameState: initialState,
  });
}

export async function writePitcherChoice(code: string, choice: number): Promise<void> {
  await update(ref(getDb(), `rooms/${code}/atBat`), { pitcherChoice: choice });
}

export async function writeBatterChoice(code: string, choice: number): Promise<void> {
  await update(ref(getDb(), `rooms/${code}/atBat`), { batterChoice: choice });
}

export async function writeResolution(
  code: string,
  newGameState: GameState,
  gameOver: boolean,
  result: AtBatResult,
  displayMessage: string,
  nextSeq: number,
  half: number,
  walkoff: boolean,
  pitcherNum: number,
  batterNum: number,
): Promise<void> {
  await update(roomRef(code), {
    phase: gameOver ? 'gameover' : 'playing',
    gameState: newGameState,
    'atBat/seq': nextSeq,
    'atBat/pitcherChoice': null,
    'atBat/batterChoice': null,
    lastAtBat: {
      seq: nextSeq - 1,
      type: result.type,
      message: displayMessage,
      runs: result.runs,
      hitDist: result.hitDist ?? 0,
      half,
      walkoff,
      pitcherNum,
      batterNum,
    },
  });
}

// ── Push subscription storage ─────────────────────────────────────────────────

export interface SerializedPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export async function writePushSubscription(
  code: string,
  role: 'host' | 'guest',
  subscription: PushSubscription,
): Promise<void> {
  await set(ref(getDb(), `rooms/${code}/subscriptions/${role}`), subscription.toJSON());
}

export async function readPushSubscription(
  code: string,
  role: 'host' | 'guest',
): Promise<SerializedPushSubscription | null> {
  const snap = await get(ref(getDb(), `rooms/${code}/subscriptions/${role}`));
  return snap.exists() ? (snap.val() as SerializedPushSubscription) : null;
}

export function setupPresence(code: string, role: 'host' | 'guest'): () => void {
  const presRef = ref(getDb(), `rooms/${code}/players/${role}`);
  set(presRef, true);
  fbOnDisconnect(presRef).set(false);
  return () => set(presRef, false);
}

export function subscribeRoom(
  code: string,
  callback: (data: ParsedRoomDoc | null) => void,
): () => void {
  const r = roomRef(code);
  onValue(r, (snap) => callback(snap.exists() ? parseRoomDoc(snap.val()) : null));
  return () => off(r);
}

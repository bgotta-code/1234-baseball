export const INNINGS = 9; // kept for any legacy references; prefer the per-game `innings` prop

export const HIT_NAMES: Record<number, string> = {
  1: 'Single',
  2: 'Double',
  3: 'Triple',
  4: 'Home Run!',
};

export interface GameState {
  scores: [number, number];
  inning: number;
  half: number; // 0 = top (away bats), 1 = bottom (home bats)
  outs: number;
  bases: [boolean, boolean, boolean]; // [first, second, third]
  pitcherChoice: number | null;
  batterChoice: number | null;
  phase: 'pitch' | 'swing';
  lineScore: [number[], number[]]; // per-inning runs: [away[], home[]]
  halfInningStartScores: [number, number]; // scores at the start of this half-inning
  extraInnings: number; // how many extra innings have been played
}

export function initState(): GameState {
  return {
    scores: [0, 0],
    inning: 1,
    half: 0,
    outs: 0,
    bases: [false, false, false],
    pitcherChoice: null,
    batterChoice: null,
    phase: 'pitch',
    lineScore: [[], []],
    halfInningStartScores: [0, 0],
    extraInnings: 0,
  };
}

export interface AtBatResult {
  type: 'hit' | 'out' | 'side-retired';
  message: string;
  runs: number;
  hitDist?: number;
  newState: GameState;
}

export function resolveAtBat(state: GameState): AtBatResult {
  const p = state.pitcherChoice!;
  const b = state.batterChoice!;
  const match = p === b;
  const twoOut = state.outs === 2;

  const newState: GameState = {
    ...state,
    pitcherChoice: null,
    batterChoice: null,
    phase: 'pitch',
  };

  if (match) {
    const hitDist = b;
    let runs = 0;
    const newBases: [boolean, boolean, boolean] = [false, false, false];

    if (hitDist === 4) {
      runs += 1;
      for (let i = 0; i < 3; i++) if (state.bases[i]) runs++;
    } else {
      const runnerAdv = twoOut ? hitDist + 1 : hitDist;
      for (let i = 2; i >= 0; i--) {
        if (state.bases[i]) {
          const dest = i + runnerAdv;
          if (dest >= 3) runs++;
          else newBases[dest] = true;
        }
      }
      const batterDest = hitDist - 1;
      if (batterDest >= 3) runs++;
      else newBases[batterDest] = true;
    }

    newState.bases = newBases;
    newState.scores = [...state.scores] as [number, number];
    newState.scores[state.half] += runs;

    let msg = HIT_NAMES[b];
    if (runs > 0) msg += ` — ${runs} run${runs > 1 ? 's' : ''} score${runs === 1 ? 's' : ''}!`;

    return { type: 'hit', message: msg, runs, hitDist, newState };
  } else {
    const newOuts = state.outs + 1;
    newState.outs = newOuts;

    if (newOuts >= 3) {
      return { type: 'side-retired', message: 'Out — side retired', runs: 0, newState };
    }
    return { type: 'out', message: newOuts === 1 ? '1 Out' : '2 Outs', runs: 0, newState };
  }
}

export interface NextHalfConfig {
  innings: number;  // scheduled game length
  isPaid: boolean;  // paid = unlimited extra innings; free = max 1 extra
}

export function nextHalf(
  state: GameState,
  config: NextHalfConfig,
): { newState: GameState; gameOver: boolean } {
  // Record runs scored this half-inning in the linescore
  const runsThisHalf = state.scores[state.half] - state.halfInningStartScores[state.half];
  const newLineScore: [number[], number[]] = [
    [...state.lineScore[0]],
    [...state.lineScore[1]],
  ];
  newLineScore[state.half].push(runsThisHalf);

  let { half, inning } = state;
  half++;
  if (half > 1) { half = 0; inning++; }

  const baseNext: GameState = {
    ...state,
    half,
    inning,
    outs: 0,
    bases: [false, false, false],
    pitcherChoice: null,
    batterChoice: null,
    phase: 'pitch',
    lineScore: newLineScore,
    halfInningStartScores: [...state.scores] as [number, number],
  };

  // If home team already leads going into the bottom of the final (or any extra)
  // inning they don't need to bat — game over immediately.
  if (half === 1 && inning >= config.innings) {
    const [away, home] = state.scores;
    if (home > away) {
      return { newState: baseNext, gameOver: true };
    }
  }

  // Still within scheduled innings — keep playing
  if (inning <= config.innings) {
    return { newState: baseNext, gameOver: false };
  }

  // Bottom half of an extra inning still needs to be played
  if (half === 1) {
    return { newState: baseNext, gameOver: false };
  }

  // Past scheduled innings, both halves complete — check the score
  const [away, home] = state.scores;
  const tied = away === home;

  if (!tied) {
    // Clear winner after regulation
    return { newState: baseNext, gameOver: true };
  }

  // Tied — decide whether to play an extra inning
  const maxExtra = config.isPaid ? Infinity : 1;
  if (state.extraInnings >= maxExtra) {
    // No more extras allowed (free tier limit) — official tie
    return { newState: baseNext, gameOver: true };
  }

  // Play an extra inning
  return {
    newState: { ...baseNext, extraInnings: state.extraInnings + 1 },
    gameOver: false,
  };
}

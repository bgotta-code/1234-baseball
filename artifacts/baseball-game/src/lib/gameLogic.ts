export const INNINGS = 9;

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
    return { type: 'out', message: 'Out', runs: 0, newState };
  }
}

export function nextHalf(state: GameState): { newState: GameState; gameOver: boolean } {
  let { half, inning } = state;
  half++;
  if (half > 1) { half = 0; inning++; }

  if (inning > INNINGS) {
    return {
      newState: { ...state, half, inning, outs: 0, bases: [false, false, false] },
      gameOver: true,
    };
  }

  return {
    newState: {
      ...state,
      half,
      inning,
      outs: 0,
      bases: [false, false, false],
      pitcherChoice: null,
      batterChoice: null,
      phase: 'pitch',
    },
    gameOver: false,
  };
}

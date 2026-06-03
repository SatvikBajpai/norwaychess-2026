// Monte Carlo engine for Norway Chess 2026.
//
// The Norway Chess scoring system is what makes this different from a normal tournament sim:
//   - classical win        -> 3 points (loser 0)
//   - classical draw        -> an Armageddon game is played:
//        Armageddon win     -> 1.5 points
//        Armageddon loss    -> 1 point   (a drawn Armageddon counts as a Black win: draw odds)
//
// So every game is a two-stage outcome tree (classical W/D/L, then conditionally Armageddon),
// and the per-game point total is 3 when decisive but only 2.5 when it goes to Armageddon.

import type {
  GameResult,
  Section,
  SimMode,
  SimParams,
  SimResult,
} from "./types";

export const DEFAULT_PARAMS: SimParams = {
  iterations: 40000,
  whiteAdvantage: 35,
  baseDrawRate: 0.5,
  drawFloor: 0.12,
  ratingSD: 50,
  armageddonWhiteAdvantage: 15,
  armageddonDamp: 0.55,
};

/** Points awarded to [white, black] for a settled game. */
export function gamePoints(r: GameResult): [number, number] {
  if (r.classical === "white") return [3, 0];
  if (r.classical === "black") return [0, 3];
  // classical draw -> Armageddon
  if (r.armageddon === "white") return [1.5, 1];
  return [1, 1.5];
}

// --- RNG (seeded, so a forecast is reproducible / re-rollable) -------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller, driven by the provided uniform RNG. */
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

// --- Game-level probability model -----------------------------------------

interface ClassicalProbs {
  pWhiteWin: number;
  pDraw: number;
  pBlackWin: number;
}

/**
 * Classical outcome distribution. Expected score comes from Elo (+ White advantage); the draw
 * mass is highest in even matchups and dampens as the rating gap grows, then the decisive mass
 * is split so that pWin - pLoss reproduces the Elo expected score.
 */
function classicalProbs(
  rWhite: number,
  rBlack: number,
  p: SimParams,
): ClassicalProbs {
  const e = expectedScore(rWhite + p.whiteAdvantage, rBlack);
  let pDraw = p.baseDrawRate * (1 - Math.abs(2 * e - 1));
  pDraw = Math.max(p.drawFloor, Math.min(0.92, pDraw));

  let pWhiteWin = e - pDraw / 2;
  let pBlackWin = 1 - e - pDraw / 2;
  if (pWhiteWin < 0) pWhiteWin = 0;
  if (pBlackWin < 0) pBlackWin = 0;

  const sum = pWhiteWin + pDraw + pBlackWin;
  return {
    pWhiteWin: pWhiteWin / sum,
    pDraw: pDraw / sum,
    pBlackWin: pBlackWin / sum,
  };
}

/** Probability White wins the Armageddon. Black wins (via draw odds) the rest of the time. */
function armageddonWhiteWinProb(
  rWhite: number,
  rBlack: number,
  p: SimParams,
): number {
  const e = expectedScore(rWhite + p.armageddonWhiteAdvantage, rBlack);
  // Short time control -> higher variance -> pull the Elo signal toward a coin flip.
  const v = 0.5 + p.armageddonDamp * (e - 0.5);
  return Math.max(0.02, Math.min(0.98, v));
}

// --- Public prediction API (used by the calibration backtest) --------------

/** The model's classical W/D/L distribution for a single game at fixed strengths (no form noise). */
export function predictClassical(
  rWhite: number,
  rBlack: number,
  p: SimParams,
): { pWhiteWin: number; pDraw: number; pBlackWin: number } {
  return classicalProbs(rWhite, rBlack, p);
}

/** The model's probability that White wins the Armageddon at fixed strengths (no form noise). */
export function predictArmageddonWhiteWin(
  rWhite: number,
  rBlack: number,
  p: SimParams,
): number {
  return armageddonWhiteWinProb(rWhite, rBlack, p);
}

// --- Precomputation (split played vs. remaining games for a given mode) ----

interface CompactGame {
  w: number; // white player index
  b: number; // black player index
}

interface SettledGame extends CompactGame {
  wp: number; // white points
  bp: number; // black points
}

interface Precomputed {
  n: number;
  ids: string[];
  ratings: number[];
  fixedPoints: number[]; // points already banked (live mode); zeros in pretournament mode
  playedGames: SettledGame[]; // settled games that count toward tiebreaks
  remainingGames: CompactGame[]; // games to simulate each iteration
  currentPoints: number[]; // actual standings for display (always from real results)
  roundsPlayed: number;
}

export function precompute(section: Section, mode: SimMode): Precomputed {
  const ids = section.players.map((p) => p.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const ratings = section.players.map((p) => p.rating);

  const fixedPoints = new Array(n).fill(0);
  const currentPoints = new Array(n).fill(0);
  const playedGames: SettledGame[] = [];
  const remainingGames: CompactGame[] = [];
  const playedRounds = new Set<number>();

  for (const round of section.rounds) {
    for (const g of round.games) {
      const w = index.get(g.white)!;
      const b = index.get(g.black)!;
      if (g.result) {
        const [wp, bp] = gamePoints(g.result);
        currentPoints[w] += wp;
        currentPoints[b] += bp;
        playedRounds.add(round.number);
        if (mode === "live") {
          fixedPoints[w] += wp;
          fixedPoints[b] += bp;
          playedGames.push({ w, b, wp, bp });
        } else {
          remainingGames.push({ w, b }); // pretournament: re-simulate everything
        }
      } else {
        remainingGames.push({ w, b });
      }
    }
  }

  return {
    n,
    ids,
    ratings,
    fixedPoints,
    playedGames,
    remainingGames,
    currentPoints,
    roundsPlayed: playedRounds.size,
  };
}

// --- Accumulator (lets the run be chunked across animation frames) ---------

export interface Accumulator {
  n: number;
  iterations: number;
  winCount: number[];
  podiumCount: number[];
  placeCount: number[][]; // [player][place]
  sumPoints: number[];
  sumPointsSq: number[];
  sumRank: number[];
  minPoints: number[];
  maxPoints: number[];
}

export function createAccumulator(n: number): Accumulator {
  return {
    n,
    iterations: 0,
    winCount: new Array(n).fill(0),
    podiumCount: new Array(n).fill(0),
    placeCount: Array.from({ length: n }, () => new Array(n).fill(0)),
    sumPoints: new Array(n).fill(0),
    sumPointsSq: new Array(n).fill(0),
    sumRank: new Array(n).fill(0),
    minPoints: new Array(n).fill(Infinity),
    maxPoints: new Array(n).fill(-Infinity),
  };
}

/**
 * Run `count` Monte Carlo iterations, mutating `acc`. Kept allocation-light and reentrant so the
 * UI hook can call it in chunks and report progress without freezing the page.
 */
export function runIterations(
  pre: Precomputed,
  params: SimParams,
  count: number,
  acc: Accumulator,
  rng: () => number,
): void {
  const { n, ratings, fixedPoints, playedGames, remainingGames } = pre;

  const strength = new Array(n);
  const pts = new Array(n);
  const wins = new Array(n); // decisive classical wins (3-pointers), a tiebreak proxy
  const sb = new Array(n); // Sonneborn-Berger-style score
  const order = new Array(n);
  // Reusable buffer of settled games for this iteration (played + simulated).
  const games: SettledGame[] = [];

  for (let it = 0; it < count; it++) {
    // 1. Sample each player's "form" for the event.
    for (let i = 0; i < n; i++) {
      strength[i] = ratings[i] + gaussian(rng) * params.ratingSD;
      pts[i] = fixedPoints[i];
      wins[i] = 0;
    }

    games.length = 0;
    for (let g = 0; g < playedGames.length; g++) games.push(playedGames[g]);

    // 2. Simulate the remaining games.
    for (let g = 0; g < remainingGames.length; g++) {
      const { w, b } = remainingGames[g];
      const cp = classicalProbs(strength[w], strength[b], params);
      const u = rng();
      let wp: number;
      let bp: number;
      if (u < cp.pWhiteWin) {
        wp = 3;
        bp = 0;
      } else if (u < cp.pWhiteWin + cp.pDraw) {
        const aw = armageddonWhiteWinProb(strength[w], strength[b], params);
        if (rng() < aw) {
          wp = 1.5;
          bp = 1;
        } else {
          wp = 1;
          bp = 1.5;
        }
      } else {
        wp = 0;
        bp = 3;
      }
      pts[w] += wp;
      pts[b] += bp;
      games.push({ w, b, wp, bp });
    }

    // 3. Tiebreak inputs: decisive wins + Sonneborn-Berger over final point totals.
    for (let i = 0; i < n; i++) sb[i] = 0;
    for (let g = 0; g < games.length; g++) {
      const { w, b, wp, bp } = games[g];
      if (wp === 3) wins[w]++;
      if (bp === 3) wins[b]++;
      sb[w] += wp * pts[b];
      sb[b] += bp * pts[w];
    }

    // 4. Rank. Order: points, then Sonneborn-Berger, then decisive wins, then sampled
    //    strength (approximates the stronger player edge in a playoff for ties).
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((x: number, y: number) => {
      if (pts[y] !== pts[x]) return pts[y] - pts[x];
      if (sb[y] !== sb[x]) return sb[y] - sb[x];
      if (wins[y] !== wins[x]) return wins[y] - wins[x];
      return strength[y] - strength[x];
    });

    // 5. Tally.
    for (let place = 0; place < n; place++) {
      const i = order[place];
      acc.placeCount[i][place]++;
      acc.sumRank[i] += place + 1;
      if (place === 0) acc.winCount[i]++;
      if (place < 3) acc.podiumCount[i]++;
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      acc.sumPoints[i] += p;
      acc.sumPointsSq[i] += p * p;
      if (p < acc.minPoints[i]) acc.minPoints[i] = p;
      if (p > acc.maxPoints[i]) acc.maxPoints[i] = p;
    }
  }

  acc.iterations += count;
}

export function finalize(
  acc: Accumulator,
  pre: Precomputed,
  section: Section,
  mode: SimMode,
  totalRounds: number,
): SimResult {
  const it = acc.iterations || 1;
  const players = section.players.map((player, i) => {
    const mean = acc.sumPoints[i] / it;
    const variance = Math.max(0, acc.sumPointsSq[i] / it - mean * mean);
    return {
      id: player.id,
      winProb: acc.winCount[i] / it,
      podiumProb: acc.podiumCount[i] / it,
      placeProbs: acc.placeCount[i].map((c) => c / it),
      expPoints: mean,
      pointsSd: Math.sqrt(variance),
      minPoints: acc.minPoints[i] === Infinity ? 0 : acc.minPoints[i],
      maxPoints: acc.maxPoints[i] === -Infinity ? 0 : acc.maxPoints[i],
      expRank: acc.sumRank[i] / it,
      currentPoints: pre.currentPoints[i],
    };
  });

  return {
    players,
    iterations: acc.iterations,
    roundsPlayed: pre.roundsPlayed,
    totalRounds,
    gamesRemaining: pre.remainingGames.length,
    mode,
  };
}

/** Convenience: run a whole simulation in one shot (used for tests / non-chunked callers). */
export function simulate(
  section: Section,
  params: SimParams,
  mode: SimMode,
  seed: number,
): SimResult {
  const pre = precompute(section, mode);
  const acc = createAccumulator(pre.n);
  runIterations(pre, params, params.iterations, acc, mulberry32(seed));
  return finalize(acc, pre, section, mode, section.rounds.length);
}

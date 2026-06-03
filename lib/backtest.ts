// Calibration backtest for the Norway Chess game model.
//
// "Is the model good enough" is an empirical question, not an opinion: of all the games it
// called "60% White", did White actually score ~60%? This module scores the model's per-game
// predictions against real, known outcomes using proper scoring rules (Brier, log loss),
// reliability (calibration) buckets, base-rate baselines, and aggregate moment checks. It also
// does a coarse parameter fit so we can see what the data itself suggests.
//
// Two prediction targets, scored separately:
//   classical  - the 3-way W/D/L outcome from predictClassical
//   armageddon - the binary White-wins outcome (only on classical draws) from predictArmageddonWhiteWin
//
// Predictions are FORM-MARGINALISED: the live engine samples a per-event form rating
// (rating + N(0, ratingSD)) before each game, so the honest single-game prediction integrates
// over that form prior. With formSamples = 0 we use the bare point prediction instead.

import {
  mulberry32,
  predictArmageddonWhiteWin,
  predictClassical,
} from "./sim";
import type { SimParams } from "./types";

export interface HistGame {
  event: string;
  section: string;
  round?: number;
  white: string;
  black: string;
  whiteRating: number;
  blackRating: number;
  classical: "white" | "draw" | "black";
  /** Present only when classical === "draw". */
  armageddon?: "white" | "black";
}

const EPS = 1e-12;
const clampP = (x: number) => Math.max(EPS, Math.min(1 - EPS, x));

function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface ClassProbs {
  pWhiteWin: number;
  pDraw: number;
  pBlackWin: number;
}

/** Form-marginalised classical prediction. samples<=0 returns the bare point prediction. */
export function predictClassicalMarginal(
  rWhite: number,
  rBlack: number,
  params: SimParams,
  samples: number,
  seed: number,
): ClassProbs {
  if (samples <= 0) return predictClassical(rWhite, rBlack, params);
  const rng = mulberry32(seed);
  let w = 0;
  let d = 0;
  let b = 0;
  for (let i = 0; i < samples; i++) {
    const fw = gaussian(rng) * params.ratingSD;
    const fb = gaussian(rng) * params.ratingSD;
    const p = predictClassical(rWhite + fw, rBlack + fb, params);
    w += p.pWhiteWin;
    d += p.pDraw;
    b += p.pBlackWin;
  }
  return { pWhiteWin: w / samples, pDraw: d / samples, pBlackWin: b / samples };
}

/** Form-marginalised probability that White wins the Armageddon. */
export function predictArmageddonMarginal(
  rWhite: number,
  rBlack: number,
  params: SimParams,
  samples: number,
  seed: number,
): number {
  if (samples <= 0) return predictArmageddonWhiteWin(rWhite, rBlack, params);
  const rng = mulberry32(seed);
  let s = 0;
  for (let i = 0; i < samples; i++) {
    const fw = gaussian(rng) * params.ratingSD;
    const fb = gaussian(rng) * params.ratingSD;
    s += predictArmageddonWhiteWin(rWhite + fw, rBlack + fb, params);
  }
  return s / samples;
}

// --- Reliability (calibration) buckets -------------------------------------

export interface Bucket {
  lo: number;
  hi: number;
  n: number;
  predicted: number; // mean predicted probability in the bucket
  observed: number; // observed frequency of the event in the bucket
}

/** Bin (predictedProb, outcome 0/1) pairs into fixed-width buckets; drop empty buckets. */
function reliability(pairs: Array<[number, number]>, width = 0.1): Bucket[] {
  const nb = Math.round(1 / width);
  const out: Bucket[] = [];
  for (let i = 0; i < nb; i++) {
    const lo = i * width;
    const hi = i === nb - 1 ? 1.0000001 : (i + 1) * width;
    let n = 0;
    let sp = 0;
    let so = 0;
    for (const [p, y] of pairs) {
      if (p >= lo && p < hi) {
        n++;
        sp += p;
        so += y;
      }
    }
    if (n > 0) out.push({ lo, hi: Math.min(1, hi), n, predicted: sp / n, observed: so / n });
  }
  return out;
}

/** Expected Calibration Error: n-weighted mean |predicted - observed| over buckets. */
export function ece(buckets: Bucket[]): number {
  const total = buckets.reduce((s, b) => s + b.n, 0) || 1;
  return buckets.reduce((s, b) => s + b.n * Math.abs(b.predicted - b.observed), 0) / total;
}

// --- Classical report ------------------------------------------------------

export interface ClassicalReport {
  n: number;
  brier: number; // multiclass, range 0..2
  logLoss: number;
  baselineBrier: number; // predict the marginal base rates every game
  baselineLogLoss: number;
  skillBrier: number; // 1 - brier/baseline (>0 means better than base rate)
  predictedDrawRate: number;
  observedDrawRate: number;
  predictedWhiteScore: number; // mean of pWhiteWin + 0.5*pDraw
  observedWhiteScore: number; // (wins + 0.5*draws) / n
  drawReliability: Bucket[];
  drawECE: number;
  whiteWinReliability: Bucket[];
  whiteWinECE: number;
}

function oneHot(c: HistGame["classical"]): [number, number, number] {
  return c === "white" ? [1, 0, 0] : c === "draw" ? [0, 1, 0] : [0, 0, 1];
}

export interface BacktestOpts {
  formSamples?: number; // 0 = point prediction; e.g. 300 marginalises over form
  seed?: number;
}

export function backtestClassical(
  games: HistGame[],
  params: SimParams,
  opts: BacktestOpts = {},
): ClassicalReport {
  const samples = opts.formSamples ?? 0;
  const n = games.length;
  let nW = 0;
  let nD = 0;
  let nB = 0;
  for (const g of games) {
    if (g.classical === "white") nW++;
    else if (g.classical === "draw") nD++;
    else nB++;
  }
  const base = [nW / n, nD / n, nB / n];

  let brier = 0;
  let logLoss = 0;
  let bBrier = 0;
  let bLog = 0;
  let predDraw = 0;
  let predWhiteScore = 0;
  const drawPairs: Array<[number, number]> = [];
  const whiteWinPairs: Array<[number, number]> = [];
  let seed = (opts.seed ?? 1000) + 1;

  for (const g of games) {
    const p = predictClassicalMarginal(g.whiteRating, g.blackRating, params, samples, seed++);
    const probs = [p.pWhiteWin, p.pDraw, p.pBlackWin];
    const y = oneHot(g.classical);
    for (let k = 0; k < 3; k++) {
      brier += (probs[k] - y[k]) ** 2;
      logLoss += -y[k] * Math.log(clampP(probs[k]));
      bBrier += (base[k] - y[k]) ** 2;
      bLog += -y[k] * Math.log(clampP(base[k]));
    }
    predDraw += p.pDraw;
    predWhiteScore += p.pWhiteWin + 0.5 * p.pDraw;
    drawPairs.push([p.pDraw, g.classical === "draw" ? 1 : 0]);
    whiteWinPairs.push([p.pWhiteWin, g.classical === "white" ? 1 : 0]);
  }

  const drawRel = reliability(drawPairs);
  const wwRel = reliability(whiteWinPairs);
  return {
    n,
    brier: brier / n,
    logLoss: logLoss / n,
    baselineBrier: bBrier / n,
    baselineLogLoss: bLog / n,
    skillBrier: 1 - brier / bBrier,
    predictedDrawRate: predDraw / n,
    observedDrawRate: nD / n,
    predictedWhiteScore: predWhiteScore / n,
    observedWhiteScore: (nW + 0.5 * nD) / n,
    drawReliability: drawRel,
    drawECE: ece(drawRel),
    whiteWinReliability: wwRel,
    whiteWinECE: ece(wwRel),
  };
}

// --- Armageddon report -----------------------------------------------------

export interface ArmageddonReport {
  n: number;
  brier: number; // binary
  logLoss: number;
  baselineBrier: number; // coin flip (0.5)
  baselineLogLoss: number;
  skillBrier: number;
  predictedWhiteRate: number;
  observedWhiteRate: number;
  reliability: Bucket[];
  ece: number;
}

export function backtestArmageddon(
  games: HistGame[],
  params: SimParams,
  opts: BacktestOpts = {},
): ArmageddonReport {
  const samples = opts.formSamples ?? 0;
  const arm = games.filter((g) => g.classical === "draw" && g.armageddon);
  const n = arm.length;
  let obsWhite = 0;
  let brier = 0;
  let logLoss = 0;
  let bBrier = 0;
  let bLog = 0;
  let pred = 0;
  const pairs: Array<[number, number]> = [];
  let seed = (opts.seed ?? 5000) + 1;

  for (const g of arm) {
    const p = predictArmageddonMarginal(g.whiteRating, g.blackRating, params, samples, seed++);
    const y = g.armageddon === "white" ? 1 : 0;
    obsWhite += y;
    brier += (p - y) ** 2;
    logLoss += -(y * Math.log(clampP(p)) + (1 - y) * Math.log(clampP(1 - p)));
    bBrier += (0.5 - y) ** 2;
    bLog += -(y * Math.log(0.5) + (1 - y) * Math.log(0.5));
    pred += p;
    pairs.push([p, y]);
  }

  const rel = reliability(pairs);
  return {
    n,
    brier: n ? brier / n : 0,
    logLoss: n ? logLoss / n : 0,
    baselineBrier: n ? bBrier / n : 0,
    baselineLogLoss: n ? bLog / n : 0,
    skillBrier: n ? 1 - brier / bBrier : 0,
    predictedWhiteRate: n ? pred / n : 0,
    observedWhiteRate: n ? obsWhite / n : 0,
    reliability: rel,
    ece: ece(rel),
  };
}

// --- Coarse parameter fit --------------------------------------------------
//
// Small data fits overfit, so this is intentionally a coarse grid over the few parameters the
// data can actually inform, scored by log loss. Treat the output as "what the data leans toward",
// not the truth. We fit the classical knobs on all games and the Armageddon knobs on the
// Armageddon subset, independently.

function classicalLogLoss(games: HistGame[], params: SimParams, samples: number): number {
  let s = 0;
  let seed = 7000;
  for (const g of games) {
    const p = predictClassicalMarginal(g.whiteRating, g.blackRating, params, samples, seed++);
    const y = oneHot(g.classical);
    s += -(y[0] * Math.log(clampP(p.pWhiteWin)) + y[1] * Math.log(clampP(p.pDraw)) + y[2] * Math.log(clampP(p.pBlackWin)));
  }
  return s / games.length;
}

function armageddonLogLoss(games: HistGame[], params: SimParams, samples: number): number {
  const arm = games.filter((g) => g.classical === "draw" && g.armageddon);
  let s = 0;
  let seed = 8000;
  for (const g of arm) {
    const p = predictArmageddonMarginal(g.whiteRating, g.blackRating, params, samples, seed++);
    const y = g.armageddon === "white" ? 1 : 0;
    s += -(y * Math.log(clampP(p)) + (1 - y) * Math.log(clampP(1 - p)));
  }
  return arm.length ? s / arm.length : 0;
}

export interface FitResult {
  params: SimParams;
  classicalLogLoss: number;
  armageddonLogLoss: number;
  grid: { whiteAdvantage: number[]; baseDrawRate: number[]; armageddonWhiteAdvantage: number[]; armageddonDamp: number[] };
}

export function fitParams(games: HistGame[], start: SimParams): FitResult {
  const whiteAdvGrid = [0, 10, 20, 30, 40, 50];
  const drawGrid = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
  const armAdvGrid = [-40, -30, -20, -10, 0, 10, 20];
  const armDampGrid = [0.2, 0.35, 0.5, 0.65, 0.8];
  const samples = 0; // point predictions for speed during the grid

  // Classical knobs.
  let best = { ...start };
  let bestLL = Infinity;
  for (const wa of whiteAdvGrid) {
    for (const dr of drawGrid) {
      const cand = { ...start, whiteAdvantage: wa, baseDrawRate: dr };
      const ll = classicalLogLoss(games, cand, samples);
      if (ll < bestLL) {
        bestLL = ll;
        best = cand;
      }
    }
  }

  // Armageddon knobs (on top of the fitted classical params, though they are independent).
  let bestArmLL = Infinity;
  let bestArm = { ...best };
  for (const aa of armAdvGrid) {
    for (const ad of armDampGrid) {
      const cand = { ...best, armageddonWhiteAdvantage: aa, armageddonDamp: ad };
      const ll = armageddonLogLoss(games, cand, samples);
      if (ll < bestArmLL) {
        bestArmLL = ll;
        bestArm = cand;
      }
    }
  }

  return {
    params: bestArm,
    classicalLogLoss: bestLL,
    armageddonLogLoss: bestArmLL,
    grid: {
      whiteAdvantage: whiteAdvGrid,
      baseDrawRate: drawGrid,
      armageddonWhiteAdvantage: armAdvGrid,
      armageddonDamp: armDampGrid,
    },
  };
}

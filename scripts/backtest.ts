// Runs the calibration backtest and prints a report.
//   npx tsx scripts/backtest.ts
//
// Scores the game model's predictions against real results: the verified Norway Chess 2026
// games (through Round 8) plus any validated past editions in data/history.ts.

import {
  backtestArmageddon,
  backtestClassical,
  fitParams,
  type Bucket,
  type HistGame,
} from "@/lib/backtest";
import { SECTIONS } from "@/lib/data";
import { DEFAULT_PARAMS } from "@/lib/sim";
import type { Section, SimParams } from "@/lib/types";
import { HISTORY } from "@/data/history";

const FORM = 400; // form-marginalisation samples per game

function sectionToHistGames(section: Section, eventName: string): HistGame[] {
  const ratingById = new Map(section.players.map((p) => [p.id, p.rating]));
  const out: HistGame[] = [];
  for (const round of section.rounds) {
    for (const g of round.games) {
      if (!g.result) continue;
      out.push({
        event: eventName,
        section: section.id,
        round: round.number,
        white: g.white,
        black: g.black,
        whiteRating: ratingById.get(g.white)!,
        blackRating: ratingById.get(g.black)!,
        classical: g.result.classical,
        armageddon: g.result.classical === "draw" ? g.result.armageddon : undefined,
      });
    }
  }
  return out;
}

const f = (x: number, d = 3) => x.toFixed(d);
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;

function printBuckets(label: string, buckets: Bucket[]) {
  console.log(`  ${label}`);
  if (buckets.length === 0) {
    console.log("    (no data)");
    return;
  }
  console.log("    bucket      n   predicted   observed");
  for (const b of buckets) {
    const range = `${b.lo.toFixed(1)}-${b.hi.toFixed(1)}`.padEnd(9);
    console.log(
      `    ${range} ${String(b.n).padStart(4)}    ${pc(b.predicted).padStart(7)}    ${pc(b.observed).padStart(7)}`,
    );
  }
}

function reportClassical(games: HistGame[], params: SimParams) {
  const r = backtestClassical(games, params, { formSamples: FORM });
  console.log(`CLASSICAL  (n = ${r.n})`);
  console.log(
    `  Brier ${f(r.brier)}  vs base-rate ${f(r.baselineBrier)}  (skill ${pc(r.skillBrier)})   log-loss ${f(r.logLoss)} vs ${f(r.baselineLogLoss)}`,
  );
  console.log(
    `  draw rate:   predicted ${pc(r.predictedDrawRate)}   observed ${pc(r.observedDrawRate)}`,
  );
  console.log(
    `  White score: predicted ${pc(r.predictedWhiteScore)}   observed ${pc(r.observedWhiteScore)}`,
  );
  printBuckets(`P(draw) reliability  (ECE ${f(r.drawECE)})`, r.drawReliability);
  printBuckets(`P(White win) reliability  (ECE ${f(r.whiteWinECE)})`, r.whiteWinReliability);
}

function reportArmageddon(games: HistGame[], params: SimParams) {
  const r = backtestArmageddon(games, params, { formSamples: FORM });
  console.log(`ARMAGEDDON  (n = ${r.n})`);
  if (r.n === 0) {
    console.log("  (no Armageddon games in this set)");
    return;
  }
  console.log(
    `  Brier ${f(r.brier)}  vs coin-flip ${f(r.baselineBrier)}  (skill ${pc(r.skillBrier)})   log-loss ${f(r.logLoss)} vs ${f(r.baselineLogLoss)}`,
  );
  console.log(
    `  White win rate: predicted ${pc(r.predictedWhiteRate)}   observed ${pc(r.observedWhiteRate)}`,
  );
  printBuckets(`P(White wins Armageddon) reliability  (ECE ${f(r.ece)})`, r.reliability);
}

function section(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

// The original hand-set defaults, kept here to show the before/after of recalibration.
const ORIGINAL: SimParams = {
  iterations: 40000,
  whiteAdvantage: 35,
  baseDrawRate: 0.5,
  drawFloor: 0.12,
  ratingSD: 50,
  armageddonWhiteAdvantage: 15,
  armageddonDamp: 0.55,
};

function paramLine(p: SimParams): string {
  return (
    `whiteAdvantage ${p.whiteAdvantage}  baseDrawRate ${p.baseDrawRate}  ` +
    `armageddonWhiteAdvantage ${p.armageddonWhiteAdvantage}  armageddonDamp ${p.armageddonDamp}`
  );
}

function main() {
  const open2026 = sectionToHistGames(SECTIONS.open, "Norway Chess 2026 Open");
  const women2026 = sectionToHistGames(SECTIONS.women, "Norway Chess 2026 Women");
  const games2026 = [...open2026, ...women2026];
  const all = [...HISTORY, ...games2026];

  console.log(
    `Data: 2026 = ${games2026.length} games (${open2026.length} open + ${women2026.length} women); ` +
      `history = ${HISTORY.length} games; total = ${all.length}.`,
  );

  section("ORIGINAL hand-set model  -  all games combined");
  console.log(`params: ${paramLine(ORIGINAL)}\n`);
  reportClassical(all, ORIGINAL);
  console.log();
  reportArmageddon(all, ORIGINAL);

  section("RECALIBRATED defaults  -  all games combined");
  console.log(`params: ${paramLine(DEFAULT_PARAMS)}\n`);
  reportClassical(all, DEFAULT_PARAMS);
  console.log();
  reportArmageddon(all, DEFAULT_PARAMS);

  section("PARAMETER FIT  (coarse grid, log-loss; 'what the data leans toward', overfit-prone)");
  const fit = fitParams(all, ORIGINAL);
  console.log(`fitted: ${paramLine(fit.params)}`);
  console.log(
    `  classical log-loss ${f(fit.classicalLogLoss)}   armageddon log-loss ${f(fit.armageddonLogLoss)}`,
  );
  console.log(
    "  NOTE: the Armageddon fit is unstable - on 2026 alone the grid wants armageddonWhiteAdvantage -40,",
  );
  console.log(
    "  on the pooled set +20. The edge is within noise, so the recalibrated defaults stay near coin-flip.",
  );
  console.log();
}

main();

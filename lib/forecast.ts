// Builds the view-model the almanac renders: for each player, the live and pre-tournament
// forecast plus a genuine round-by-round title-odds trajectory.
//
// The trajectory is real, not faked: for each round cutoff r we re-run the Monte Carlo
// conditioned only on the games played through round r, and read off each player's win
// probability. r = 0 is the pre-tournament projection; r = roundsPlayed is the live forecast.

import { simulate } from "./sim";
import type { Section, SimParams, SimResult } from "./types";

/** Highest round number for which every game has a result (i.e. fully played). */
export function countRoundsPlayed(section: Section): number {
  let played = 0;
  for (const round of section.rounds) {
    if (round.games.length > 0 && round.games.every((g) => g.result)) {
      played = Math.max(played, round.number);
    }
  }
  return played;
}

/** A copy of the section with results kept only for rounds <= r (others become unplayed). */
export function sectionThroughRound(section: Section, r: number): Section {
  return {
    ...section,
    rounds: section.rounds.map((round) =>
      round.number <= r
        ? round
        : { ...round, games: round.games.map((g) => ({ white: g.white, black: g.black })) },
    ),
  };
}

export interface ModeRow {
  win: number; // P(1st), percent
  podium: number; // P(top 3), percent
  dist: number[]; // finishing-place probabilities, percent, index 0 = 1st
  proj: number; // projected final points
  lo: number;
  hi: number;
  pts: number; // actual current points
  traj: number[]; // win% at each round cutoff (Start, R1, ... live)
}

export interface ForecastRow {
  id: string;
  name: string;
  short: string;
  country: string;
  rating: number;
  seed: number; // rating rank within the field, 1 = highest rated
  live: ModeRow;
  pre: ModeRow;
}

export interface Forecast {
  rows: ForecastRow[];
  roundsPlayed: number;
  roundLabels: string[];
  iterations: number;
}

/** Assemble the forecast from per-cutoff simulation results (index r = 0..roundsPlayed). */
export function buildForecast(section: Section, results: SimResult[]): Forecast {
  const roundsPlayed = results.length - 1;
  const live = results[roundsPlayed];
  const pre = results[0];

  const seedByRating = [...section.players]
    .map((p) => p.id)
    .sort((a, b) => {
      const ra = section.players.find((p) => p.id === a)!.rating;
      const rb = section.players.find((p) => p.id === b)!.rating;
      return rb - ra;
    });
  const seedOf = new Map(seedByRating.map((id, i) => [id, i + 1]));

  const rows: ForecastRow[] = section.players.map((p, i) => {
    const mk = (res: SimResult): ModeRow => {
      const r = res.players[i];
      return {
        win: r.winProb * 100,
        podium: r.podiumProb * 100,
        dist: r.placeProbs.map((x) => x * 100),
        proj: r.expPoints,
        lo: Math.max(0, r.expPoints - r.pointsSd),
        hi: r.expPoints + r.pointsSd,
        pts: r.currentPoints,
        traj: results.map((res2) => res2.players[i].winProb * 100),
      };
    };
    return {
      id: p.id,
      name: p.name,
      short: p.short,
      country: p.country,
      rating: p.rating,
      seed: seedOf.get(p.id) ?? i + 1,
      live: mk(live),
      pre: mk(pre),
    };
  });

  const roundLabels = ["Start", ...Array.from({ length: roundsPlayed }, (_, i) => "R" + (i + 1))];
  return { rows, roundsPlayed, roundLabels, iterations: live.iterations };
}

/** Run every cutoff and build the forecast in one shot (used off the main thread / in tests). */
export function computeForecast(section: Section, params: SimParams, seed: number): Forecast {
  const roundsPlayed = countRoundsPlayed(section);
  const results: SimResult[] = [];
  for (let r = 0; r <= roundsPlayed; r++) {
    results.push(simulate(sectionThroughRound(section, r), params, "live", seed));
  }
  return buildForecast(section, results);
}

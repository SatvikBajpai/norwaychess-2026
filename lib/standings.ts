// Helpers to derive the live standings table and the remaining schedule from a section's
// real results. Independent of the Monte Carlo engine.

import { gamePoints } from "./sim";
import type { Pairing, Player, Section } from "./types";

export interface StandingRow {
  player: Player;
  points: number;
  played: number;
  wins: number; // games where the player took the larger share (3 or 1.5)
  losses: number; // games where the player took the smaller share (0 or 1)
}

export function computeStandings(section: Section): StandingRow[] {
  const index = new Map(section.players.map((p, i) => [p.id, i]));
  const rows: StandingRow[] = section.players.map((player) => ({
    player,
    points: 0,
    played: 0,
    wins: 0,
    losses: 0,
  }));

  for (const round of section.rounds) {
    for (const g of round.games) {
      if (!g.result) continue;
      const w = rows[index.get(g.white)!];
      const b = rows[index.get(g.black)!];
      const [wp, bp] = gamePoints(g.result);
      w.points += wp;
      b.points += bp;
      w.played += 1;
      b.played += 1;
      if (wp > bp) {
        w.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        w.losses += 1;
      }
    }
  }

  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export interface RemainingRound {
  number: number;
  date: string;
  games: Pairing[];
}

export function remainingRounds(section: Section): RemainingRound[] {
  return section.rounds
    .filter((r) => r.games.some((g) => !g.result))
    .map((r) => ({
      number: r.number,
      date: r.date,
      games: r.games.filter((g) => !g.result),
    }));
}

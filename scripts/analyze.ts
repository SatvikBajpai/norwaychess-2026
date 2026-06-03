// Per-edition aggregate check: draw rate and the rate at which the CLASSICAL White player
// won the Armageddon. A stable draw rate across editions makes baseDrawRate easy to trust;
// a flipping Armageddon-White rate would mean the Armageddon colour / draw-odds rule changed
// between editions, so those editions must not be pooled for the Armageddon model.
//   npx tsx scripts/analyze.ts

import { HISTORY } from "@/data/history";
import type { HistGame } from "@/lib/backtest";
import { SECTIONS } from "@/lib/data";
import type { Section } from "@/lib/types";

function sectionGames(section: Section, name: string): HistGame[] {
  const r = new Map(section.players.map((p) => [p.id, p.rating]));
  const out: HistGame[] = [];
  for (const round of section.rounds)
    for (const g of round.games)
      if (g.result)
        out.push({
          event: name,
          section: section.id,
          white: g.white,
          black: g.black,
          whiteRating: r.get(g.white)!,
          blackRating: r.get(g.black)!,
          classical: g.result.classical,
          armageddon: g.result.classical === "draw" ? g.result.armageddon : undefined,
        });
  return out;
}

const all: HistGame[] = [
  ...HISTORY,
  ...sectionGames(SECTIONS.open, "Norway Chess 2026 open"),
  ...sectionGames(SECTIONS.women, "Norway Chess 2026 women"),
];

const byEvent = new Map<string, HistGame[]>();
for (const g of all) {
  const k = g.event;
  if (!byEvent.has(k)) byEvent.set(k, []);
  byEvent.get(k)!.push(g);
}

const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log("event                              n   draws   drawRate   armN   classW-wins-Arm");
for (const [event, games] of [...byEvent.entries()].sort()) {
  const n = games.length;
  const draws = games.filter((g) => g.classical === "draw").length;
  const arm = games.filter((g) => g.armageddon);
  const armW = arm.filter((g) => g.armageddon === "white").length;
  console.log(
    `${event.padEnd(34)} ${String(n).padStart(3)}  ${String(draws).padStart(5)}   ${pc(draws / n).padStart(7)}   ${String(arm.length).padStart(4)}   ${arm.length ? pc(armW / arm.length) : "-"}`,
  );
}

const arm = all.filter((g) => g.armageddon);
const armW = arm.filter((g) => g.armageddon === "white").length;
console.log(
  `\nALL  n=${all.length}  drawRate=${pc(all.filter((g) => g.classical === "draw").length / all.length)}  ` +
    `armN=${arm.length}  classW-wins-Arm=${arm.length ? pc(armW / arm.length) : "-"}`,
);

// Structural sanity: within each event no ordered (white, black) pair should repeat, and in a
// double round-robin every player should have equal White and Black counts. Standings
// reconstruction is colour-blind, so this is what catches a swapped-colour data error.
let warnings = 0;
for (const [event, games] of byEvent.entries()) {
  const seen = new Set<string>();
  const wc = new Map<string, number>();
  const bc = new Map<string, number>();
  for (const g of games) {
    const key = `${g.white}>${g.black}`;
    if (seen.has(key)) {
      console.log(`  WARN ${event}: duplicate colour pairing ${key}`);
      warnings++;
    }
    seen.add(key);
    wc.set(g.white, (wc.get(g.white) ?? 0) + 1);
    bc.set(g.black, (bc.get(g.black) ?? 0) + 1);
  }
  const players = new Set([...wc.keys(), ...bc.keys()]);
  const isDoubleRR = games.length === players.size * (players.size - 1);
  if (isDoubleRR) {
    for (const p of players) {
      if ((wc.get(p) ?? 0) !== (bc.get(p) ?? 0)) {
        console.log(`  WARN ${event}: ${p} ${wc.get(p) ?? 0}W/${bc.get(p) ?? 0}B (double RR expects equal)`);
        warnings++;
      }
    }
  }
}
console.log(
  warnings
    ? `\n${warnings} structural warning(s).`
    : "\nStructural checks passed: no duplicate pairings; double-RR colours balanced.",
);

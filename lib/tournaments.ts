// Tournament almanac config. The whole sheet re-derives from these shapes, so adding a
// tournament later is just dropping in an entry that points at its section data.

import { SECTIONS } from "./data";
import type { Section } from "./types";

export interface EventMeta {
  id: string;
  label: string;
  accent: string;
  accentInk: string;
  section: Section;
}

export interface TournamentMeta {
  id: string;
  name: string;
  edition: string;
  city: string;
  venue: string;
  dates: string;
  folioNo: string;
  format: string;
  formatShort: string;
  fieldSize: number;
  roundsTotal: number;
  /** [label, points] rows for the scoring colophon. */
  scoring: [string, string][];
  /** Trailing clause appended to the methodology sentence. */
  methodology: string;
  events: EventMeta[];
}

export const NORWAY_2026: TournamentMeta = {
  id: "norway",
  name: "Norway Chess",
  edition: "2026",
  city: "Oslo",
  venue: "Oslo, Norway",
  dates: "25 May - 5 Jun",
  folioNo: "No. 14",
  format: "Double Round-Robin",
  formatShort: "6 players · double RR",
  fieldSize: 6,
  roundsTotal: 10,
  scoring: [
    ["Classical win", "3 pts"],
    ["Armageddon win", "1½ pts"],
    ["Armageddon loss", "1 pt"],
    ["Classical loss", "0 pts"],
  ],
  methodology: ", with Norway Chess's decisive-Armageddon tie-break honoured in every drawn classical",
  events: [
    { id: "open", label: "Open", accent: "#b23a25", accentInk: "#7e2716", section: SECTIONS.open },
    { id: "women", label: "Women's", accent: "#2b4c7e", accentInk: "#223a61", section: SECTIONS.women },
  ],
};

export const TOURNAMENTS: TournamentMeta[] = [NORWAY_2026];

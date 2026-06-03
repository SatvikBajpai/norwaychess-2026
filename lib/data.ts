// Norway Chess 2026 dataset.
//
// Field, FIDE ratings, full double round-robin schedule (colours included) and every
// game result through Round 8 for both the Open and Women's sections.
//
// Results are encoded as { classical, armageddon }:
//   classical "white"/"black"  -> decisive classical game (3-0)
//   classical "draw"           -> classical drawn, then Armageddon:
//        armageddon "white"    -> White won Armageddon (1.5 - 1)
//        armageddon "black"    -> Black won Armageddon (a drawn Armageddon counts as a Black win)
//
// This file is the single source of truth. To update the live forecast as new rounds are
// played, just fill in the `result` for the relevant pairing below and the app re-simulates.
//
// Verified: recomputing standings from these games reproduces the official tables exactly
// (Open after R8: So 14, Firouzja 13, Pragg 12, Keymer 10, Carlsen 9, Gukesh 8;
//  Women after R8: Assaubayeva 15.5, Muzychuk 10.5, Divya 10, Zhu 10, Ju 9, Humpy 8).

import type { Player, Round, Section } from "./types";

const W = "white" as const;
const B = "black" as const;
const D = "draw" as const;

// --- Open section ---------------------------------------------------------

const openPlayers: Player[] = [
  { id: "carlsen", name: "Magnus Carlsen", short: "Carlsen", rating: 2840, country: "NOR" },
  { id: "firouzja", name: "Alireza Firouzja", short: "Firouzja", rating: 2759, country: "FRA" },
  { id: "keymer", name: "Vincent Keymer", short: "Keymer", rating: 2759, country: "GER" },
  { id: "so", name: "Wesley So", short: "So", rating: 2754, country: "USA" },
  { id: "pragg", name: "R Praggnanandhaa", short: "Praggnanandhaa", rating: 2733, country: "IND" },
  { id: "gukesh", name: "Gukesh Dommaraju", short: "Gukesh", rating: 2732, country: "IND" },
];

const openRounds: Round[] = [
  {
    number: 1,
    date: "2026-05-25",
    games: [
      { white: "so", black: "pragg", result: { classical: D, armageddon: B } },
      { white: "firouzja", black: "carlsen", result: { classical: W } },
      { white: "gukesh", black: "keymer", result: { classical: D, armageddon: W } },
    ],
  },
  {
    number: 2,
    date: "2026-05-26",
    games: [
      { white: "carlsen", black: "keymer", result: { classical: D, armageddon: W } },
      { white: "so", black: "gukesh", result: { classical: D, armageddon: W } },
      { white: "firouzja", black: "pragg", result: { classical: W } },
    ],
  },
  {
    number: 3,
    date: "2026-05-27",
    games: [
      { white: "pragg", black: "carlsen", result: { classical: W } },
      { white: "gukesh", black: "firouzja", result: { classical: D, armageddon: B } },
      { white: "keymer", black: "so", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 4,
    date: "2026-05-28",
    games: [
      { white: "gukesh", black: "carlsen", result: { classical: B } },
      { white: "keymer", black: "pragg", result: { classical: D, armageddon: B } },
      { white: "so", black: "firouzja", result: { classical: D, armageddon: W } },
    ],
  },
  {
    number: 5,
    date: "2026-05-30",
    games: [
      { white: "carlsen", black: "so", result: { classical: B } },
      { white: "firouzja", black: "keymer", result: { classical: D, armageddon: W } },
      { white: "pragg", black: "gukesh", result: { classical: B } },
    ],
  },
  {
    number: 6,
    date: "2026-05-31",
    games: [
      { white: "carlsen", black: "firouzja", result: { classical: W } },
      // Colours reversed from the first-cycle R1 pairing (double round-robin second cycle
      // mirrors colours); the source listed So with White twice vs Pragg, which is impossible.
      // So won the game either way; this does not affect standings or the live forecast.
      { white: "pragg", black: "so", result: { classical: B } },
      { white: "keymer", black: "gukesh", result: { classical: W } },
    ],
  },
  {
    number: 7,
    date: "2026-06-01",
    games: [
      { white: "keymer", black: "carlsen", result: { classical: D, armageddon: B } },
      { white: "gukesh", black: "so", result: { classical: D, armageddon: W } },
      { white: "pragg", black: "firouzja", result: { classical: W } },
    ],
  },
  {
    number: 8,
    date: "2026-06-02",
    games: [
      { white: "carlsen", black: "pragg", result: { classical: B } },
      { white: "firouzja", black: "gukesh", result: { classical: W } },
      { white: "so", black: "keymer", result: { classical: D, armageddon: W } },
    ],
  },
  {
    number: 9,
    date: "2026-06-04",
    games: [
      { white: "so", black: "carlsen" },
      { white: "keymer", black: "firouzja" },
      { white: "gukesh", black: "pragg" },
    ],
  },
  {
    number: 10,
    date: "2026-06-05",
    games: [
      { white: "carlsen", black: "gukesh" },
      { white: "pragg", black: "keymer" },
      { white: "firouzja", black: "so" },
    ],
  },
];

// --- Women's section ------------------------------------------------------

const womenPlayers: Player[] = [
  { id: "ju", name: "Ju Wenjun", short: "Ju Wenjun", rating: 2559, country: "CHN" },
  { id: "zhu", name: "Zhu Jiner", short: "Zhu Jiner", rating: 2546, country: "CHN" },
  { id: "humpy", name: "Koneru Humpy", short: "Humpy", rating: 2535, country: "IND" },
  { id: "assaubayeva", name: "Bibisara Assaubayeva", short: "Assaubayeva", rating: 2527, country: "KAZ" },
  { id: "muzychuk", name: "Anna Muzychuk", short: "Muzychuk", rating: 2522, country: "UKR" },
  { id: "divya", name: "Divya Deshmukh", short: "Divya", rating: 2500, country: "IND" },
];

const womenRounds: Round[] = [
  {
    number: 1,
    date: "2026-05-25",
    games: [
      { white: "assaubayeva", black: "humpy", result: { classical: W } },
      { white: "ju", black: "divya", result: { classical: D, armageddon: B } },
      { white: "muzychuk", black: "zhu", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 2,
    date: "2026-05-26",
    games: [
      { white: "zhu", black: "assaubayeva", result: { classical: D, armageddon: B } },
      { white: "divya", black: "humpy", result: { classical: D, armageddon: W } },
      { white: "muzychuk", black: "ju", result: { classical: D, armageddon: W } },
    ],
  },
  {
    number: 3,
    date: "2026-05-27",
    games: [
      { white: "ju", black: "zhu", result: { classical: D, armageddon: B } },
      { white: "humpy", black: "muzychuk", result: { classical: D, armageddon: B } },
      { white: "assaubayeva", black: "divya", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 4,
    date: "2026-05-28",
    games: [
      { white: "humpy", black: "zhu", result: { classical: D, armageddon: B } },
      { white: "assaubayeva", black: "ju", result: { classical: D, armageddon: W } },
      { white: "divya", black: "muzychuk", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 5,
    date: "2026-05-30",
    games: [
      { white: "zhu", black: "divya", result: { classical: B } },
      { white: "muzychuk", black: "assaubayeva", result: { classical: D, armageddon: W } },
      { white: "ju", black: "humpy", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 6,
    date: "2026-05-31",
    games: [
      { white: "zhu", black: "muzychuk", result: { classical: D, armageddon: W } },
      { white: "divya", black: "ju", result: { classical: B } },
      // Colours reversed from R1 (see the Open R6 note); Assaubayeva won the Armageddon either way.
      { white: "humpy", black: "assaubayeva", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 7,
    date: "2026-06-01",
    games: [
      { white: "assaubayeva", black: "zhu", result: { classical: W } },
      { white: "humpy", black: "divya", result: { classical: D, armageddon: B } },
      { white: "ju", black: "muzychuk", result: { classical: D, armageddon: B } },
    ],
  },
  {
    number: 8,
    date: "2026-06-02",
    games: [
      { white: "zhu", black: "ju", result: { classical: W } },
      { white: "muzychuk", black: "humpy", result: { classical: D, armageddon: B } },
      { white: "divya", black: "assaubayeva", result: { classical: B } },
    ],
  },
  {
    number: 9,
    date: "2026-06-04",
    games: [
      { white: "divya", black: "zhu" },
      { white: "assaubayeva", black: "muzychuk" },
      { white: "humpy", black: "ju" },
    ],
  },
  {
    number: 10,
    date: "2026-06-05",
    games: [
      { white: "zhu", black: "humpy" },
      { white: "ju", black: "assaubayeva" },
      { white: "muzychuk", black: "divya" },
    ],
  },
];

export const SECTIONS: Record<string, Section> = {
  open: { id: "open", name: "Open", players: openPlayers, rounds: openRounds },
  women: { id: "women", name: "Women's", players: womenPlayers, rounds: womenRounds },
};

export const SECTION_LIST: Section[] = [SECTIONS.open, SECTIONS.women];

/** Last completed round across the dataset (used for "data through Round N" labels). */
export const DATA_THROUGH_ROUND = 8;

export const FLAGS: Record<string, string> = {
  NOR: "🇳🇴",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  USA: "🇺🇸",
  IND: "🇮🇳",
  CHN: "🇨🇳",
  KAZ: "🇰🇿",
  UKR: "🇺🇦",
};

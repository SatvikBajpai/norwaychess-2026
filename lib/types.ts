// Core domain types for the Norway Chess 2026 simulator.

export type SectionId = "open" | "women";

export type SimMode = "live" | "pretournament";

/** Who won the classical game (or whether it was drawn). */
export type ClassicalResult = "white" | "draw" | "black";

/** Who won the Armageddon tiebreak (only set when the classical game was drawn). */
export type ArmageddonWinner = "white" | "black";

export interface GameResult {
  classical: ClassicalResult;
  /** Present iff `classical === "draw"`. In Armageddon a drawn game counts as a Black win (draw odds). */
  armageddon?: ArmageddonWinner;
}

export interface Player {
  id: string;
  name: string;
  short: string;
  rating: number;
  country: string; // ISO-ish code used for the flag emoji
}

export interface Pairing {
  white: string; // player id
  black: string; // player id
  /** Present once the game has been played. */
  result?: GameResult;
}

export interface Round {
  number: number;
  date: string;
  games: Pairing[];
}

export interface Section {
  id: SectionId;
  name: string;
  players: Player[];
  rounds: Round[];
}

export interface SimParams {
  iterations: number;
  /** Elo bonus applied to the player with the White pieces in classical games. */
  whiteAdvantage: number;
  /** Baseline classical draw rate before rating-gap dampening. */
  baseDrawRate: number;
  /** Lower bound on the classical draw probability. */
  drawFloor: number;
  /** Per-iteration "form" noise: each player's strength is rating + N(0, ratingSD). */
  ratingSD: number;
  /** Elo bonus for White in the Armageddon game (White has more time; Black has draw odds). */
  armageddonWhiteAdvantage: number;
  /** How strongly rating matters in Armageddon (0 = pure coin flip, 1 = full Elo curve). */
  armageddonDamp: number;
}

export interface PlayerSimResult {
  id: string;
  winProb: number; // P(finish 1st)
  podiumProb: number; // P(finish top 3)
  placeProbs: number[]; // length = nPlayers, P(finish in place k), index 0 = 1st
  expPoints: number;
  pointsSd: number;
  minPoints: number;
  maxPoints: number;
  expRank: number; // average finishing rank, 1-based
  currentPoints: number; // actual points already on the board
}

export interface SimResult {
  players: PlayerSimResult[]; // same order as section.players
  iterations: number;
  roundsPlayed: number;
  totalRounds: number;
  gamesRemaining: number;
  mode: SimMode;
}

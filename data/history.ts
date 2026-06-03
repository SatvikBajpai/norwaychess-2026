// Past Norway Chess editions, used as out-of-sample backtest data.
//
// Each game is one data point: ratings at event start, the classical result, and (if the
// classical was drawn) who won the Armageddon. Only editions whose per-game results were
// validated against the official final standings are included. Populated from gathered data;
// see CALIBRATION.md for sources and the validation method.

import type { HistGame } from "@/lib/backtest";

export const HISTORY: HistGame[] = [];

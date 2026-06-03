"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildForecast,
  countRoundsPlayed,
  sectionThroughRound,
  type Forecast,
} from "@/lib/forecast";
import { simulate } from "@/lib/sim";
import type { Section, SimParams } from "@/lib/types";

interface State {
  forecast: Forecast | null;
  running: boolean;
  progress: number;
}

/**
 * Computes the full forecast (live + pre + round-by-round trajectory) for a section, running one
 * round-cutoff simulation per timeout so the main thread stays responsive. Re-runs when the
 * section, params or seed change.
 */
export function useForecast(section: Section, params: SimParams, seed: number): State {
  const [state, setState] = useState<State>({ forecast: null, running: true, progress: 0 });
  const runId = useRef(0);

  useEffect(() => {
    const myRun = ++runId.current;
    const roundsPlayed = countRoundsPlayed(section);
    const total = roundsPlayed + 1;
    const results = new Array(total);
    let r = 0;

    setState({ forecast: null, running: true, progress: 0 });

    const step = () => {
      if (myRun !== runId.current) return;
      results[r] = simulate(sectionThroughRound(section, r), params, "live", seed);
      r++;
      if (r >= total) {
        setState({ forecast: buildForecast(section, results), running: false, progress: 1 });
      } else {
        setState((s) => ({ ...s, progress: r / total }));
        setTimeout(step, 0);
      }
    };

    setTimeout(step, 0);
    return () => {
      runId.current++;
    };
  }, [section, params, seed]);

  return state;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Accumulator,
  createAccumulator,
  finalize,
  mulberry32,
  precompute,
  runIterations,
} from "@/lib/sim";
import type { Section, SimMode, SimParams, SimResult } from "@/lib/types";

interface SimState {
  result: SimResult | null;
  running: boolean;
  progress: number; // 0..1
}

const CHUNK = 4000;

/**
 * Runs the Monte Carlo simulation in chunks across timeouts so the main thread stays
 * responsive and we can animate a progress bar. Re-runs automatically whenever the section,
 * mode, params or seed change.
 */
export function useSimulation(
  section: Section,
  mode: SimMode,
  params: SimParams,
  seed: number,
): SimState {
  const [state, setState] = useState<SimState>({
    result: null,
    running: true,
    progress: 0,
  });
  const runId = useRef(0);

  const run = useCallback(() => {
    const myRun = ++runId.current;
    const pre = precompute(section, mode);
    const acc: Accumulator = createAccumulator(pre.n);
    const rng = mulberry32(seed || 1);
    const total = Math.max(1, Math.floor(params.iterations));
    let done = 0;

    setState({ result: null, running: true, progress: 0 });

    const step = () => {
      if (myRun !== runId.current) return; // a newer run superseded this one
      const n = Math.min(CHUNK, total - done);
      runIterations(pre, params, n, acc, rng);
      done += n;

      if (done >= total) {
        const result = finalize(acc, pre, section, mode, section.rounds.length);
        setState({ result, running: false, progress: 1 });
      } else {
        setState((s) => ({ ...s, progress: done / total }));
        setTimeout(step, 0);
      }
    };

    setTimeout(step, 0);
  }, [section, mode, params, seed]);

  useEffect(() => {
    run();
    return () => {
      runId.current++; // cancel in-flight run on unmount / dependency change
    };
  }, [run]);

  return state;
}

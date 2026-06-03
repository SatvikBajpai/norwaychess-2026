"use client";

import { useMemo, useState } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { DATA_THROUGH_ROUND, FLAGS, SECTIONS } from "@/lib/data";
import { computeStandings, remainingRounds } from "@/lib/standings";
import { DEFAULT_PARAMS } from "@/lib/sim";
import { colorFor, fmtPoints, PLACE_LABELS, pct, pct0 } from "@/lib/ui";
import type {
  Player,
  Section,
  SectionId,
  SimMode,
  SimParams,
  SimResult,
} from "@/lib/types";

const ITERATION_OPTIONS = [10000, 40000, 100000, 200000];

export default function Home() {
  const [sectionId, setSectionId] = useState<SectionId>("open");
  const [mode, setMode] = useState<SimMode>("live");
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [seed, setSeed] = useState(12345);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const section = SECTIONS[sectionId];
  const { result, running, progress } = useSimulation(section, mode, params, seed);

  const playerById = useMemo(
    () => new Map(section.players.map((p) => [p.id, p])),
    [section],
  );

  function setParam(key: keyof SimParams, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="board-bg min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Header />

        <Controls
          sectionId={sectionId}
          onSection={setSectionId}
          mode={mode}
          onMode={setMode}
          params={params}
          onIterations={(n) => setParam("iterations", n)}
          onReroll={() => setSeed((s) => (s * 1103515245 + 12345) & 0x7fffffff)}
          running={running}
          progress={progress}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onParam={setParam}
          onResetParams={() => setParams(DEFAULT_PARAMS)}
        />

        {result ? (
          <>
            <StatusLine result={result} section={section} mode={mode} />
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="flex flex-col gap-5 lg:col-span-2">
                <ChampionBoard
                  result={result}
                  playerById={playerById}
                  mode={mode}
                />
                <PlaceHeatmap result={result} playerById={playerById} />
              </div>
              <div className="flex flex-col gap-5">
                {mode === "live" && (
                  <StandingsPanel section={section} result={result} />
                )}
                <SchedulePanel section={section} playerById={playerById} />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-10 text-center text-muted">Simulating…</div>
        )}

        <Methodology />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Header() {
  return (
    <header className="border-b border-border pb-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gold">
        <span>♞</span>
        <span>Norway Chess 2026 · Oslo · 25 May – 5 June</span>
      </div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Championship Simulator
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Monte Carlo title odds for both the Open and Women&apos;s events, modelling
        Norway Chess&apos;s Armageddon scoring (classical win = 3; drawn classical goes
        to Armageddon, split 1.5 / 1). Switch between a live forecast conditioned on the
        games already played and a from-scratch pre-tournament projection.
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------

interface ControlsProps {
  sectionId: SectionId;
  onSection: (id: SectionId) => void;
  mode: SimMode;
  onMode: (m: SimMode) => void;
  params: SimParams;
  onIterations: (n: number) => void;
  onReroll: () => void;
  running: boolean;
  progress: number;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onParam: (key: keyof SimParams, value: number) => void;
  onResetParams: () => void;
}

function Controls(p: ControlsProps) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-panel p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Field label="Section">
          <Segmented
            options={[
              { value: "open", label: "Open" },
              { value: "women", label: "Women's" },
            ]}
            value={p.sectionId}
            onChange={(v) => p.onSection(v as SectionId)}
          />
        </Field>

        <Field label="Mode">
          <Segmented
            options={[
              { value: "live", label: "Live forecast" },
              { value: "pretournament", label: "Pre-tournament" },
            ]}
            value={p.mode}
            onChange={(v) => p.onMode(v as SimMode)}
          />
        </Field>

        <Field label="Iterations">
          <select
            value={p.params.iterations}
            onChange={(e) => p.onIterations(Number(e.target.value))}
            className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm tnum outline-none focus:border-gold"
          >
            {ITERATION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sampling">
          <button
            onClick={p.onReroll}
            className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm transition-colors hover:border-gold"
          >
            ↻ Re-roll
          </button>
        </Field>

        <button
          onClick={p.onToggleAdvanced}
          className="ml-auto text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          {p.showAdvanced ? "Hide model settings" : "Model settings"}
        </button>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full bg-gold transition-[width] duration-150"
          style={{ width: `${Math.round((p.running ? p.progress : 1) * 100)}%` }}
        />
      </div>

      {p.showAdvanced && (
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Slider
            label="White advantage (Elo)"
            value={p.params.whiteAdvantage}
            min={0}
            max={70}
            step={5}
            onChange={(v) => p.onParam("whiteAdvantage", v)}
          />
          <Slider
            label="Base classical draw rate"
            value={p.params.baseDrawRate}
            min={0.2}
            max={0.8}
            step={0.02}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => p.onParam("baseDrawRate", v)}
          />
          <Slider
            label="Form noise (Elo SD)"
            value={p.params.ratingSD}
            min={0}
            max={120}
            step={5}
            onChange={(v) => p.onParam("ratingSD", v)}
          />
          <Slider
            label="Armageddon White edge (Elo)"
            value={p.params.armageddonWhiteAdvantage}
            min={-30}
            max={60}
            step={5}
            onChange={(v) => p.onParam("armageddonWhiteAdvantage", v)}
          />
          <Slider
            label="Armageddon rating weight"
            value={p.params.armageddonDamp}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => p.onParam("armageddonDamp", v)}
          />
          <div className="flex items-end">
            <button
              onClick={p.onResetParams}
              className="rounded-md border border-border bg-panel-2 px-3 py-1.5 text-sm transition-colors hover:border-gold"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-3 py-1 text-sm transition-colors ${
            value === o.value
              ? "bg-gold font-medium text-black"
              : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tnum text-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-gold"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------

function StatusLine({
  result,
  section,
  mode,
}: {
  result: SimResult;
  section: Section;
  mode: SimMode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        <span className="text-foreground">{section.name}</span> section
      </span>
      <span aria-hidden>·</span>
      {mode === "live" ? (
        <span>
          Conditioned on{" "}
          <span className="text-foreground">Rounds 1–{result.roundsPlayed}</span>{" "}
          · {result.gamesRemaining} games left to simulate
        </span>
      ) : (
        <span>All {result.totalRounds} rounds simulated from ratings</span>
      )}
      <span aria-hidden>·</span>
      <span className="tnum">{result.iterations.toLocaleString()} simulations</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChampionBoard({
  result,
  playerById,
  mode,
}: {
  result: SimResult;
  playerById: Map<string, Player>;
  mode: SimMode;
}) {
  const rows = useMemo(
    () =>
      [...result.players].sort(
        (a, b) => b.winProb - a.winProb || a.expRank - b.expRank,
      ),
    [result],
  );
  const maxWin = Math.max(...rows.map((r) => r.winProb), 0.0001);

  return (
    <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Championship odds
        </h2>
        <span className="text-xs text-muted">probability of finishing 1st</span>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const player = playerById.get(r.id)!;
          const color = colorFor(r.id);
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.4rem_1fr] items-center gap-3 rounded-lg px-1.5 py-2 sm:grid-cols-[1.4rem_minmax(9rem,1fr)_2fr_auto]"
            >
              <span className="tnum text-sm text-muted">{i + 1}</span>

              <div className="flex items-center gap-2 overflow-hidden">
                <span aria-hidden>{FLAGS[player.country]}</span>
                <span className="truncate font-medium">{player.short}</span>
                <span className="hidden text-xs text-muted sm:inline">
                  {player.rating}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <div className="relative h-6 w-full overflow-hidden rounded bg-panel-2">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(r.winProb / maxWin) * 100}%`,
                      backgroundColor: color,
                      opacity: 0.85,
                    }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-foreground tnum">
                    {pct(r.winProb)}
                  </span>
                </div>
              </div>

              <div className="col-span-2 flex items-center justify-between gap-4 text-xs text-muted sm:col-span-1 sm:justify-end">
                <span className="tnum" title="Probability of a top-3 finish">
                  podium {pct0(r.podiumProb)}
                </span>
                <span
                  className="tnum text-foreground"
                  title="Projected final points (mean ± SD)"
                >
                  {fmtPoints(r.expPoints)}
                  <span className="text-muted"> ±{fmtPoints(r.pointsSd)}</span>
                  {mode === "live" && (
                    <span className="ml-1 text-muted">
                      (now {fmtPoints(r.currentPoints)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function PlaceHeatmap({
  result,
  playerById,
}: {
  result: SimResult;
  playerById: Map<string, Player>;
}) {
  const rows = useMemo(
    () => [...result.players].sort((a, b) => a.expRank - b.expRank),
    [result],
  );
  const n = result.players.length;

  return (
    <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Finishing position
        </h2>
        <span className="text-xs text-muted">probability of each final place</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th className="w-32 text-left font-normal text-muted">Player</th>
              {Array.from({ length: n }, (_, k) => (
                <th key={k} className="font-medium text-muted">
                  {PLACE_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const player = playerById.get(r.id)!;
              return (
                <tr key={r.id}>
                  <td className="py-1 text-left">
                    <span className="mr-1.5" aria-hidden>
                      {FLAGS[player.country]}
                    </span>
                    <span className="font-medium">{player.short}</span>
                  </td>
                  {r.placeProbs.map((prob, k) => {
                    const alpha =
                      prob <= 0 ? 0 : Math.min(1, prob * 0.9 + 0.06);
                    const dark = prob > 0.45;
                    return (
                      <td
                        key={k}
                        className="tnum rounded"
                        style={{
                          backgroundColor:
                            prob <= 0
                              ? "var(--panel-2)"
                              : `rgba(233, 185, 73, ${alpha})`,
                          color: dark ? "#1a1205" : "var(--foreground)",
                        }}
                      >
                        <div className="px-1.5 py-1.5">
                          {prob < 0.005 ? "" : `${Math.round(prob * 100)}`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Cells show the percentage chance of finishing in that position (rows sorted by
        expected finish). Brighter = more likely.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------

function StandingsPanel({
  section,
  result,
}: {
  section: Section;
  result: SimResult;
}) {
  const standings = computeStandings(section);
  const winById = new Map(result.players.map((p) => [p.id, p.winProb]));

  return (
    <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        Current standings
      </h2>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Player</th>
            <th className="pb-2 text-right font-medium">Pts</th>
            <th className="pb-2 text-right font-medium">W–L</th>
            <th className="pb-2 text-right font-medium">Win</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.player.id} className="border-t border-border">
              <td className="py-1.5 tnum text-muted">{i + 1}</td>
              <td className="py-1.5">
                <span className="mr-1.5" aria-hidden>
                  {FLAGS[row.player.country]}
                </span>
                {row.player.short}
              </td>
              <td className="py-1.5 text-right tnum font-semibold">
                {fmtPoints(row.points)}
              </td>
              <td className="py-1.5 text-right tnum text-muted">
                {row.wins}–{row.losses}
              </td>
              <td
                className="py-1.5 text-right tnum"
                style={{ color: colorFor(row.player.id) }}
              >
                {pct0(winById.get(row.player.id) ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SchedulePanel({
  section,
  playerById,
}: {
  section: Section;
  playerById: Map<string, Player>;
}) {
  const rounds = remainingRounds(section);
  if (rounds.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Remaining games
        </h2>
        <p className="mt-3 text-sm text-muted">All rounds complete.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        Remaining games
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {rounds.map((round) => (
          <div key={round.number}>
            <div className="text-[11px] uppercase tracking-wider text-muted">
              Round {round.number} · {formatDate(round.date)}
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {round.games.map((g, i) => {
                const w = playerById.get(g.white)!;
                const b = playerById.get(g.black)!;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-panel-2 px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-border bg-white"
                        title="White"
                      />
                      {w.short}
                    </span>
                    <span className="text-xs text-muted">vs</span>
                    <span className="flex items-center gap-1.5">
                      {b.short}
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-border bg-black"
                        title="Black"
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

// ---------------------------------------------------------------------------

function Methodology() {
  return (
    <footer className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted">
      <h2 className="text-sm font-semibold text-foreground">How it works</h2>
      <p className="mt-2 max-w-3xl">
        Each simulation samples a per-event &quot;form&quot; rating for every player
        (FIDE rating plus Gaussian noise), then plays out the remaining games. A classical
        game&apos;s result comes from an Elo expected-score curve with a White advantage and
        a draw probability that is highest in even matchups. When a classical game is drawn,
        an Armageddon game is played using a flatter, higher-variance model (White keeps the
        White pieces and gets more time; Black has draw odds). Points follow Norway Chess
        rules: 3 for a classical win, 1.5 / 1 for the Armageddon, 0 for a classical loss.
      </p>
      <p className="mt-2 max-w-3xl">
        Final standings are ranked by points, then a Sonneborn-Berger-style score, then
        decisive wins, with ties at the top resolved in favour of tournament strength (an
        approximation of the playoff). Data is verified through Round {DATA_THROUGH_ROUND};
        update <code className="text-foreground">lib/data.ts</code> as new results come in.
        This is a model, not a prediction - tweak the parameters under &quot;Model
        settings&quot; to see how sensitive the odds are.
      </p>
    </footer>
  );
}

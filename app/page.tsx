"use client";

import { useMemo, useState } from "react";
import { useForecast } from "@/hooks/useForecast";
import type { Forecast } from "@/lib/forecast";
import { DEFAULT_PARAMS, gamePoints } from "@/lib/sim";
import { TOURNAMENTS } from "@/lib/tournaments";
import type { EventMeta, TournamentMeta } from "@/lib/tournaments";
import type { Section } from "@/lib/types";

// The almanac has no tuning UI, so it runs at a fixed seed and a snappy iteration count
// (nine round-cutoff simulations per event for the genuine trajectory).
const SEED = 20260603;
const ALMANAC_PARAMS = { ...DEFAULT_PARAMS, iterations: 30000 };

type Mode = "live" | "pre";

interface DRow {
  id: string;
  name: string;
  country: string;
  rating: number;
  seed: number;
  dist: number[];
  title: number;
  podium: number;
  proj: number;
  lo: number;
  hi: number;
  pts: number;
  traj: number[];
  delta: number | null;
  modal: number;
}

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const firstName = (n: string) => n.split(" ")[0];
const lastName = (n: string) => n.split(" ").slice(-1)[0];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbaAccent(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${(Math.min(1, Math.max(0, t)) * 0.92).toFixed(3)})`;
}

function buildRows(forecast: Forecast, mode: Mode): DRow[] {
  return forecast.rows
    .map((r) => {
      const m = mode === "live" ? r.live : r.pre;
      return {
        id: r.id,
        name: r.name,
        country: r.country,
        rating: r.rating,
        seed: r.seed,
        dist: m.dist,
        title: m.win,
        podium: m.podium,
        proj: m.proj,
        lo: m.lo,
        hi: m.hi,
        pts: r.live.pts,
        traj: r.live.traj,
        delta: mode === "live" ? Number((r.live.win - r.pre.win).toFixed(1)) : null,
        modal: m.dist.indexOf(Math.max(...m.dist)),
      };
    })
    .sort((a, b) => b.title - a.title || b.proj - a.proj);
}

export default function Home() {
  const [tournamentId, setTournamentId] = useState(TOURNAMENTS[0].id);
  const [eventId, setEventId] = useState(TOURNAMENTS[0].events[0].id);
  const [mode, setMode] = useState<Mode>("live");

  const tournament = TOURNAMENTS.find((t) => t.id === tournamentId) ?? TOURNAMENTS[0];
  const event = tournament.events.find((e) => e.id === eventId) ?? tournament.events[0];
  const live = mode === "live";

  const { forecast, running } = useForecast(event.section, ALMANAC_PARAMS, SEED);
  const rows = useMemo(() => (forecast ? buildRows(forecast, mode) : []), [forecast, mode]);

  function pickTournament(t: TournamentMeta) {
    setTournamentId(t.id);
    setEventId(t.events[0].id);
  }

  const accentStyle = {
    "--accent": event.accent,
    "--accent-ink": event.accentInk,
  } as React.CSSProperties;

  const roundsPlayed = forecast?.roundsPlayed ?? 0;
  const iterations = forecast?.iterations ?? ALMANAC_PARAMS.iterations;
  const status = live ? `Live after Round ${roundsPlayed} of ${tournament.roundsTotal}` : "Pre-tournament projection";

  return (
    <div className="wrap" style={accentStyle}>
      <div className="folio">
        <span>Est. MMXXVI</span>
        <span>A Monte Carlo Tournament Forecast</span>
        <span>
          {tournament.folioNo} · {tournament.city}
        </span>
      </div>

      <div className="nameplate">
        <div className="kick">Gambit&nbsp;·&nbsp;The&nbsp;Almanac</div>
        <h1>The Gambit Forecast</h1>
        <div className="sub">
          <span>
            {tournament.name} {tournament.edition}
          </span>
          <span className="dot" />
          <span>{status}</span>
          <span className="dot" />
          <span>{iterations.toLocaleString()} Simulations</span>
        </div>
      </div>

      <div className="t-tabs">
        {TOURNAMENTS.map((t) => (
          <button
            key={t.id}
            className="t-tab"
            aria-pressed={t.id === tournamentId}
            onClick={() => pickTournament(t)}
          >
            {t.name} {t.edition}
          </button>
        ))}
      </div>

      <div className="deck">
        <div className="tabs">
          {tournament.events.length > 1 ? (
            tournament.events.map((e, i) => (
              <span key={e.id} style={{ display: "flex", alignItems: "center" }}>
                <button className="tab" aria-pressed={e.id === eventId} onClick={() => setEventId(e.id)}>
                  {e.label}
                </button>
                {i < tournament.events.length - 1 && <span className="tabsep" />}
              </span>
            ))
          ) : (
            <span className="tab-static">{tournament.events[0].label}</span>
          )}
        </div>
        <div className="mode-toggle">
          <button aria-pressed={mode === "live"} onClick={() => setMode("live")}>
            Live Forecast
          </button>
          <button aria-pressed={mode === "pre"} onClick={() => setMode("pre")}>
            Pre-Tournament
          </button>
        </div>
      </div>

      {forecast && rows.length > 0 ? (
        <div className={running ? "is-loading" : undefined}>
          <Lead rows={rows} live={live} tournament={tournament} event={event} roundsPlayed={roundsPlayed} iterations={iterations} />

          <div className="sec-head">
            <h3>The Field</h3>
            <div className="note">
              <em>Every contender, ranked by probability of first place</em>
            </div>
          </div>
          <FieldTable rows={rows} live={live} />

          <div className="twoup">
            <div className="col">
              <div className="sec-head">
                <h3>The Race</h3>
                <div className="note">
                  <em>{live ? "Title odds, round by round" : "Odds fixed before play"}</em>
                </div>
              </div>
              <RaceChart rows={rows} live={live} roundLabels={forecast.roundLabels} />
              <p className="race-cap">
                {live
                  ? `Win probability from the eve of the event through Round ${roundsPlayed}; the leader in colour.`
                  : "No games played, so every line holds flat at its pre-tournament value."}
              </p>
            </div>
            <div className="midrule" />
            <div className="col">
              <div className="sec-head">
                <h3>Where They Finish</h3>
                <div className="legend">
                  unlikely
                  <span className="ramp">
                    {[0, 0.18, 0.38, 0.62, 0.9].map((v, i) => (
                      <i key={i} style={{ background: rgbaAccent(event.accent, v) }} />
                    ))}
                  </span>
                  likely
                </div>
              </div>
              <Matrix rows={rows} fieldSize={tournament.fieldSize} accent={event.accent} />
            </div>
          </div>

          <div className="sec-head">
            <h3>The Card</h3>
            <div className="note">
              <em>Round by round, results and remaining fixtures</em>
            </div>
          </div>
          <RoundByRound section={event.section} />

          <div className="sec-head">
            <h3>Projected Finish</h3>
            <div className="note">
              <em>The most likely final classification</em>
            </div>
          </div>
          <ProjectedFinish rows={rows} live={live} />

          <Colophon tournament={tournament} live={live} iterations={iterations} />
        </div>
      ) : (
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)", fontFamily: "var(--font-sans)", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 12 }}>
          Casting the forecast…
        </div>
      )}

      <div className="signoff">
        Calibrated on 258 real games · Not affiliated with any organiser · Gambit Almanac © MMXXVI
      </div>
    </div>
  );
}

function Lead({
  rows,
  live,
  tournament,
  event,
  roundsPlayed,
  iterations,
}: {
  rows: DRow[];
  live: boolean;
  tournament: TournamentMeta;
  event: EventMeta;
  roundsPlayed: number;
  iterations: number;
}) {
  void event;
  const L = rows[0];
  const second = rows[1];
  const N = tournament.fieldSize;
  const dd = rows.filter((r) => r.title >= 10).length;
  const delta = L.delta ?? 0;

  return (
    <section className="lead">
      <div className="lead-num">
        <span className="big tnum">
          {Math.round(L.title)}
          <sup>%</sup>
        </span>
        <div className="cap">Probability of first place</div>
      </div>
      <div className="vr" />
      <div className="lead-body">
        <div className="eyebrow">{live ? "The Front-Runner" : "The Projected Favourite"}</div>
        <h2>{L.name}</h2>
        <div className="lead-meta">
          <b>{L.country}</b> · Rating {L.rating}
          {live ? ` · ${L.pts} points` : ""} · Seed №{L.seed}{" "}
          {live && (
            <span className={`delta ${delta >= 0 ? "up" : "down"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} since start
            </span>
          )}
        </div>
        <p>
          <span className="dropcap">{L.name[0]}</span>
          {live
            ? `${firstName(L.name)} leads after ${roundsPlayed} rounds, first in ${L.title.toFixed(0)}% of ${iterations.toLocaleString()} simulated finishes. ${lastName(second.name)} is the nearest pursuer at ${second.title.toFixed(0)}%.`
            : `Before a move is played, the ratings favour ${firstName(L.name)}, but the field is tight: ${dd} of ${N} hold a double-digit shot at the title.`}
        </p>
        <div className="lead-stats">
          <div className="st">
            <div className="lab">Reach the Podium</div>
            <div className="val tnum">{Math.round(L.podium)}%</div>
          </div>
          <div className="st">
            <div className="lab">Projected Points</div>
            <div className="val tnum">{L.proj.toFixed(1)}</div>
          </div>
          <div className="st">
            <div className="lab">Likeliest Finish</div>
            <div className="val">{ord(L.modal + 1)}</div>
          </div>
        </div>
      </div>
      <div className="stamp">
        <div className="a">{live ? "LIVE" : "PRE"}</div>
        <div className="b">{live ? `Round ${roundsPlayed} / ${tournament.roundsTotal}` : "Before Round 1"}</div>
      </div>
    </section>
  );
}

function FieldTable({ rows, live }: { rows: DRow[]; live: boolean }) {
  const maxWin = Math.max(...rows.map((r) => r.title), 1);
  const maxProj = Math.max(...rows.map((r) => r.hi), 1);
  return (
    <table className="field">
      <thead>
        <tr>
          <th>№</th>
          <th>Player</th>
          <th>Win the Title</th>
          <th className="r">Podium</th>
          <th className="r">Proj. Pts</th>
          <th className="c">{live ? "Movement" : "Finish Range"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={i === 0 ? "leader" : undefined}>
            <td className="rk tnum">{i + 1}</td>
            <td>
              <div className="pl-name">{r.name}</div>
              <div className="pl-sub">
                <span className="flag">{r.country}</span>
                <span>{r.rating}</span>
                {live && (
                  <>
                    <span>·</span>
                    <span>{r.pts} pts</span>
                  </>
                )}
              </div>
            </td>
            <td className="win-cell">
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span className="win-n tnum">
                  {r.title.toFixed(1)}
                  <sup>%</sup>
                </span>
                {live && r.delta != null && (
                  <span className={`delta ${r.delta >= 0 ? "up" : "down"}`}>
                    {r.delta >= 0 ? "▲" : "▼"}
                    {Math.abs(r.delta).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="win-bar">
                <i style={{ width: `${((r.title / maxWin) * 100).toFixed(1)}%` }} />
              </div>
            </td>
            <td className="num r tnum">
              {Math.round(r.podium)}
              <small>%</small>
            </td>
            <td>
              <div className="num r tnum">{r.proj.toFixed(1)}</div>
              <div className="rng tnum">
                {r.lo.toFixed(1)}-{r.hi.toFixed(1)}
              </div>
            </td>
            <td style={{ width: 150, textAlign: "center" }}>
              {live ? <Movement traj={r.traj} /> : <RangeBar r={r} maxProj={maxProj} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Movement({ traj }: { traj: number[] }) {
  const w = 120;
  const h = 30;
  const pad = 4;
  const d = traj.length > 1 ? traj : [traj[0] ?? 0, traj[0] ?? 0];
  const mn = Math.min(...d);
  const mx = Math.max(...d);
  const sp = Math.max(0.5, mx - mn);
  const X = (i: number) => pad + (i / (d.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - pad - ((v - mn) / sp) * (h - pad * 2);
  const pts = d.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" width={w} height={h} style={{ margin: "0 auto", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx={X(d.length - 1)} cy={Y(d[d.length - 1])} r="2.6" fill="var(--accent)" />
    </svg>
  );
}

function RangeBar({ r, maxProj }: { r: DRow; maxProj: number }) {
  const w = 120;
  const h = 30;
  const min = r.lo > 2 ? Math.floor(r.lo) - 1 : 0;
  const max = maxProj * 1.04;
  const sc = (v: number) => Math.max(0, Math.min(w, ((v - min) / (max - min)) * w));
  return (
    <svg className="spark" width={w} height={h} style={{ margin: "0 auto", overflow: "visible" }}>
      <line x1="0" y1="15" x2={w} y2="15" stroke="var(--paper-3)" strokeWidth="5" />
      <line x1={sc(r.lo)} y1="15" x2={sc(r.hi)} y2="15" stroke="var(--ink)" strokeWidth="1.2" />
      <line x1={sc(r.lo)} y1="11" x2={sc(r.lo)} y2="19" stroke="var(--ink)" strokeWidth="1" />
      <line x1={sc(r.hi)} y1="11" x2={sc(r.hi)} y2="19" stroke="var(--ink)" strokeWidth="1" />
      <circle cx={sc(r.proj)} cy="15" r="3.2" fill="var(--accent)" />
    </svg>
  );
}

function RaceChart({ rows, live, roundLabels }: { rows: DRow[]; live: boolean; roundLabels: string[] }) {
  const W = 560;
  const H = 300;
  const pl = 20;
  const prr = 92;
  const pt = 18;
  const pb = 30;
  const pw = W - pl - prr;
  const ph = H - pt - pb;
  const maxT = Math.max(...rows.map((r) => r.title), 1);
  const yMax = Math.max(20, Math.ceil(maxT / 5) * 5);
  const labels = live ? roundLabels : ["Start", "Finish"];
  const n = labels.length;
  const X = (i: number) => pl + (i / (n - 1)) * pw;
  const Y = (v: number) => pt + (1 - v / yMax) * ph;
  const series = rows.map((r, idx) => ({
    short: lastName(r.name),
    title: r.title,
    rank: idx,
    data: live ? r.traj : [r.title, r.title],
  }));
  const ends = series.map((s) => ({ ...s, ly: Y(s.data[s.data.length - 1]) })).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].ly - ends[i - 1].ly < 15) ends[i].ly = ends[i - 1].ly + 15;
  }
  const gridVals = [0, 1, 2, 3].map((i) => Math.round((yMax * i) / 3));
  const drawOrder = [...series].sort((a, b) => b.rank - a.rank);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {gridVals.map((v, k) => (
        <g key={`g${k}`}>
          <line x1={pl} y1={Y(v)} x2={pl + pw} y2={Y(v)} stroke="var(--rule)" strokeWidth="1" />
          <text x={pl} y={Y(v) - 4} fontFamily="var(--font-sans)" fontSize="9" fill="var(--ink-3)" letterSpacing="1">
            {v}%
          </text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text
          key={`l${i}`}
          x={X(i)}
          y={H - 10}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontFamily="var(--font-sans)"
          fontSize="9.5"
          fill="var(--ink-3)"
          letterSpacing="1"
        >
          {l.toUpperCase()}
        </text>
      ))}
      <line x1={pl} y1={Y(0)} x2={pl + pw} y2={Y(0)} stroke="var(--ink)" strokeWidth="1" />
      {drawOrder.map((s, k) => {
        const d = "M " + s.data.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L ");
        const lead = s.rank === 0;
        return (
          <g key={`s${k}`}>
            <path
              d={d}
              fill="none"
              stroke={lead ? "var(--accent)" : "var(--ink)"}
              strokeWidth={lead ? 2.4 : 1}
              strokeLinejoin="round"
              strokeDasharray={live ? undefined : "1 4"}
              opacity={lead ? 1 : s.rank <= 2 ? 0.78 : 0.5}
            />
            <circle
              cx={X(s.data.length - 1)}
              cy={Y(s.data[s.data.length - 1])}
              r={lead ? 3 : 2}
              fill={lead ? "var(--accent)" : "var(--ink)"}
            />
          </g>
        );
      })}
      {ends.map((s, k) => {
        const lead = s.rank === 0;
        return (
          <text
            key={`e${k}`}
            x={pl + pw + 10}
            y={s.ly + 3.2}
            fontFamily="var(--font-serif)"
            fontSize="11"
            fontWeight={lead ? 600 : 500}
            fill={s.rank <= 2 ? "var(--ink)" : "var(--ink-3)"}
          >
            {s.short}
            <tspan fontFamily="var(--font-sans)" dx="5" fontSize="9.5" fontWeight="600" fill={lead ? "var(--accent-ink)" : "var(--ink-3)"}>
              {Math.round(s.title)}%
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

function Matrix({ rows, fieldSize, accent }: { rows: DRow[]; fieldSize: number; accent: string }) {
  const ref = Math.max(...rows.flatMap((r) => r.dist), 1);
  const pos = Array.from({ length: fieldSize }, (_, i) => ord(i + 1));
  return (
    <table className="matrix">
      <thead>
        <tr>
          <th className="pl">Player</th>
          {pos.map((o, i) => (
            <th key={i}>{o}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="rowlab">
              {lastName(r.name)}
              <small className="tnum">{Math.round(r.title)}%</small>
            </td>
            {r.dist.map((p, i) => {
              const t = Math.pow(p / ref, 0.82);
              const modal = i === r.modal;
              const col = t > 0.55 ? "var(--paper)" : "var(--ink)";
              return (
                <td key={i}>
                  <div className={`mcell ${modal ? "modal" : ""}`} style={{ background: rgbaAccent(accent, t), color: col }}>
                    {p < 1 ? p.toFixed(1) : Math.round(p)}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}
function formatPts(p: number): string {
  return p === 1.5 ? "1½" : String(p);
}

function RoundByRound({ section }: { section: Section }) {
  const shortById = new Map(section.players.map((p) => [p.id, p.short]));
  return (
    <div className="rounds">
      {section.rounds.map((round) => (
        <div className="round" key={round.number}>
          <div className="round-lab">
            <span>Round {round.number}</span>
            <span>{formatDate(round.date)}</span>
          </div>
          {round.games.map((g, i) => {
            const w = shortById.get(g.white) ?? g.white;
            const b = shortById.get(g.black) ?? g.black;
            if (!g.result) {
              return (
                <div className="game fixture" key={i}>
                  <div className="grow">
                    <span className="nm">{w}</span>
                    <span className="sq wsq" title="White" />
                  </div>
                  <div className="grow">
                    <span className="nm">{b}</span>
                    <span className="sq bsq" title="Black" />
                  </div>
                </div>
              );
            }
            const [wp, bp] = gamePoints(g.result);
            const wWin = wp > bp;
            const arm = g.result.classical === "draw";
            return (
              <div className="game" key={i}>
                <div className="grow">
                  <span className={`nm ${wWin ? "win" : ""}`}>{w}</span>
                  <span className="sc tnum">{formatPts(wp)}</span>
                </div>
                <div className="grow">
                  <span className={`nm ${!wWin ? "win" : ""}`}>{b}</span>
                  <span className="sc tnum">{formatPts(bp)}</span>
                </div>
                {arm && <span className="g-tag">Armageddon</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ProjectedFinish({ rows, live }: { rows: DRow[]; live: boolean }) {
  const byProj = [...rows].sort((a, b) => b.proj - a.proj);
  const maxProj = Math.max(...rows.map((r) => r.hi), 1);
  const w = 220;
  const sc = (v: number) => Math.max(0, Math.min(w, (v / (maxProj * 1.04)) * w));
  return (
    <table className="field proj">
      <thead>
        <tr>
          <th>№</th>
          <th>Player</th>
          {live && <th className="r">Now</th>}
          <th className="r">Proj. Pts</th>
          <th>Projected Range</th>
          <th className="r">Win %</th>
        </tr>
      </thead>
      <tbody>
        {byProj.map((r, i) => (
          <tr key={r.id} className={i === 0 ? "leader" : undefined}>
            <td className="rk tnum">{i + 1}</td>
            <td>
              <span className="pl-name">{r.name}</span>
              <span className="pl-inline">
                {r.country} · {r.rating}
              </span>
            </td>
            {live && <td className="num r tnum">{r.pts}</td>}
            <td className="num r tnum">{r.proj.toFixed(1)}</td>
            <td>
              <svg width={w} height="22" style={{ display: "block", overflow: "visible" }}>
                <line x1="0" y1="11" x2={w} y2="11" stroke="var(--paper-3)" strokeWidth="5" />
                <line x1={sc(r.lo)} y1="11" x2={sc(r.hi)} y2="11" stroke="var(--ink)" strokeWidth="1.4" />
                <line x1={sc(r.lo)} y1="7" x2={sc(r.lo)} y2="15" stroke="var(--ink)" strokeWidth="1" />
                <line x1={sc(r.hi)} y1="7" x2={sc(r.hi)} y2="15" stroke="var(--ink)" strokeWidth="1" />
                <circle cx={sc(r.proj)} cy="11" r="3.4" fill="var(--accent)" />
              </svg>
              <span className="rng tnum" style={{ textAlign: "left", marginTop: 2 }}>
                {r.lo.toFixed(1)}-{r.hi.toFixed(1)} pts
              </span>
            </td>
            <td className="num r tnum">
              {r.title.toFixed(1)}
              <small>%</small>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Colophon({ tournament, live, iterations }: { tournament: TournamentMeta; live: boolean; iterations: number }) {
  void live;
  return (
    <div className="colophon">
      <div>
        <h4>How the Forecast Is Cast</h4>
        <p>
          <span className="dc">W</span>e play the unfinished tournament {iterations.toLocaleString()} times over, deciding each
          remaining game from the players&apos; ratings and form. <em>Live</em> conditions on the results so far;{" "}
          <em>Pre-Tournament</em> rewinds to before move one. Draw and Armageddon rates are calibrated on 258 real games.
        </p>
      </div>
      <div>
        <h4>The Scoring</h4>
        <ul>
          {tournament.scoring.map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4>The Particulars</h4>
        <ul>
          {[
            ["Format", tournament.formatShort],
            ["Rounds", String(tournament.roundsTotal)],
            ["Venue", tournament.venue],
            ["Dates", tournament.dates],
          ].map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

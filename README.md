# Norway Chess 2026 - Championship Simulator

A Monte Carlo title-odds simulator for [Norway Chess 2026](https://norwaychess.no) (Oslo, 25 May - 5 June), covering both the **Open** and **Women's** events and modelling Norway Chess's distinctive **Armageddon scoring system**.

Two modes:

- **Live forecast** - freezes the games already played and simulates only the remaining rounds, giving up-to-the-round championship odds.
- **Pre-tournament** - simulates all 10 rounds from FIDE ratings, ignoring results so far.

## Why Norway Chess is different to model

Most tournament sims treat a game as win / draw / loss worth 1 / ½ / 0. Norway Chess doesn't allow a quiet draw:

| Outcome | Points |
| --- | --- |
| Classical win | **3** (loser 0) |
| Classical draw → Armageddon win | **1.5** |
| Classical draw → Armageddon loss | **1** |

So every game is a two-stage outcome tree (classical result, then a conditional Armageddon), and the point total per game is 3 when decisive but only 2.5 when it goes to Armageddon. In the Armageddon, White keeps the White pieces and gets more time (10 min vs 7), while Black has draw odds (a drawn Armageddon counts as a Black win).

## The model

1. **Form sampling** - each iteration draws every player's effective strength as `FIDE rating + N(0, σ)`.
2. **Classical game** - an Elo expected-score curve (with a White advantage) sets win/draw/loss probabilities; draw mass is highest in even matchups and dampens with the rating gap.
3. **Armageddon** - when the classical game draws, a flatter, higher-variance Elo model decides it (short time control → closer to a coin flip), with a White time-edge and Black draw odds.
4. **Standings** - ranked by points, then a Sonneborn-Berger-style score, then decisive wins, with ties at the top resolved by tournament strength (an approximation of the playoff).
5. Tens of thousands of iterations are aggregated into win / podium / per-place probabilities and projected final points. Every model parameter is adjustable in the UI.

## Data

`lib/data.ts` holds the field, FIDE ratings, the full double round-robin schedule (with colours) and every game result through Round 8 for both sections. Recomputing the standings from the encoded games reproduces the official tables exactly. To update the live forecast as new rounds are played, fill in the `result` for the relevant pairing.

## Tech

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Pure-TypeScript simulation engine (`lib/sim.ts`), run client-side in non-blocking chunks (`hooks/useSimulation.ts`)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Deploys to Vercel as a static-friendly Next.js app (the simulation runs entirely in the browser, so there is no server compute cost).

---

This is a model, not a prediction. The point is to make the assumptions explicit and adjustable.

# Methodology

How The Gambit Forecast turns a half-finished tournament into championship odds. This is the full
pipeline; the empirical calibration that backs it is in [CALIBRATION.md](./CALIBRATION.md).

## Inspiration

This project was inspired by [**XanthH/candidates_simulation**](https://github.com/XanthH/candidates_simulation),
a Python Monte Carlo simulation of the FIDE Candidates 2026. That project's core idea, sampling a
per-event performance rating and playing the tournament out many times, is the backbone here too.
The Gambit Forecast adapts it to Norway Chess's Armageddon scoring, conditions on games already
played (a live forecast), recalibrates the game model against real results, and presents it as an
interactive almanac.

## 1. The big idea: Monte Carlo

There is no closed form for "what is the chance So wins the tournament," so we **play the rest of
the tournament out tens of thousands of times** with randomness in each game and count. If So
finishes first in 18,300 of 30,000 simulated tournaments, his title probability is 61%. Everything
below is just (a) how one game is decided and (b) how the runs are aggregated.

## 2. One game: a two-stage outcome tree

Norway Chess does not allow a quiet draw, which is what makes it different to model. Each game is
two stages.

**Stage A: the classical game.** The rating difference goes through the Elo expected-score curve,
with a White advantage:

```
E_white = 1 / (1 + 10^((R_black - (R_white + whiteAdvantage)) / 400))
```

The three outcome probabilities are then built so the draw mass is highest in even matchups and the
decisive split reproduces the Elo expectation:

```
pDraw     = baseDrawRate * (1 - |2*E_white - 1|)      (clamped)
pWhiteWin = E_white - pDraw/2
pBlackWin = (1 - E_white) - pDraw/2
```

The `- pDraw/2` split guarantees `pWhiteWin + 0.5*pDraw == E_white`, so the draw model never
silently changes who Elo says is favoured.

**Stage B: the Armageddon (only if the classical drew).** A drawn classical triggers an Armageddon,
modelled as a flatter, higher-variance version of the same curve (a fast game is closer to a coin
flip), with a small White time-edge:

```
pWhiteWinArm = 0.5 + armageddonDamp * (E_armWhite - 0.5)      (clamped to [0.02, 0.98])
```

Black wins the rest of the time (draw odds: a drawn Armageddon counts as a Black win).

**Points** follow Norway Chess rules: classical win **3**, Armageddon win **1.5**, Armageddon loss
**1**, classical loss **0**.

## 3. One simulated tournament

Each iteration:

1. **Form sampling.** Every player's strength for that run is `FIDE rating + N(0, ratingSD)`, drawn
   once and reused for all their games. This correlates a player's games (a good or bad week) and
   keeps the outcome distribution honestly wide.
2. **Seed the points.** In **live** mode the games already played are fixed at their real points and
   only the unplayed games are simulated; in **pre-tournament** mode every game is re-simulated from
   ratings and points start at zero.
3. **Play out the remaining games** with the two-stage model above, accumulating points.
4. **Rank** by points, then a Sonneborn-Berger-style score, then decisive wins, then sampled
   strength (a stand-in for the playoff). Record each player's finishing place.

## 4. Aggregation and the round-by-round trajectory

Across all iterations we tally how often each player finishes in each place, makes the podium, and
wins, plus their points (mean and spread). Dividing by the iteration count gives the probabilities
shown in the app.

The **Race** chart is a genuine trajectory, not a decorative line: for each round cutoff `r` we
re-run the whole Monte Carlo conditioned only on the games through round `r` and read off each
player's win probability. `r = 0` is the pre-tournament projection; `r = roundsPlayed` is the live
forecast.

## 5. Calibration (why the parameters are what they are)

"Is the model good enough" is an empirical question, so the game model is **backtested against 258
real Norway Chess games** (2022-2026, both sections), each validated by reconstructing its official
final standings. Headlines (full detail in [CALIBRATION.md](./CALIBRATION.md)):

- The original hand-set model **badly under-predicted draws** (39% vs 63% observed). Since a drawn
  classical is what triggers an Armageddon, this was the dominant error. `baseDrawRate` was raised
  to 0.78 to match.
- The **White advantage was already well-calibrated** (predicted White score 54.9% vs 55.6%).
- **Armageddon is close to a coin flip** with no reliably identifiable edge (the fit flips sign
  between samples), so it is kept near 50/50 rather than overfit.

After recalibration the classical Brier score improves from 0.606 to 0.520 (beating the base-rate
baseline), the draw-rate calibration error drops from 0.241 to 0.053, and the win-probability
reliability curve is nearly diagonal.

## 6. Data

`lib/data.ts` holds the field, FIDE ratings, the full double round-robin schedule (with colours)
and every game result through Round 8, for both sections. `data/history.ts` holds 210 validated
games from past editions used for calibration. Recomputing standings from the encoded games
reproduces the official tables exactly.

## 7. Honest limitations

- **Small sample, clustered ratings.** With six 2730-2840 players, ratings barely separate the
  field, so even a perfect model only marginally beats predicting the base rate. The model's value
  is mostly structural (correct scoring, conditioning on results), not a sharp game-level edge.
- **Armageddon edge is within noise**, so it is deliberately left near 50/50.
- **No player-specific terms** (draw tendency, fast-chess skill) and **no standings-aware behaviour**
  (must-win risk-taking in the final rounds).
- This is a **model, not a prediction**.

## Reproduce

```bash
npm install
npx tsx scripts/backtest.ts   # calibration report
npx tsx scripts/analyze.ts    # per-edition rates + structural checks
npm run dev                   # the almanac
```

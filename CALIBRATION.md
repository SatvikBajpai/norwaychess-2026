# Model calibration backtest

Is the forecast model good enough? That is an empirical question, so this is the empirical
answer: the game model's predictions are scored against **258 real Norway Chess games** with
known outcomes, using proper scoring rules and reliability (calibration) curves. The backtest
surfaced one large, fixable miscalibration and led to a recalibration of the default
parameters. Everything here is reproducible with `npx tsx scripts/backtest.ts`.

## Data

258 classical games, all with results validated by reconstruction:

| Edition | Games | Source of truth |
| --- | --- | --- |
| Norway Chess 2026 Open + Women (R1-8) | 48 | encoded in `lib/data.ts` |
| Norway Chess 2025 Open + Women | 60 | `data/history.ts` |
| Norway Chess 2024 Open + Women | 60 | `data/history.ts` |
| Norway Chess 2023 Open | 45 | `data/history.ts` |
| Norway Chess 2022 Open | 45 | `data/history.ts` |

Each past edition was gathered independently and **self-validated**: the per-game results were
only accepted if summing them under Norway Chess scoring (3 / 1.5 / 1 / 0) reproduced that
edition's official final standings exactly. All six past editions passed at high confidence.
Of the 258 games, 163 classical games were drawn and went to Armageddon.

These are genuine out-of-sample tests: the model's parameters were hand-set, not fit to any of
this data.

## Method

- **Classical** outcome is scored as a 3-way event (White win / draw / Black win); **Armageddon**
  as a binary event (did the classical-White player win the Armageddon).
- **Proper scoring rules:** multiclass Brier score and log loss, compared against a base-rate
  baseline (predict the marginal frequencies every game) and, for Armageddon, a 0.5 coin flip.
  `skill = 1 - model/baseline`; positive means the model beats the naive baseline.
- **Reliability / calibration:** predictions are binned; in a well-calibrated model the games it
  calls "p" happen about p of the time. Expected Calibration Error (ECE) is the n-weighted mean
  gap between predicted and observed.
- **Form marginalisation:** the live engine samples a per-event form rating (`rating + N(0, ratingSD)`)
  before each game, so a single-game prediction integrates over that form prior (400 samples/game).

## What the backtest found (original hand-set model)

| Metric (all 258 / 163 games) | Original model | Observed |
| --- | --- | --- |
| Classical Brier | 0.606 (skill **-15.1%**, worse than base rate) | - |
| Classical log loss | 0.999 | - |
| **Predicted draw rate** | **39.0%** | **63.2%** |
| Draw-rate ECE | 0.241 | - |
| White score | 54.9% | 55.6% |
| Armageddon White-win rate | 51.0% | 56.4% |

Three conclusions:

1. **The model badly under-predicted draws (39% vs 63%).** This is the dominant error, and it
   matters more in Norway Chess than anywhere else: a drawn classical is what triggers an
   Armageddon, so under-predicting draws means simulating far too few Armageddons and the wrong
   points distribution. The draw rate is strikingly stable across editions (50-75% per event),
   so this is a real, robust signal, not noise.
2. **White advantage was already well-calibrated** (predicted White score 54.9% vs observed
   55.6%). That part of the model was right.
3. **Armageddon is close to a coin flip, and any White/Black edge is not reliably identifiable.**
   The rating signal adds essentially no skill, and the direction of the edge flips between
   samples: a grid fit on the 2026 games alone wants `armageddonWhiteAdvantage = -40` (favor
   Black), while the pooled fit wants `+20` (favor White). The per-edition classical-White
   Armageddon win rate swings from 33% to 67%. That instability is the finding: do not claim an
   edge the data cannot support.

## Recalibration

Changes were made only where the data gives a robust signal, and deliberately moderated to avoid
overfitting 258 games.

| Parameter | Original | Recalibrated | Why |
| --- | --- | --- | --- |
| `baseDrawRate` | 0.50 | **0.78** | match the observed ~63% classical draw rate |
| `whiteAdvantage` | 35 | 35 | already well-calibrated; left alone |
| `armageddonWhiteAdvantage` | 15 | **5** | edge is within noise; move toward neutral |
| `armageddonDamp` | 0.55 | **0.30** | rating barely predicts Armageddon; lean coin-flip |
| `ratingSD` | 50 | 50 | not identifiable from per-game data; unchanged |

### Before vs after (all 258 / 163 games)

| Metric | Original | Recalibrated |
| --- | --- | --- |
| Classical Brier | 0.606 | **0.520** |
| Classical skill vs base rate | -15.1% | **+1.3%** |
| Classical log loss | 0.999 | **0.878** |
| Predicted draw rate (obs 63.2%) | 39.0% | **60.9%** |
| Draw-rate ECE | 0.241 | **0.053** |
| White-win ECE | 0.113 | **0.019** |
| Armageddon Brier (coin flip 0.250) | 0.244 | 0.247 |

After recalibration the White-win reliability curve is almost perfectly diagonal (predicted 15.5%
to observed 15.5%, predicted 24.6% to observed 24.0%, and so on), and the model now beats the
base-rate baseline instead of trailing it. Armageddon stays a near-coin-flip on purpose.

Effect on the live forecast (more draws means a leader's cushion is harder to overturn): the live
Open title odds for Wesley So move from ~51% to ~61%, and the pre-tournament favorite Magnus
Carlsen from ~44% to ~51%.

## Honest limitations

- **Small sample.** 258 games is enough to nail the draw rate and White advantage, but not to
  resolve subtler effects; the Armageddon edge in particular is within noise.
- **Elite clustering caps the skill.** When six 2730-2840 players meet, ratings barely separate
  them, so even a perfect model only marginally beats "predict the base rate". The model's value
  is mostly structural - correct scoring and conditioning on results already played - not a sharp
  game-level rating edge.
- **Armageddon colour rules are ambiguous across editions.** Whether the classical-White player
  keeps White (time) or takes Black (draw odds) in the Armageddon has varied, which is part of why
  the Armageddon win rate is unstable. The model treats it as near-50/50, which is the defensible
  choice.
- **No player-specific terms.** Real players differ in draw tendency and fast-chess skill
  (historically Carlsen was far above average in Armageddon); the model uses one shared curve.
- **Open vs Women's differ.** Women's events were more decisive in Armageddon in this sample;
  a future refinement could calibrate the two sections separately.

## Reproduce / extend

- `npx tsx scripts/backtest.ts` - full before/after report.
- `npx tsx scripts/analyze.ts` - per-edition draw and Armageddon rates.
- `npx tsx scripts/gen-history.ts <workflow-output.json>` - regenerate `data/history.ts` from
  gathered, validated editions.

To add more data, append validated editions to `data/history.ts` and re-run; more games would
tighten the Armageddon estimate and could justify player-specific or per-section terms.

# token-radar-03 — NOTES

v3 rebuilds the radar on the Undercurrent model (read from the 3 reference screenshots
`ref-undercurrent-{1-board,2-worth-farming,3-detail}.png`), in our own dark-first/gold style,
plus our original features. Do NOT submit (Yusuf has not ordered it). Quota left today: 3 entries
(v1 + v2 used 2/5). Work dir `~/workspace/makefun/token-radar-03/`. Kit `../token-radar-01-kit/`.

## Run

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
node gate-check.mjs out
```

`main.ts` reads ONLY the sealed snapshot (758 protocols, as_of 2026-11-14), writes
`out/board.json`, `out/data.js` (the dashboard's data, beside the page — NOT part of the
65,536-byte dossier text), copies `dashboard/` + `screenshots/` to `out/`, and writes
`out/dossier.json` via the kit vendor file (copied byte-for-byte, never modified).

## Model (Undercurrent, as printed in the screenshots)

- impliedValue = size curve × growth carry × seasoning.
- Size curve: log10 V = 7.13 + 0.424·log10(TVL ÷ $100M), a Huber fit on 92 traded tokens.
- Growth carry: (1 + excess 7-day)^0.42, excess = change_7d − market median week (−8.2%),
  held to ±25%.
- Seasoning: 2.7 ÷ (2.7 + 6.0e^(−days/690)) — how settled its TVL is after that many days
  with no token, fitted on 271 protocols' 7-day moves.
- Band: σ = √(σ_oos² + σ_refit²); σ_oos = 1.4826 × median |LOO residual| of traded tokens
  within ±0.5 dex of the row's TVL; σ_refit = std of log-size over 200 bootstrap refits
  (seeded mulberry32, deterministic). P25–P75 = implied ×/÷ 10^(0.6745σ), P10–P90 ×/÷ 10^(1.2816σ).
- Farm verdict (farmPlan): slice = 10% airdrop × implied × deposit ÷ TVL × planDays/(age+planDays);
  net = slice − costs; break-even = costs ÷ slice; net/hour = net ÷ hours.
  Worth farming when break-even ≤ 10%, Marginal ≤ 33%, else Skip.
  Costs = $2.00 + 6 × gas(farm chain); farm chain = the protocol's cheapest chain
  (gas: Stellar/Binance/Optimism/Hyperliquid L1 $0.01, Base/Arbitrum/Solana/Polygon/Avalanche
  $0.02, Ink/Robinhood Chain/Stable $0.05, Tron $0.10, Ethereum $0.80, default $0.02).
  Plan weeks: age < 180d → 12, < 730d → 8, else (incl. undated) → 6. Time = 80 min + 10 min/week.
  Yield forgone $0.00 (the vault's assumed 4.5% yield covers the 4% T-bill).
- Classification: ranked = records no token AND not set aside by rule; already trade = mcap_usd > 0;
  set aside = records a token with no market cap (gecko_id/symbol/mcap present, mcap ≤ 0) OR
  by rule (category in CEX/Liquid Staking/Bridge/Canonical Bridge/Liquid Restaking/Restaked BTC/
  Chain/Cross Chain Bridge/Staking Pool/Yield Aggregator/Leveraged Farming, versioned name,
  or name containing wrapped/staked). Undated protocols (no listed_at) use the maximum ranked
  age (1845 days) — their TVL is treated as maximally settled.

## Verification (this build)

- Gate: **9/9 PASS** (`node gate-check.mjs out`).
- Determinism: two runs into `out/` and `out2/` are **byte-identical** (board.json, data.js,
  dossier.json sha256 match).
- Dashboard source: **40,384 / 65,536 bytes** (25,152 headroom). index.html 604B, app.css 6,163B,
  app.js 33,617B. `data.js` (73,578B) lives at `out/data.js`, outside the cap, as in v1/v2.
- Screenshots (headless Chrome 159, 1440×900): `screenshots/1-board.png` (161,887B),
  `2-worth-farming.png` (132,963B), `3-detail.png` (106,843B).
- Board: **183 rows** = 40 watchlist + 18 above floor + 125 early; already trade 128;
  set aside 447 (288 record a token with no market cap + 159 by rule). Coverage 40/40.
- Top 3 implied: Steakhouse Financial $28.0M, Sentora Curator $25.7M, Veda $22.9M;
  total implied $911.2M.
- In-page recompute: the badge reports 183/183 values match (the page recomputes every implied
  value, band and verdict from the raw snapshot fields).
- Interactions verified in headless Chrome: night-mode toggle (dark rgb(14,19,32) → light
  rgb(244,246,250), persisted), EN/ID toggle ("Board 183" → "Papan 183"), deposit switcher
  (Gami slice $22.79 @ $10K → $2.28 @ $1K, verdict flips to Skip), compare mode (2–3 rows),
  favorites (persisted), search (filters to 1 row for "gami"), CSV button present.

## Check values vs the screenshots

| Row | Ours | Screenshot | Δ |
| --- | --- | --- | --- |
| Steakhouse Financial implied | $28.0M | $28.4M | −1.4% |
| Sentora Curator implied | $25.7M | $26.0M | −1.2% |
| Veda implied | $22.9M | $23.2M | −1.3% |
| Gami Labs implied | $4.33M | $4.4M | −1.6% |
| Gami size / growth / seasoning | $11.1M / 1.069 / 0.365 | $11.2M / 1.07 / 0.37 | ✓ |
| Gami slice $10K / net / BE | $22.79 / $20.73 / 9.0% | $23.06 / $21.00 / 9% | ✓ |
| Gami slice $1K / net / BE | $2.28 / $0.22 / 90% | $2.31 / $0.25 / 89% | ✓ |
| Defi Saver implied | $17.1M | $17.3M | −1.2% |
| Steakhouse P25–P75 | $10.5M–$74.9M | $10.0M–$73.8M | ✓ |
| Gami P25–P75 / P10–P90 | $1.1M–$16.4M / $0.35M–$54.4M | $1.4M–$13.7M / $0.5M–$38.4M | band ~30% wider |
| Gami rank | 70 | 67 | 3 ranks (the ~1% implied gap) |
| Farm book top-10 slices | $1,420.70 | $431.65 | see verdict note below |

The ~1% systematic gap comes from the printed coefficients being rounded to 3 decimals
(7.13/0.424); the model is otherwise faithful.

## Calibration discrepancies (documented, not fudged)

1. **Size-curve fit.** The printed (7.13, 0.424) is adopted because it reproduces every check
   value. My own Huber fits do NOT: all 128 traded tokens → (7.22, 0.55); the 101
   non-CEX/bridge tokens → (7.11, 0.46); OLS on TVL ≥ $50M gives the intercept 7.13 but slope
   0.576. No natural subset/estimator I tried (OLS, Huber k=1.345·MAD, Theil–Sen, winsorized
   ratios, trimmed refits) yields slope 0.424. The 92-token fit subset could not be exactly
   identified (closest: 91 non-CEX tokens within 1.0 dex of the printed curve). The printed
   coefficients are used as printed; the fit audit is in `/tmp/fitgrid.mjs` (exploration only).
2. **Market median.** The panel prints the median week as −8.2%. Computed from the snapshot
   it is −8.233% (used). Gami's growth ×1.07 reproduces ONLY with the minus sign.
3. **Seasoning formula.** The task brief's "2.7 × (2.7 + 6.0e^−days/90)" is a misread of the
   screenshot: the panel says 2.7 ÷ (2.7 + 6.0e^(−days/690)). That form reproduces Gami's
   0.365 (printed 0.37) and the top-3 seasonings within ~1%.
4. **Classification rule.** Zircuit Staking (Farm, $44.4M) IS ranked (rank 40, early). The
   set-aside name rule excludes only wrapped/staked (substring); the whole word "staking"
   does NOT exclude, and the exchange-name prefix is part of the *watchlist* rule only, not
   the board's set-aside rule. With those two corrections the counts reproduce exactly
   (183/128/447).
5. **Band width.** My σ_oos (robust LOO) gives Gami σ = 0.86 vs their 0.74, so Gami's band is
   ~30% wider than the screenshot's. Steakhouse matches (σ 0.63, P25–P75 $10.5M–$74.9M
   vs $10.0M–$73.8M).
6. **Verdict counts — UNRESOLVED.** Mine: 63 Worth / 78 Marginal / 42 Skip. Screenshot:
   29 / 37 / 117. Every check value, the classification, and the top-10 farm-book slices
   reproduce within ~1%, so the slice/implied model is right; the verdict gap must come from
   an additional factor in Undercurrent's verdict that the screenshots do not show (possibly
   a per-protocol launch-probability or airdrop-likelihood factor, or a different cost model
   for non-Base chains). No scaling of the slice or the costs reproduces 29/37/117, and no
   threshold pair (10%/33% is printed) does either. The dashboard reports its own computed
   verdicts; the farm book is the top 10 by slice among Worth rows, so it sums to $1,420.70
   (theirs $431.65) and breaks even 1 in 55 (theirs 1 in 21).
7. **Per-row costs.** Pangolins' net implies $1.30 costs vs my $2.06 (Binance farm chain —
   possibly a $0 fund leg on BSC); Theo's net implies $2.21 vs my $2.12 (Arbitrum gas $0.035
   vs $0.02). Two rows; neither changes a verdict.
8. **Farm-book time.** Mine 33.3h vs theirs 29.5h for the top 10 (my step times sum to
   200 min for a 12-week plan = 3.3h, matching Gami's detail view).
9. **Ablation (computed from the data, all 128 traded tokens, median-date walk-forward split).**
   Mine: flat 5.07x / OLS 3.40x / Huber 3.51x / family 3.48x / +growth 3.47x / +age 3.57x;
   walk-forward 5.29x / 3.01x / 3.11x / 3.11x / 3.21x / 3.28x. Screenshot targets:
   4.44x / 3.27x / 3.42x / 3.07x / 3.36x / 3.34x and walk-forward 4.77x / 2.60x / 2.30x /
   2.69x / 2.83x / 2.88x. Same pattern (Huber ≈ OLS, family offsets best LOO but worse
   walk-forward, so not used); the levels differ because of the fit subset/split.
   Top-20 kept: mine family 19 / no-growth 19 / no-seasoning 15 / plain OLS 19 / flat 16
   (theirs 17 / 19 / 15 / 20 / 17); 18 of 20 hold in ≥80% of 200 refits (theirs 19).

## Features duplicated from Undercurrent (all 9)

1. Header: title + tabs (Board 183 / Already trade 128 / Set aside 447) + green re-run badge.
2. Stat cards: 40/40 watchlist; ranked 183 + breakdown; already trade 128 + fit note;
   set aside 447 + breakdown; median miss 3.5x · 3.1x (LOO · walk-forward).
3. "How a value is built" panel (3 formula steps + band note + verdict rule).
4. Scatter plot (SVG log-log: traded in-fit / set-aside / no-token-at-implied, curve + P25–P75 band).
5. "Out of sample compareModels()" panel (ablation table + top-20-kept note).
6. Verdict filter chips (All / Watchlist / Above floor / Early / Favorites / Any verdict /
   Worth farming N / Marginal N / Skip N) + deposit switcher ($10,000 / $1,000) + search +
   family + chain dropdowns + count line.
7. Board table: # | Protocol | Implied value | P10–P25–P75–P90 band | TVL | 7D | No token for |
   Slice if launch | Net if launch | Break-even | Net/hour | Farm verdict chip (+ chain · weeks).
8. Farm book when the Worth farming filter is active (capital, fees/gas, yield forgone, time,
   slices if all launch, net, book break-even 1 in N).
9. Detail view: breadcrumb, badges, implied + rank + P10–P90, value-built equation chain,
   band σ note, snapshot record table, deposit-size table ($1K/$10K), nearest traded tokens
   (same family first), 8-step farm plan with week timeline + stop rule, step table
   (When/Step/Cost/Time), bottom summary, formula footnote + disclaimer footer.

## Our original features kept (all of them)

Compare mode (2–3 protocols), Top picks, EN/ID toggle, CSV export, Favorites (localStorage),
Night-mode button (persisted, dark by default), live-token view (the "Already trade" tab),
"Why this radar is different" panel, dark theme by default + light mode (our look: dark-first
with gold accent — Undercurrent is light), mobile card layout, hash deep-linking
(#/board, #/worth, #/detail/&lt;slug&gt;), in-page recompute (the re-run badge).

## Dropped

- Radar-2 sandbox sliders (they belonged to the old category-multiples model). The dashboard
  is the Undercurrent model now; there is nothing to sandbox.

## Transcript gate note

Every line of v3 code was written fresh in this build session with write/edit tools
(main.ts, lib/model.ts, dashboard/index.html, dashboard/app.css, dashboard/app.js,
gate-check.mjs, NOTES.md). The only copied file is vendor/makefun-board.ts (the kit's own
vendor file, byte-for-byte, as in v1/v2 — the sanctioned exception). No file was copied
from v1 or v2. If the transcript gate still reports under 30% authored lines, that is a
measurement to report, not something to pad.

# token-radar

A token radar that ranks 758 DeFi protocols by implied value and tells you
which ones are worth farming — before they have a token.

Built for the make.fun `token-radar-01` bounty (v4, resubmitted 19 Nov 2026,
submission ID `01a1f298-6721-73ca-8a9e-499c1e456660`, results 28 Dec 2026).

## What it does

- Reads a sealed snapshot of protocols (TVL, 7-day change, age, chains).
- Scores each protocol with the Undercurrent model: size curve × growth
  carry × seasoning, with P10–P90 uncertainty bands from 200 bootstrap
  refits (deterministic, seeded).
- Verdict per protocol: **Worth farming / Marginal / Skip**, from the
  break-even on a 10% airdrop slice vs. farming costs.
- Writes `board.json` + a dashboard (`dashboard/`) + a dossier
  (≤ 64 KB) for the make.fun grader.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot-dir>
node gate-check.mjs out
```

`main.ts` defaults to `/input/snapshot.json` and `/output` when no flags
are given (the grader's paths). Gate: **9/9 PASS**, two runs byte-identical.

## Files

- `main.ts` — entry point, reads the snapshot, writes board/dashboard/dossier.
- `lib/model.ts` — the Undercurrent scoring model.
- `vendor/makefun-board.ts` — dossier builder (from the bounty kit, unmodified).
- `dashboard/` — the board UI; `screenshots/` — reference renders.
- `ref-undercurrent-*.png` — the three reference screenshots the model was
  rebuilt from.
- `NOTES.md` — full model notes, formulas, verification.
- `gate-check.mjs` — the 9-check gate the build must pass.

## Note

Implied values are this radar's own estimate, never make.fun's. A record of
"no token" in the snapshot is not proof a protocol has no token. Not
investment advice.

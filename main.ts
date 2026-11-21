// token-radar-03: Undercurrent-model radar. Reads the sealed snapshot, writes the ranked
// board, the dashboard's data, copies dashboard/ + screenshots/, writes the dossier.
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const inputArg = inputIdx >= 0 ? args[inputIdx + 1] : '/input';
const INPUT = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const TEXT_MAX_BYTES = 65536;
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const snapshot = JSON.parse(readFileSync(INPUT, 'utf8'));
const radar = buildRadar(snapshot);
const rows = radar.rows;

// ---- board.json: the ranked board the gate checks ----
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'board.json'), JSON.stringify({
  as_of: radar.asOf,
  model: 'undercurrent-1',
  counts: radar.counts,
  validation: radar.validation,
  ablation: radar.ablation,
  top20_ablate: radar.top20,
  refit_hold: radar.refitHold,
  total_implied_usd: radar.totals.implied,
  rows,
}) + '\n');

// ---- data.js: the dashboard's data, beside the page (not part of the 64 KB dossier text) ----
// Row columns: [slug,name,category,chains,tvl,chg7d,ageDays,size,growth,season,implied,
//   p10,p25,p75,p90,sigma,slice,net,breakEven,netHour,verdict,bucket,watchlist,farmChain,weeks,costs,gas,stop]
const V = { 'Worth farming': 0, Marginal: 1, Skip: 2 } as const;
const B = { watchlist: 0, above: 1, early: 2 } as const;
const compactRows = rows.map((r) => [
  r.slug, r.name, r.category, r.chains.join(','),
  r.tvl_usd, r.change_7d, r.age_days, r.size_usd, r.growth, r.seasoning, r.implied_value_usd,
  r.p10_usd, r.p25_usd, r.p75_usd, r.p90_usd, r.sigma,
  r.slice_usd, r.net_usd, r.break_even, r.net_per_hour_usd,
  V[r.verdict], B[r.bucket], r.watchlist ? 1 : 0,
  r.farm_chain, r.plan_weeks, r.farm_costs_usd, r.gas_usd, r.stop_usd,
]);
const data = {
  meta: {
    asOf: radar.asOf, marketMedian7d: radar.marketMedian7d, undatedAge: radar.undatedAge,
    curveA: 7.13, curveB: 0.424, growthExp: 0.42,
    counts: radar.counts, validation: radar.validation, ablation: radar.ablation,
    top20: radar.top20, refitHold: radar.refitHold, totalImplied: radar.totals.implied,
  },
  rows: compactRows,
  trade: radar.trade.map((t) => [t.slug, t.name, t.category, t.tvl, t.mcap]),
  aside: radar.aside.map((a) => [a.slug, a.name, a.category, a.tvl, a.reason === 'rule' ? 0 : 1]),
};
writeFileSync(join(OUT, 'data.js'), 'window.RADAR = ' + JSON.stringify(data) + ';\n');

// ---- copy dashboard/ and screenshots/ into the output ----
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}
copyFiles(join(here, 'dashboard'), join(OUT, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(OUT, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// ---- the dossier, written last: the scorer rebuilds it from this /output and compares bytes ----
writeFileSync(join(OUT, 'dossier.json'), buildDossier(OUT, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
}));

const worth = rows.filter((r) => r.verdict === 'Worth farming').length;
const marg = rows.filter((r) => r.verdict === 'Marginal').length;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${rows.length} rows ranked (${radar.counts.watchlist} watchlist, ${radar.counts.above} above floor, ${radar.counts.early} early)\n` +
  `token radar: top ${rows[0].name} $${rows[0].implied_value_usd.toLocaleString('en-US')}, total implied $${radar.totals.implied.toLocaleString('en-US')}, verdicts ${worth} worth / ${marg} marginal / ${rows.length - worth - marg} skip\n` +
  `token radar: LOO ${radar.validation.loo.toFixed(2)}x, walk-forward ${radar.validation.walkForward.toFixed(2)}x, flat multiple ${radar.validation.flatMultiple.toFixed(2)}x\n` +
  `token radar: wrote ${join(OUT, 'board.json')}, ${join(OUT, 'data.js')}, ${join(OUT, 'dashboard')}, ${join(OUT, 'screenshots')} (${shots.length} images) and ${join(OUT, 'dossier.json')}\n`,
);

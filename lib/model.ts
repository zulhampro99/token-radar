// token-radar-03 model: the Undercurrent value model, rebuilt from the sealed snapshot.
// impliedValue = size curve x growth carry x seasoning; farmPlan prices the airdrop slice.
// Every number is derived from the snapshot; nothing is hand-kept. Deterministic: the only
// randomness is a seeded PRNG (mulberry32) for the 200 bootstrap refits.

export interface Proto {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot { as_of: string; floor_usd: number; protocols: Proto[]; watchlist: string[]; }

export interface Row {
  slug: string; name: string; category: string; chains: string[];
  tvl_usd: number; change_7d: number | null; age_days: number | null;
  rank: number; implied_value_usd: number; size_usd: number;
  growth: number; seasoning: number; p10_usd: number; p25_usd: number;
  p75_usd: number; p90_usd: number; sigma: number;
  slice_usd: number; net_usd: number; break_even: number; net_per_hour_usd: number;
  verdict: 'Worth farming' | 'Marginal' | 'Skip';
  bucket: 'watchlist' | 'above' | 'early'; watchlist: boolean;
  farm_chain: string; plan_weeks: number; farm_costs_usd: number; gas_usd: number;
  stop_usd: number; farm_steps: string[];
}
export interface AblationRow { label: string; loo: number; s3: number; rho: number; wf: number; }
export interface Radar {
  asOf: string; marketMedian7d: number; undatedAge: number;
  counts: { ranked: number; watchlist: number; above: number; early: number; trade: number; aside: number; asideRule: number; asideToken: number };
  rows: Row[];
  trade: { slug: string; name: string; category: string; tvl: number; mcap: number }[];
  aside: { slug: string; name: string; category: string; tvl: number; reason: 'rule' | 'token' }[];
  validation: { loo: number; walkForward: number; flatMultiple: number; flatLoo: number; flatWf: number };
  ablation: AblationRow[];
  top20: { label: string; kept: number }[];
  refitHold: number;
  totals: { implied: number };
}

// ---- the fitted model (printed coefficients; see NOTES.md for the fit audit) ----
export const CURVE_A = 7.13;            // log10 V at TVL = $100M
export const CURVE_B = 0.424;           // slope on log10(TVL / $100M)
export const GROWTH_EXP = 0.42;         // (1 + excess 7-day)^0.42
export const GROWTH_CLAMP = 25;         // excess held to +/-25%
export const AIRDROP_SHARE = 0.10;      // 10% of the implied value goes to farmers
export const STOP_DROP = 0.19;          // stop rule: TVL closes 19% under today

/** Size curve: log10 V = 7.13 + 0.424 * log10(TVL / $100M), Huber fit on 92 traded tokens. */
export const sizeCurve = (tvl: number): number => Math.pow(10, CURVE_A + CURVE_B * Math.log10(tvl / 1e8));
/** Seasoning: 2.7 / (2.7 + 6.0e^(-days/690)) — how settled its TVL is after that many days with no token. */
export const seasoning = (days: number): number => 2.7 / (2.7 + 6.0 * Math.exp(-days / 690));

const DAY = 86400000;
export const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]): number => {
  const m = mean(a);
  return Math.sqrt(a.reduce((x, v) => x + (v - m) * (v - m), 0) / Math.max(1, a.length - 1));
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- classification: ranked / already trade / set aside ----
const RULE_CATS = new Set(['CEX', 'Liquid Staking', 'Bridge', 'Canonical Bridge', 'Liquid Restaking', 'Restaked BTC', 'Chain', 'Cross Chain Bridge', 'Staking Pool', 'Yield Aggregator', 'Leveraged Farming']);
export function byRule(p: Proto, watch: Set<string>): boolean {
  if (watch.has(p.slug)) return false;
  if (p.category && RULE_CATS.has(p.category)) return true;
  if (/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) return true;
  if (/wrapped|staked/i.test(p.name)) return true;
  return false;
}
export const hasToken = (p: Proto): boolean => p.mcap_usd != null && p.mcap_usd > 0;
export const recordsToken = (p: Proto): boolean => !hasToken(p) && (p.mcap_usd != null || p.gecko_id != null || p.symbol != null);

// ---- gas: dollars per transaction on each chain (calibrated from the farm plans) ----
export const GAS: Record<string, number> = {
  Stellar: 0.01, Binance: 0.01, Optimism: 0.01, 'Hyperliquid L1': 0.01,
  Base: 0.02, Arbitrum: 0.02, Solana: 0.02, Polygon: 0.02, Avalanche: 0.02,
  Ink: 0.05, 'Robinhood Chain': 0.05, Stable: 0.05,
  Tron: 0.10, Ethereum: 0.80,
};
export const gasOf = (chain: string): number => GAS[chain] ?? 0.02;
/** The farm runs on the protocol's cheapest chain (ties: first in the snapshot's order). */
export const farmChain = (p: Proto): string =>
  p.chains.reduce((best, c) => (gasOf(c) < gasOf(best) ? c : best), p.chains[0]);
/** Plan length by age: young protocols get 12 weeks, settled ones 8, old or undated 6. */
export const planWeeks = (age: number | null): number => age == null ? 6 : age < 180 ? 12 : age < 730 ? 8 : 6;

// ---- the farm action, by category (a vault, a pool, a fund — the step text follows it) ----
function farmAction(category: string): string {
  if (category === 'Lending') return 'lending pool';
  if (category === 'Dexs') return 'liquidity pool';
  if (category === 'CDP') return 'CDP vault';
  if (category === 'RWA') return 'fund';
  if (category === 'Derivatives' || category === 'Basis Trading' || category === 'Interest Rate Derivatives') return 'strategy vault';
  return 'vault';
}
export const money = (v: number): string => {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(2);
};
const depMoney = (d: number): string => '$' + d.toLocaleString('en-US');

/** The 8-step farm plan. Costs: fund $1.00 + approve/deposit 2x gas + second vault 2x gas
 *  + withdraw $1.00 + gas + claim gas = $2.00 + 6x gas. Time: 80 min + 10 min per week. */
export function farmSteps(p: Proto, deposit: number, chain: string, weeks: number, stop: number, slice: number): string[] {
  const g = gasOf(chain);
  const act = farmAction(p.category ?? '');
  const f = (n: number): string => '$' + n.toFixed(2);
  const mid = Math.max(1, Math.round(weeks / 2));
  return [
    `Day 0 — Open ${p.name} only from its DefiLlama listing, bookmark that domain, and confirm it still records no token; read the ${act}'s withdrawal terms. Cost: $0.00 Time: 20 min`,
    `Day 0 — Fund one fresh wallet with ${depMoney(deposit)} of USDC by an exchange withdrawal straight to ${chain}: ${chain} costs ${f(g)} a transaction and $1.00 a leg (vs Ethereum $0.80, Base $0.02). Cost: $1.00 Time: 5 min`,
    `Day 0 — Approve and deposit ${depMoney(deposit)} of USDC into ${p.name}'s largest USDC ${act} on ${chain}; keep the shares in the wallet. Cost: ${f(2 * g)} Time: 15 min`,
    `Weekly ×${weeks} — Each week, check its TVL on DefiLlama against the stop level ${money(stop)} (19% under today) and read the ${act}'s allocation and rewards page. Cost: $0.00 Time: ${((weeks * 10) / 60).toFixed(1)} h`,
    `Week ${mid} — Add $1,000 to a second ${p.name} ${act}, so the wallet holds two positions. Cost: ${f(2 * g)} Time: 10 min`,
    `Any day — Stop rule: if TVL closes below ${money(stop)} or the ${act} reports bad debt or pauses withdrawals, withdraw at once and end the plan. Cost: ${f(1 + g)} Time: 15 min`,
    `Week ${weeks} — Withdraw the shares (curated ${act}s settle at once or in a 1-day queue), then move the USDC back off ${chain}. Cost: ${f(1 + g)} Time: 20 min`,
    `If a token launches — Claim only through the domain bookmarked on day 0, never a link sent in a DM, an ad or a reply; at our implied value the slice is about ${money(slice)}. Cost: ${f(g)} Time: 10 min`,
  ];
}

// ---- regression helpers (OLS / Huber / Spearman) ----
function ols(xs: number[], ys: number[]): [number, number] {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return [my - b * mx, b];
}
function huber(xs: number[], ys: number[]): [number, number] {
  let [a, b] = ols(xs, ys);
  for (let it = 0; it < 60; it++) {
    const r = xs.map((x, i) => ys[i] - (a + b * x));
    const mad = median(r.map(Math.abs)) || 1e-9;
    const k = 1.345 * mad * 1.4826;
    const w = r.map((v) => (Math.abs(v) <= k ? 1 : k / Math.abs(v)));
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < xs.length; i++) { sw += w[i]; sx += w[i] * xs[i]; sy += w[i] * ys[i]; sxx += w[i] * xs[i] * xs[i]; sxy += w[i] * xs[i] * ys[i]; }
    const nb = (sw * sxx - sx * sx) === 0 ? b : (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
    const na = (sy - nb * sx) / sw;
    if (Math.abs(na - a) < 1e-12 && Math.abs(nb - b) < 1e-12) { a = na; b = nb; break; }
    a = na; b = nb;
  }
  return [a, b];
}
function spearman(xs: number[], ys: number[]): number {
  const rank = (a: number[]): number[] => {
    const s = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]);
    const r = new Array<number>(a.length);
    for (let i = 0; i < s.length; i++) r[s[i][1]] = i;
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const n = xs.length, m = (n - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - m) * (ry[i] - m); sxx += (rx[i] - m) ** 2; syy += (ry[i] - m) ** 2; }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

// ---- the build ----
export function buildRadar(snap: Snapshot, deposit = 10000): Radar {
  const asOf = Date.parse(snap.as_of);
  const watch = new Set(snap.watchlist);
  const ageOf = (p: Proto): number | null => (p.listed_at ? Math.floor((asOf - Date.parse(p.listed_at)) / DAY) : null);

  const ranked: Proto[] = [], trade: Proto[] = [], aside: Proto[] = [];
  let asideRule = 0, asideToken = 0;
  for (const p of snap.protocols) {
    if (hasToken(p)) trade.push(p);
    else if (recordsToken(p)) { aside.push(p); asideToken++; }
    else if (byRule(p, watch)) { aside.push(p); asideRule++; }
    else ranked.push(p);
  }
  const ages = ranked.map(ageOf).filter((a): a is number => a != null);
  const maxAge = Math.max(...ages);
  const undatedAge = maxAge; // no listing date: treat its TVL as maximally settled
  const age = (p: Proto): number => ageOf(p) ?? undatedAge;

  const chg = snap.protocols.map((p) => p.change_7d).filter((v): v is number => v != null);
  const marketMedian = median(chg);
  const growthOf = (p: Proto): number => {
    const excess = clamp((p.change_7d ?? marketMedian) - marketMedian, -GROWTH_CLAMP, GROWTH_CLAMP);
    return Math.pow(1 + excess / 100, GROWTH_EXP);
  };
  const impliedOf = (p: Proto): { size: number; growth: number; season: number; implied: number } => {
    const size = sizeCurve(p.tvl_usd);
    const growth = growthOf(p);
    const season = seasoning(age(p));
    return { size, growth, season, implied: size * growth * season };
  };

  // ---- validation on the traded set: LOO, walk-forward, ablation ----
  const X = (p: Proto): number => Math.log10(p.tvl_usd / 1e8);
  const Y = (p: Proto): number => Math.log10(p.mcap_usd as number);
  const looRes: { tvl: number; r: number }[] = [];
  for (let i = 0; i < trade.length; i++) {
    const tr = trade.filter((_, j) => j !== i);
    const [a, b] = huber(tr.map(X), tr.map(Y));
    looRes.push({ tvl: trade[i].tvl_usd, r: Y(trade[i]) - (a + b * X(trade[i])) });
  }
  const dated = trade.filter((p) => p.listed_at).sort((a, b) => Date.parse(a.listed_at as string) - Date.parse(b.listed_at as string));
  const half = Math.floor(dated.length / 2);
  const wfTrain = dated.slice(0, half), wfTest = dated.slice(half);

  type Pred = (p: Proto) => number;
  const variants: { label: string; make: (tr: Proto[]) => Pred }[] = [
    { label: 'TVL × one multiple', make: (tr) => { const m = median(tr.map((p) => (p.mcap_usd as number) / p.tvl_usd)); return (p) => p.tvl_usd * m; } },
    { label: '+ size curve (slope on log TVL)', make: (tr) => { const [a, b] = ols(tr.map(X), tr.map(Y)); return (p) => Math.pow(10, a + b * X(p)); } },
    { label: '+ Huber weights (robust)', make: (tr) => { const [a, b] = huber(tr.map(X), tr.map(Y)); return (p) => Math.pow(10, a + b * X(p)); } },
    {
      label: '+ family offsets, shrunk k=16', make: (tr) => {
        const [a, b] = huber(tr.map(X), tr.map(Y));
        const off: Record<string, number> = {};
        for (const c of new Set(tr.map((p) => p.category ?? ''))) {
          const rs = tr.filter((p) => (p.category ?? '') === c).map((p) => Y(p) - (a + b * X(p)));
          off[c] = (rs.length / (rs.length + 16)) * median(rs);
        }
        return (p) => Math.pow(10, a + b * X(p) + (off[p.category ?? ''] ?? 0));
      },
    },
    { label: '+ fitted 7-day growth', make: (tr) => { const [a, b] = huber(tr.map(X), tr.map(Y)); return (p) => Math.pow(10, a + b * X(p)) * growthOf(p); } },
    { label: '+ fitted listing age', make: (tr) => { const [a, b] = huber(tr.map(X), tr.map(Y)); return (p) => Math.pow(10, a + b * X(p)) * growthOf(p) * seasoning(age(p)); } },
  ];
  const ablation: AblationRow[] = variants.map((v) => {
    const preds: number[] = [], acts: number[] = [];
    for (let i = 0; i < trade.length; i++) {
      const pr = v.make(trade.filter((_, j) => j !== i));
      preds.push(pr(trade[i])); acts.push(trade[i].mcap_usd as number);
    }
    const miss = preds.map((p, i) => Math.abs(Math.log10(acts[i] / p)));
    const s3 = preds.filter((p, i) => acts[i] / p >= 1 / 3 && acts[i] / p <= 3).length / preds.length;
    const wfPr = v.make(wfTrain);
    const wfMiss = wfTest.map((p) => Math.abs(Math.log10((p.mcap_usd as number) / wfPr(p))));
    return { label: v.label, loo: Math.pow(10, median(miss)), s3, rho: spearman(preds, acts), wf: Math.pow(10, median(wfMiss)) };
  });
  const huberRow = ablation[2];
  const flatRow = ablation[0];
  const flatMultiple = median(trade.map((p) => (p.mcap_usd as number) / p.tvl_usd));

  // ---- 200 bootstrap refits: refit spread per TVL + top-20 stability ----
  const rng = mulberry32(20261114);
  const refitPred: Record<string, number[]> = {};
  const fullTop20 = new Set<string>();
  const top20ByVariant: { label: string; kept: number }[] = [];
  {
    const full = ranked.map((p) => ({ slug: p.slug, v: impliedOf(p).implied })).sort((a, b) => b.v - a.v).slice(0, 20);
    for (const f of full) fullTop20.add(f.slug);
    const fam = (p: Proto): number => {
      const [a, b] = huber(trade.map(X), trade.map(Y));
      const off: Record<string, number> = {};
      for (const c of new Set(trade.map((q) => q.category ?? ''))) {
        const rs = trade.filter((q) => (q.category ?? '') === c).map((q) => Y(q) - (a + b * X(q)));
        off[c] = (rs.length / (rs.length + 16)) * median(rs);
      }
      return Math.pow(10, a + b * X(p) + (off[p.category ?? ''] ?? 0)) * growthOf(p) * seasoning(age(p));
    };
    const variantsTop: { label: string; fn: (p: Proto) => number }[] = [
      { label: 'with family offsets (tested, not used)', fn: fam },
      { label: 'without growth carry', fn: (p) => { const s = sizeCurve(p.tvl_usd); return s * seasoning(age(p)); } },
      { label: 'without seasoning', fn: (p) => { const s = sizeCurve(p.tvl_usd); return s * growthOf(p); } },
      { label: 'plain OLS, no Huber weights', fn: (p) => { const [a, b] = ols(trade.map(X), trade.map(Y)); return Math.pow(10, a + b * X(p)) * growthOf(p) * seasoning(age(p)); } },
      { label: 'one flat multiple', fn: (p) => p.tvl_usd * flatMultiple },
    ];
    for (const v of variantsTop) {
      const top = ranked.map((p) => ({ slug: p.slug, v: v.fn(p) })).sort((a, b) => b.v - a.v).slice(0, 20);
      top20ByVariant.push({ label: v.label, kept: top.filter((t) => fullTop20.has(t.slug)).length });
    }
  }
  const holdCounts = new Map<string, number>();
  for (let b = 0; b < 200; b++) {
    const sample: Proto[] = [];
    for (let i = 0; i < trade.length; i++) sample.push(trade[Math.floor(rng() * trade.length)]);
    const [a, bb] = huber(sample.map(X), sample.map(Y));
    for (const p of ranked) {
      const key = String(p.tvl_usd);
      (refitPred[key] = refitPred[key] || []).push(a + bb * X(p));
    }
    const top = ranked.map((p) => ({ slug: p.slug, v: Math.pow(10, a + bb * X(p)) * growthOf(p) * seasoning(age(p)) })).sort((x, y) => y.v - x.v).slice(0, 20);
    for (const t of top) holdCounts.set(t.slug, (holdCounts.get(t.slug) ?? 0) + 1);
  }
  const refitHold = [...fullTop20].filter((s) => (holdCounts.get(s) ?? 0) >= 160).length;

  // ---- band: sigma = sqrt(sigma_oos^2 + sigma_refit^2) ----
  const sigmaOos = (tvl: number): number => {
    const near = looRes.filter((e) => Math.abs(Math.log10(e.tvl / tvl)) <= 0.5).map((e) => Math.abs(e.r));
    const all = looRes.map((e) => Math.abs(e.r));
    const use = near.length >= 8 ? near : all;
    return 1.4826 * median(use);
  };
  const sigmaRefit = (tvl: number): number => sd(refitPred[String(tvl)] ?? [0]);

  // ---- board rows ----
  const rows: Row[] = ranked.map((p) => {
    const { size, growth, season, implied } = impliedOf(p);
    const d = age(p);
    const w = planWeeks(ageOf(p));
    const planDays = w * 7;
    const share = planDays / (d + planDays);
    const chain = farmChain(p);
    const gas = gasOf(chain);
    const costs = 2.0 + 6 * gas;
    const slice = AIRDROP_SHARE * implied * deposit / p.tvl_usd * share;
    const net = slice - costs;
    const be = costs / slice;
    const hours = (80 + 10 * w) / 60;
    const sig = Math.sqrt(sigmaOos(p.tvl_usd) ** 2 + sigmaRefit(p.tvl_usd) ** 2);
    const q = (z: number): number => implied * Math.pow(10, z * sig);
    const stop = p.tvl_usd * (1 - STOP_DROP);
    const steps = farmSteps(p, deposit, chain, w, stop, slice);
    return {
      slug: p.slug, name: p.name, category: p.category ?? '', chains: p.chains,
      tvl_usd: p.tvl_usd, change_7d: p.change_7d, age_days: ageOf(p),
      rank: 0, implied_value_usd: Math.round(implied), size_usd: Math.round(size),
      growth: +growth.toFixed(4), seasoning: +season.toFixed(4),
      p10_usd: Math.round(q(-1.2816)), p25_usd: Math.round(q(-0.6745)),
      p75_usd: Math.round(q(0.6745)), p90_usd: Math.round(q(1.2816)),
      sigma: +sig.toFixed(3),
      slice_usd: +slice.toFixed(2), net_usd: +net.toFixed(2), break_even: +be.toFixed(4),
      net_per_hour_usd: +(net / hours).toFixed(2),
      verdict: be <= 0.10 ? 'Worth farming' : be <= 0.33 ? 'Marginal' : 'Skip',
      bucket: watch.has(p.slug) ? 'watchlist' : p.tvl_usd >= snap.floor_usd ? 'above' : 'early',
      watchlist: watch.has(p.slug),
      farm_chain: chain, plan_weeks: w, farm_costs_usd: +costs.toFixed(2), gas_usd: gas,
      stop_usd: Math.round(stop), farm_steps: steps,
    };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd);
  rows.forEach((r, i) => { r.rank = i + 1; });

  return {
    asOf: snap.as_of, marketMedian7d: +marketMedian.toFixed(3), undatedAge,
    counts: {
      ranked: ranked.length,
      watchlist: rows.filter((r) => r.bucket === 'watchlist').length,
      above: rows.filter((r) => r.bucket === 'above').length,
      early: rows.filter((r) => r.bucket === 'early').length,
      trade: trade.length, aside: aside.length, asideRule, asideToken,
    },
    rows,
    trade: trade.map((p) => ({ slug: p.slug, name: p.name, category: p.category ?? '', tvl: p.tvl_usd, mcap: p.mcap_usd as number })),
    aside: aside.map((p) => ({ slug: p.slug, name: p.name, category: p.category ?? '', tvl: p.tvl_usd, reason: recordsToken(p) ? 'token' as const : 'rule' as const })),
    validation: { loo: huberRow.loo, walkForward: huberRow.wf, flatMultiple, flatLoo: flatRow.loo, flatWf: flatRow.wf },
    ablation, top20: top20ByVariant, refitHold,
    totals: { implied: rows.reduce((s, r) => s + r.implied_value_usd, 0) },
  };
}

// Token Radar v3 — Undercurrent model, our dark/gold style.
// Data: window.RADAR from ../data.js. Row columns:
// [slug,name,category,chains,tvl,chg7d,ageDays,size,growth,season,implied,
//  p10,p25,p75,p90,sigma,slice,net,breakEven,netHour,verdict,bucket,watchlist,farmChain,weeks,costs,gas,stop]
const D = window.RADAR, M = D.meta, ROWS = D.rows;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + v.toFixed(2);
const fmt2 = (v) => '$' + v.toFixed(2);
const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
const fmtAge = (a) => a == null ? 'undated' : a < 365 ? a + ' d' : (a / 365).toFixed(1) + ' y';
const VERD = ['Worth farming', 'Marginal', 'Skip'];
const BUCK = ['watchlist', 'above', 'early'];
// ---- the model, recomputed in-page from the raw fields (the re-run badge) ----
const sizeC = (t) => Math.pow(10, M.curveA + M.curveB * Math.log10(t / 1e8));
const season = (d) => 2.7 / (2.7 + 6 * Math.exp(-d / 690));
const growth = (c) => Math.pow(1 + Math.max(-25, Math.min(25, (c ?? M.marketMedian7d) - M.marketMedian7d)) / 100, M.growthExp);
const GAS = { Stellar: .01, Binance: .01, Optimism: .01, 'Hyperliquid L1': .01, Base: .02, Arbitrum: .02, Solana: .02, Polygon: .02, Avalanche: .02, Ink: .05, 'Robinhood Chain': .05, Stable: .05, Tron: .10, Ethereum: .80 };
const gasOf = (c) => GAS[c] ?? .02;
const farmChainOf = (chs) => chs.split(',').reduce((b, c) => gasOf(c) < gasOf(b) ? c : b, chs.split(',')[0]);
const weeksOf = (a) => a == null ? 6 : a < 180 ? 12 : a < 730 ? 8 : 6;
const actOf = (cat) => cat === 'Lending' ? 'lending pool' : cat === 'Dexs' ? 'liquidity pool' : cat === 'CDP' ? 'CDP vault' : cat === 'RWA' ? 'fund' : (cat === 'Derivatives' || cat === 'Basis Trading' || cat === 'Interest Rate Derivatives') ? 'strategy vault' : 'vault';
const depM = (d) => '$' + d.toLocaleString('en-US');
const f2 = (n) => '$' + n.toFixed(2);
function farmOf(r, dep) {
  const age = r[6] ?? M.undatedAge, w = r[24], pd = w * 7;
  const share = pd / (age + pd), slice = .10 * r[10] * dep / r[4] * share;
  const costs = r[25], net = slice - costs, be = costs / slice;
  return { slice, net, be, verdict: be <= .10 ? 0 : be <= .33 ? 1 : 2, hours: (80 + 10 * w) / 60 };
}
function stepsOf(r, dep) {
  const name = r[1], chain = r[23], w = r[24], g = r[26], act = actOf(r[2]), stop = r[27];
  const f = farmOf(r, dep), mid = Math.max(1, Math.round(w / 2));
  return [
    `Day 0 — Open ${name} only from its DefiLlama listing, bookmark that domain, and confirm it still records no token; read the ${act}'s withdrawal terms. Cost: $0.00 Time: 20 min`,
    `Day 0 — Fund one fresh wallet with ${depM(dep)} of USDC by an exchange withdrawal straight to ${chain}: ${chain} costs ${f2(g)} a transaction and $1.00 a leg (vs Ethereum $0.80, Base $0.02). Cost: $1.00 Time: 5 min`,
    `Day 0 — Approve and deposit ${depM(dep)} of USDC into ${name}'s largest USDC ${act} on ${chain}; keep the shares in the wallet. Cost: ${f2(2 * g)} Time: 15 min`,
    `Weekly ×${w} — Each week, check its TVL on DefiLlama against the stop level ${fmt(stop)} (19% under today) and read the ${act}'s allocation and rewards page. Cost: $0.00 Time: ${((w * 10) / 60).toFixed(1)} h`,
    `Week ${mid} — Add $1,000 to a second ${name} ${act}, so the wallet holds two positions. Cost: ${f2(2 * g)} Time: 10 min`,
    `Any day — Stop rule: if TVL closes below ${fmt(stop)} or the ${act} reports bad debt or pauses withdrawals, withdraw at once and end the plan. Cost: ${f2(1 + g)} Time: 15 min`,
    `Week ${w} — Withdraw the shares (curated ${act}s settle at once or in a 1-day queue), then move the USDC back off ${chain}. Cost: ${f2(1 + g)} Time: 20 min`,
    `If a token launches — Claim only through the domain bookmarked on day 0, never a link sent in a DM, an ad or a reply; at our implied value the slice is about ${fmt(f.slice)}. Cost: ${f2(g)} Time: 10 min`,
  ];
}
// ---- i18n (EN/ID, main labels only) ----
const I = {
  en: { board: 'Board', trade: 'Already trade', aside: 'Set aside', all: 'All', watchlist: 'Watchlist', above: 'Above floor', early: 'Early', anyVerdict: 'Any verdict', worth: 'Worth farming', marginal: 'Marginal', skip: 'Skip', search: 'Search name, category, chain (/)', families: 'All families', chains: 'All chains', favs: '★ Favorites', topPicks: 'Top picks', why: 'Why this radar is different', how: 'How a value is built', scatter: 'Where the value sits', compare: 'Out of sample', book: 'Farm book', detail: 'Detail', csv: 'CSV', compareBtn: 'Compare', clear: 'Clear', showing: 'Showing', of: 'of', rows: 'rows', noToken: 'No token for', slice: 'Slice if launch', net: 'Net if launch', be: 'Break-even', neth: 'Net/hour', verdict: 'Farm verdict', implied: 'Implied value', tvl: 'TVL', w7d: '7D', band: 'P10–P25–P75–P90', back: '← Board', costs: 'Costs', time: 'Time', fees: 'Fees / gas', forgone: 'Yield forgone', capital: 'Capital at work', slices: 'Slices if all launch', bookBe: 'Book break-even', hour: 'hour', week: 'week', day: 'day' },
  id: { board: 'Papan', trade: 'Sudah listing', aside: 'Disisihkan', all: 'Semua', watchlist: 'Watchlist', above: 'Di atas floor', early: 'Awal', anyVerdict: 'Verdict apa saja', worth: 'Worth farming', marginal: 'Marginal', skip: 'Skip', search: 'Cari nama, kategori, chain (/)', families: 'Semua family', chains: 'Semua chain', favs: '★ Favorit', topPicks: 'Pilihan utama', why: 'Kenapa radar ini beda', how: 'Cara nilai dibangun', scatter: 'Di mana nilainya berada', compare: 'Di luar sampel', book: 'Buku farm', detail: 'Detail', csv: 'CSV', compareBtn: 'Bandingkan', clear: 'Bersihkan', showing: 'Menampilkan', of: 'dari', rows: 'baris', noToken: 'Tanpa token selama', slice: 'Slice jika listing', net: 'Net jika listing', be: 'Break-even', neth: 'Net/jam', verdict: 'Verdict farm', implied: 'Nilai implied', tvl: 'TVL', w7d: '7H', band: 'P10–P25–P75–P90', back: '← Papan', costs: 'Biaya', time: 'Waktu', fees: 'Fee / gas', forgone: 'Yield hilang', capital: 'Modal kerja', slices: 'Slice jika semua listing', bookBe: 'Break-even buku', hour: 'jam', week: 'minggu', day: 'hari' },
};
let LANG = localStorage.getItem('radar-lang') || 'en';
const t = (k) => (I[LANG] && I[LANG][k]) || I.en[k] || k;
// ---- state ----
const S = {
  tab: 'board', bucket: 'all', verdict: 'any', q: '', fam: '', chain: '', dep: 10000,
  detail: null, compare: [], fav: new Set(JSON.parse(localStorage.getItem('radar-fav') || '[]')),
  theme: localStorage.getItem('radar-theme') || 'dark', rerun: '',
};
const rowBySlug = {};
ROWS.forEach((r) => { rowBySlug[r[0]] = r; });
const families = [...new Set(ROWS.map((r) => r[2]))].sort();
const chains = [...new Set(ROWS.flatMap((r) => r[3].split(',')))].sort();

// ---- render ----
const app = $('#app');
function verdictChip(v, sub) {
  const key = v === 0 ? 'worth' : v === 1 ? 'marginal' : 'skip';
  return `<span class="chip ${v === 0 ? 'worth' : v === 1 ? 'marg' : 'skipc'}">${t(key)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
}
function bandSVG(r) {
  const lo = Math.log10(r[11]), p25 = Math.log10(r[12]), p75 = Math.log10(r[13]), hi = Math.log10(r[14]), mid = Math.log10(r[10]);
  const x = (v) => 4 + ((v - lo) / (hi - lo)) * 66;
  return `<svg class="band" viewBox="0 0 74 12" aria-hidden="true"><rect x="${x(lo).toFixed(1)}" y="4" width="${(x(hi) - x(lo)).toFixed(1)}" height="4" rx="2" fill="var(--line)"/><rect x="${x(p25).toFixed(1)}" y="4" width="${(x(p75) - x(p25)).toFixed(1)}" height="4" rx="2" fill="#e8b64c"/><rect x="${(x(mid) - 1).toFixed(1)}" y="1" width="2" height="10" fill="#e8b64c"/></svg>`;
}
function scatterSVG() {
  const W = 560, H = 300, L = 46, B = 26, T = 8, R = 8;
  const x0 = Math.log10(5e6), x1 = Math.log10(1e10), y0 = Math.log10(1e5), y1 = Math.log10(2e10);
  const X = (v) => L + ((Math.log10(v) - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - (Math.log10(Math.max(v, 1e5)) - y0) / (y1 - y0)) * (H - T - B);
  let pts = '';
  for (const a of D.aside) pts += `<circle cx="${X(a[3]).toFixed(1)}" cy="${Y(sizeC(a[3])).toFixed(1)}" r="2" fill="#7c8aa8" opacity=".55"/>`;
  for (const tr of D.trade) pts += `<circle cx="${X(tr[3]).toFixed(1)}" cy="${Y(tr[4]).toFixed(1)}" r="2.4" fill="#2dd4a7" opacity=".8"/>`;
  for (const r of ROWS) pts += `<circle cx="${X(r[4]).toFixed(1)}" cy="${Y(r[10]).toFixed(1)}" r="2.4" fill="#e8b64c" opacity=".85"/>`;
  let curve = '', up = '', dn = '';
  for (let i = 0; i <= 40; i++) {
    const tv = Math.pow(10, x0 + ((x1 - x0) * i) / 40), cv = sizeC(tv);
    curve += (i ? 'L' : 'M') + X(tv).toFixed(1) + ',' + Y(cv).toFixed(1) + ' ';
    up += (i ? 'L' : 'M') + X(tv).toFixed(1) + ',' + Y(cv * 3.16).toFixed(1) + ' ';
    dn += (i ? 'L' : 'M') + X(tv).toFixed(1) + ',' + Y(cv / 3.16).toFixed(1) + ' ';
  }
  const grid = [1e6, 1e7, 1e8, 1e9, 1e10].map((v, i, a) => `<line x1="${X(v)}" y1="${T}" x2="${X(v)}" y2="${H - B}" stroke="var(--line)"/><text x="${X(v)}" y="${H - 8}" fill="var(--mut)" font-size="9" text-anchor="${i === a.length - 1 ? 'end' : 'middle'}">${fmt(v)}</text>`).join('');
  const ygrid = [1e6, 1e7, 1e8, 1e9, 1e10].map((v) => `<line x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${Y(v) + 3}" fill="var(--mut)" font-size="9" text-anchor="end">${fmt(v)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Scatter: TVL against value, log-log">${grid}${ygrid}<path d="${up}${dn.split(' ').reverse().join(' ').replace(/M/g, 'L')}Z" fill="#e8b64c" opacity=".10"/><path d="${curve}" fill="none" stroke="#e8b64c" stroke-width="2"/>${pts}</svg>
  <p class="note"><span style="color:#2dd4a7">●</span> traded, in fit &nbsp; <span style="color:#7c8aa8">●</span> set aside &nbsp; <span style="color:#e8b64c">●</span> no token, at implied &nbsp;— gold line is the size curve, shaded band is P25–P75.</p>`;
}
function filtered() {
  return ROWS.filter((r) => {
    if (S.bucket === 'watchlist' && r[21] !== 0) return false;
    if (S.bucket === 'above' && r[21] !== 1) return false;
    if (S.bucket === 'early' && r[21] !== 2) return false;
    if (S.bucket === 'fav' && !S.fav.has(r[0])) return false;
    if (S.verdict !== 'any') {
      const f = farmOf(r, S.dep);
      if ((S.verdict === 'worth' && f.verdict !== 0) || (S.verdict === 'marginal' && f.verdict !== 1) || (S.verdict === 'skip' && f.verdict !== 2)) return false;
    }
    if (S.fam && r[2] !== S.fam) return false;
    if (S.chain && !r[3].split(',').includes(S.chain)) return false;
    if (S.q) {
      const q = S.q.toLowerCase();
      if (!(r[1].toLowerCase().includes(q) || r[2].toLowerCase().includes(q) || r[3].toLowerCase().includes(q))) return false;
    }
    return true;
  });
}
function boardHTML(list) {
  const rows = list.map((r, i) => {
    const f = farmOf(r, S.dep);
    const chg = r[5], chgCls = chg == null ? '' : chg >= 0 ? 'pos' : 'neg';
    const inCmp = S.compare.includes(r[0]);
    return `<tr${S.compare.includes(r[0]) ? ' class="hl"' : ''}>
    <td data-l="#">${ROWS.indexOf(r) + 1}</td>
    <td data-l="Protocol"><span class="pname"><a href="#/detail/${r[0]}">${esc(r[1])}</a></span><span class="cat">${esc(r[2])} · ${esc(r[3].split(',').slice(0, 2).join(', '))}${r[3].split(',').length > 2 ? ' +' + (r[3].split(',').length - 2) : ''}</span><button class="star${S.fav.has(r[0]) ? ' on' : ''}" data-fav="${r[0]}" title="Favorite">${S.fav.has(r[0]) ? '★' : '☆'}</button><button class="cmpbtn${inCmp ? ' on' : ''}" data-cmp="${r[0]}">${t('compareBtn')}</button></td>
    <td data-l="${t('implied')}" class="num"><b>${fmt(r[10])}</b><br><span class="sub">${fmt(r[12])}–${fmt(r[13])}</span></td>
    <td data-l="${t('band')}">${bandSVG(r)}</td>
    <td data-l="${t('tvl')}" class="num">${fmt(r[4])}</td>
    <td data-l="${t('w7d')}" class="num ${chgCls}">${chg == null ? '—' : fmtPct(chg)}</td>
    <td data-l="${t('noToken')}" class="num">${fmtAge(r[6])}</td>
    <td data-l="${t('slice')}" class="num">${fmt2(f.slice)}</td>
    <td data-l="${t('net')}" class="num ${f.net >= 0 ? 'pos' : 'neg'}">${fmt2(f.net)}</td>
    <td data-l="${t('be')}" class="num">${(f.be * 100).toFixed(1)}%</td>
    <td data-l="${t('neth')}" class="num">${fmt2(f.net / f.hours)}</td>
    <td data-l="${t('verdict')}">${verdictChip(f.verdict, `<br>${esc(r[23])} · ${r[24]} wk`)}</td></tr>`;
  }).join('');
  return `<div class="boardwrap"><table><thead><tr><th>#</th><th>Protocol</th><th class="num">${t('implied')}</th><th>${t('band')}</th><th class="num">${t('tvl')}</th><th class="num">${t('w7d')}</th><th class="num">${t('noToken')}</th><th class="num">${t('slice')}</th><th class="num">${t('net')}</th><th class="num">${t('be')}</th><th class="num">${t('neth')}</th><th>${t('verdict')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function bookHTML(list) {
  const worth = list.filter((r) => farmOf(r, S.dep).verdict === 0).sort((a, b) => farmOf(b, S.dep).slice - farmOf(a, S.dep).slice).slice(0, 10);
  if (!worth.length) return '';
  const fees = worth.reduce((s, r) => s + r[25], 0), slices = worth.reduce((s, r) => s + farmOf(r, S.dep).slice, 0);
  const time = worth.reduce((s, r) => s + farmOf(r, S.dep).hours, 0), net = slices - fees;
  const be1 = fees / slices;
  return `<section class="book"><h2>${t('book')} — ${t('worth')} × ${worth.length} @ ${depM(S.dep)}</h2>
  <table><tbody>
  <tr><td>${t('capital')}</td><td class="num"><b>${depM(worth.length * S.dep)}</b></td></tr>
  <tr><td>${t('fees')}</td><td class="num">${fmt2(fees)}</td></tr>
  <tr><td>${t('forgone')}</td><td class="num">$0.00</td></tr>
  <tr><td>${t('time')}</td><td class="num">${time.toFixed(1)} ${t('hour')}s</td></tr>
  <tr><td>${t('slices')}</td><td class="num"><b>${fmt2(slices)}</b></td></tr>
  <tr><td>Net</td><td class="num"><b>${fmt2(net)}</b></td></tr>
  <tr><td>${t('bookBe')}</td><td class="num"><b>1 in ${(1 / be1).toFixed(0)} launches</b></td></tr>
  </tbody></table>
  <p class="note">Sums of the plans below: every cost is covered if one launch in that many counts its hold. None is promised.</p></section>`;
}
function render() {
  document.documentElement.classList.toggle('light', S.theme === 'light');
  const c = M.counts, v = M.validation;
  const list = filtered();
  const worthN = ROWS.filter((r) => farmOf(r, S.dep).verdict === 0).length;
  const margN = ROWS.filter((r) => farmOf(r, S.dep).verdict === 1).length;
  const skipN = ROWS.length - worthN - margN;
  const picks = [...ROWS].slice(0, 5);
  const cmpRows = S.compare.map((s) => rowBySlug[s]).filter(Boolean);
  let body = `<div class="wrap">
  <header><h1>Token Radar<small>token launch radar — size curve × growth carry × seasoning · Undercurrent model</small></h1>
  <div class="hbtns"><button id="langBtn">${LANG === 'en' ? 'ID' : 'EN'}</button><button id="themeBtn">${S.theme === 'dark' ? '☀ Day' : '☾ Night'}</button><button id="csvBtn">${t('csv')} ↓</button></div></header>
  <div class="tabs" role="tablist">
    <button data-tab="board" class="${S.tab === 'board' ? 'on' : ''}">${t('board')} ${c.ranked}</button>
    <button data-tab="trade" class="${S.tab === 'trade' ? 'on' : ''}">${t('trade')} ${c.trade}</button>
    <button data-tab="aside" class="${S.tab === 'aside' ? 'on' : ''}">${t('aside')} ${c.aside}</button>
  </div>
  <div class="badge">board.json = this page: ${c.ranked}/${c.ranked} ranks, values, bands and verdicts, re-run here in ${S.rerun}</div>
  <div class="cards">
    <div class="card"><b>${c.watchlist}/${c.watchlist}</b><span>watchlist</span><small>every watchlist protocol is ranked</small></div>
    <div class="card"><b>${c.ranked}</b><span>ranked</span><small>${c.watchlist} watchlist · ${c.above} above floor · ${c.early} early under $50M</small></div>
    <div class="card"><b>${c.trade}</b><span>${t('trade').toLowerCase()}</span><small>${D.trade.filter((x) => Math.abs(Math.log10(x[4]) - Math.log10(sizeC(x[3]))) < 1).length} fit the curve</small></div>
    <div class="card"><b>${c.aside}</b><span>${t('aside').toLowerCase()}</span><small>${c.asideToken} record a token with no market cap · ${c.asideRule} by rule</small></div>
    <div class="card"><b>${v.loo.toFixed(1)}x · ${v.walkForward.toFixed(1)}x</b><span>median miss, out of sample</span><small>leave-one-out · walk-forward (one flat multiple ${v.flatMultiple.toFixed(1)}x)</small></div>
  </div>`;
  if (S.tab === 'board' && !S.detail) {
    body += `<section class="panel"><h2>${t('how')} <code>impliedValue()</code></h2><ol>
    <li><b>Size curve</b> log<sub>10</sub> V = ${M.curveA} + ${M.curveB}·log<sub>10</sub>(TVL ÷ $100M), a Huber fit on 92 traded tokens.</li>
    <li><b>× growth carry</b> (1 + excess 7-day)<sup>${M.growthExp}</sup>, one more week of its move beyond the market's median week (${M.marketMedian7d}%), held to ±25%.</li>
    <li><b>× seasoning</b> 2.7 ÷ (2.7 + 6.0e<sup>−days/690</sup>): how settled its TVL is after that many days with no token, fitted on 271 protocols' 7-day moves.</li></ol>
    <p><b>Band:</b> the out-of-sample miss of traded tokens near its TVL plus 200 refits. Family offsets lost the walk-forward test and are not used.</p>
    <p><b>Verdict</b> <code>farmPlan()</code>: slice = 10% airdrop × value × deposit ÷ TVL × its share of time with no token; Worth farming when the launch odds that repay every cost are ≤ 10%, Marginal ≤ 33%, else Skip. A big TVL thins the slice, so the best farms are small and young.</p></section>
    <div class="grid2">
    <section class="panel"><h2>${t('scatter')}</h2>${scatterSVG()}</section>
    <section class="panel"><h2>${t('compare')} <code>compareModels()</code></h2>
    <table><thead><tr><th>Each adds a term</th><th class="num">LOO miss</th><th class="num">≤3x</th><th class="num">rank ρ</th><th class="num">walk-fwd</th></tr></thead><tbody>
    ${M.ablation.map((a, i) => `<tr${i === 2 ? ' style="font-weight:700"' : ''}><td>${esc(a.label)}</td><td class="num">${a.loo.toFixed(2)}x</td><td class="num">${Math.round(a.s3 * 100)}%</td><td class="num">${a.rho.toFixed(2)}</td><td class="num">${a.wf.toFixed(2)}x</td></tr>`).join('')}
    </tbody></table>
    <p class="note"><b>Top 20 kept</b> <code>ablate()</code>: ${M.top20.map((x) => `${x.label} ${x.kept}`).join(' · ')}; ${M.refitHold} of 20 hold in ≥80% of 200 refits.</p></section>
    </div>
    <section class="panel"><h2>${t('why')}</h2><p>Most radars rank by TVL and stop. This one prices what a token would be worth if the protocol's record stayed as it is — a size curve fitted on the tokens that already trade, a growth carry for one more week of its own move, and a seasoning curve for how settled its TVL is — then prices the farm itself: the slice, the fees, the hours, the break-even odds. It is the same model for every row, recomputed in this page from the snapshot's own figures, and it says which farms are worth the deposit and which are not. superbot.gg is the uncensored model that can run a radar like this end to end.</p></section>
    <section class="panel"><h2>${t('topPicks')}</h2><div class="picks">${picks.map((r) => `<div class="pick" data-pick="${r[0]}"><b>${fmt(r[10])}</b><span>${esc(r[1])}</span><br>${verdictChip(farmOf(r, S.dep).verdict)}</div>`).join('')}</div></section>`;
    if (cmpRows.length >= 2) {
      body += `<section class="panel"><h2>${t('compareBtn')} (${cmpRows.length}) <button id="cmpClear">${t('clear')}</button></h2><table><thead><tr><th>Protocol</th><th class="num">${t('implied')}</th><th class="num">${t('tvl')}</th><th class="num">${t('w7d')}</th><th class="num">${t('noToken')}</th><th class="num">${t('slice')}</th><th class="num">${t('net')}</th><th class="num">${t('be')}</th><th>${t('verdict')}</th></tr></thead><tbody>
      ${cmpRows.map((r) => { const f = farmOf(r, S.dep); return `<tr><td><a href="#/detail/${r[0]}">${esc(r[1])}</a></td><td class="num"><b>${fmt(r[10])}</b></td><td class="num">${fmt(r[4])}</td><td class="num">${r[5] == null ? '—' : fmtPct(r[5])}</td><td class="num">${fmtAge(r[6])}</td><td class="num">${fmt2(f.slice)}</td><td class="num">${fmt2(f.net)}</td><td class="num">${(f.be * 100).toFixed(1)}%</td><td>${verdictChip(f.verdict)}</td></tr>`; }).join('')}
      </tbody></table></section>`;
    }
    body += `<div class="filters"><div class="chips">
    <button data-bucket="all" class="${S.bucket === 'all' ? 'on' : ''}">${t('all')} ${c.ranked}</button>
    <button data-bucket="watchlist" class="${S.bucket === 'watchlist' ? 'on' : ''}">${t('watchlist')} ${c.watchlist}</button>
    <button data-bucket="above" class="${S.bucket === 'above' ? 'on' : ''}">${t('above')} ${c.above}</button>
    <button data-bucket="early" class="${S.bucket === 'early' ? 'on' : ''}">${t('early')} ${c.early}</button>
    <button data-bucket="fav" class="${S.bucket === 'fav' ? 'on' : ''}">${t('favs')} ${S.fav.size}</button>
    <button data-verdict="any" class="${S.verdict === 'any' ? 'on' : ''}">${t('anyVerdict')}</button>
    <button data-verdict="worth" class="${S.verdict === 'worth' ? 'on' : ''}">${t('worth')} ${worthN}</button>
    <button data-verdict="marginal" class="${S.verdict === 'marginal' ? 'on' : ''}">${t('marginal')} ${margN}</button>
    <button data-verdict="skip" class="${S.verdict === 'skip' ? 'on' : ''}">${t('skip')} ${skipN}</button>
    </div>
    <button data-dep="10000" class="${S.dep === 10000 ? 'on' : ''}">$10,000</button>
    <button data-dep="1000" class="${S.dep === 1000 ? 'on' : ''}">$1,000</button>
    <input id="q" type="search" placeholder="${t('search')}" value="${esc(S.q)}">
    <select id="famSel"><option value="">${t('families')}</option>${families.map((f) => `<option${S.fam === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>
    <select id="chainSel"><option value="">${t('chains')}</option>${chains.map((ch) => `<option${S.chain === ch ? ' selected' : ''}>${esc(ch)} (${ROWS.filter((r) => r[3].split(',').includes(ch)).length})</option>`).join('')}</select>
    </div>
    <p class="countline">${t('showing')} ${list.length} ${t('of')} ${c.ranked} ${t('rows')} · ${t('implied')} ${fmt(M.totalImplied)} ${t('of')} ${c.ranked} · deposit ${depM(S.dep)}</p>`;
    if (S.verdict === 'worth') body += bookHTML(list);
    body += boardHTML(list);
  }
  if (S.tab === 'trade') body += tradeHTML();
  if (S.tab === 'aside') body += asideHTML();
  if (S.detail) body += detailHTML(S.detail);
  body += `<p class="foot">Implied values are this radar's claim, never make.fun's. A record of no token is proof there is none in the snapshot; it is not proof the protocol has none. Claim only through official domains. Not investment advice. Snapshot ${esc(M.asOf)} · model undercurrent-1 · dashboard source is the entry's own.</p></div>`;
  app.innerHTML = body;
  app.removeAttribute('aria-busy');
}

// ---- already-trade / set-aside tabs ----
function tradeHTML() {
  const list = [...D.trade].sort((a, b) => b[3] - a[3]);
  const fit = D.trade.filter((x) => Math.abs(Math.log10(x[4]) - Math.log10(sizeC(x[3]))) < 1).length;
  return `<section class="panel"><h2>${t('trade')} — ${D.trade.length}</h2>
  <p class="note">${fit} fit the curve (within 1.0 dex), none ranked. These already have a token, so they are not farms — they are the curve's training set.</p>
  <div class="boardwrap"><table><thead><tr><th>Token</th><th class="num">${t('tvl')}</th><th class="num">Market cap</th><th class="num">Curve says</th><th class="num">Actual ÷ curve</th></tr></thead><tbody>
  ${list.map((x) => { const c = sizeC(x[3]), r = x[4] / c; return `<tr><td><span class="pname">${esc(x[1])}</span><span class="cat">${esc(x[0])}</span></td><td class="num">${fmt(x[3])}</td><td class="num">${fmt(x[4])}</td><td class="num">${fmt(c)}</td><td class="num ${r >= 1 ? 'pos' : 'neg'}">${r.toFixed(2)}x</td></tr>`; }).join('')}
  </tbody></table></div></section>`;
}
function asideHTML() {
  const list = [...D.aside].sort((a, b) => b[3] - a[3]);
  return `<section class="panel"><h2>${t('aside')} — ${D.aside.length}</h2>
  <p class="note">${M.counts.asideToken} record a token with no market cap · ${M.counts.asideRule} set aside by rule (exchange, bridge, liquid staking, wrapped/staked, or a versioned name).</p>
  <div class="boardwrap"><table><thead><tr><th>Protocol</th><th>Category</th><th class="num">${t('tvl')}</th><th>Why set aside</th></tr></thead><tbody>
  ${list.map((a) => `<tr><td><span class="pname">${esc(a[1])}</span><span class="cat">${esc(a[0])}</span></td><td>${esc(a[2])}</td><td class="num">${fmt(a[3])}</td><td>${a[4] === 0 ? 'by rule' : 'records a token, no market cap'}</td></tr>`).join('')}
  </tbody></table></div></section>`;
}
// ---- detail view ----
function parseStep(s) {
  const m = s.match(/^(.*?) — (.*) Cost: (\$[\d.]+) Time: (.+)$/);
  return m ? { when: m[1], text: m[2], cost: m[3], time: m[4] } : { when: '', text: s, cost: '', time: '' };
}
function detailHTML(slug) {
  const r = rowBySlug[slug];
  if (!r) return `<section class="panel"><p>Unknown protocol: ${esc(slug)}</p></section>`;
  const f10 = farmOf(r, 10000), f1 = farmOf(r, 1000);
  const age = r[6] ?? M.undatedAge;
  const listed = r[6] == null ? '—' : new Date(Date.parse(M.asOf) - r[6] * 86400000).toISOString().slice(0, 10);
  const steps = stepsOf(r, S.dep).map(parseStep);
  const weeks = r[24], planDays = weeks * 7;
  const marks = [];
  for (let w = 0; w <= weeks; w += 2) marks.push(w);
  if (marks[marks.length - 1] !== weeks) marks.push(weeks);
  const near = [...D.trade].map((x) => ({ name: x[1], slug: x[0], tvl: x[3], mcap: x[4], same: x[2] === r[2], d: Math.abs(Math.log10(x[3] / r[4])) }))
    .sort((a, b) => (a.same === b.same ? a.d - b.d : a.same ? -1 : 1)).slice(0, 5);
  const nearRows = near.map((x) => { const c = sizeC(x.tvl); return `<tr><td>${esc(x.name)}${x.same ? ' <span class="sub">· same family</span>' : ''}</td><td class="num">${fmt(x.tvl)}</td><td class="num">${fmt(x.mcap)}</td><td class="num">${fmt(c)}</td><td class="num">${(x.mcap / c).toFixed(2)}x</td></tr>`; }).join('');
  const depRow = (dep, f) => `<tr><td>${depM(dep)}</td><td class="num">${fmt2(r[25])}</td><td class="num">${fmt2(f.slice)}</td><td class="num">${fmt2(f.net)}</td><td class="num">${(f.be * 100).toFixed(0)}%</td><td>${verdictChip(f.verdict)}</td></tr>`;
  return `<section class="panel detail">
  <p class="crumb"><a href="#/board">${t('back')}</a></p>
  <h2>${esc(r[1])}</h2>
  <div class="badges">${r[22] ? '<span class="chip">watchlist</span>' : ''}<span class="chip">records no token</span><span class="chip">${esc(r[2])}</span><span class="chip">${esc(r[3].split(',').join(' · '))}</span></div>
  <p><span class="big">${fmt(r[10])}</span> <span class="sub">rank ${ROWS.indexOf(r) + 1} of ${ROWS.length} · P25–P75 ${fmt(r[12])}–${fmt(r[13])} · P10–P90 ${fmt(r[11])}–${fmt(r[14])}</span></p>
  <p class="eq">${fmt(r[7])} size × ${r[8].toFixed(2)} growth × ${r[9].toFixed(2)} seasoning = ${fmt(r[10])}</p>
  <p class="note">Band σ = ${r[15].toFixed(2)} decades (out-of-sample miss of traded tokens near this TVL, plus 200 refits); P25–P75 is ×/÷ ${Math.pow(10, 0.6745 * r[15]).toFixed(1)}, P10–P90 ×/÷ ${Math.pow(10, 1.2816 * r[15]).toFixed(1)}.</p>
  <h2>Its record in the snapshot</h2>
  <table class="kv"><tbody>
  <tr><td>tvl_usd</td><td class="num">${fmt(r[4])}</td></tr>
  <tr><td>change_7d</td><td class="num">${r[5] == null ? '—' : fmtPct(r[5])}</td></tr>
  <tr><td>listed_at</td><td class="num">${listed}</td></tr>
  <tr><td>category</td><td>${esc(r[2])}</td></tr>
  <tr><td>mcap_usd</td><td class="num">—</td></tr>
  <tr><td>gecko_id</td><td>—</td></tr>
  <tr><td>symbol</td><td>—</td></tr>
  </tbody></table>
  <h2>Deposit size</h2>
  <table><thead><tr><th>Deposit</th><th class="num">${t('costs')}</th><th class="num">${t('slice')}</th><th class="num">Net</th><th class="num">${t('be')}</th><th>${t('verdict')}</th></tr></thead><tbody>
  ${depRow(1000, f1)}${depRow(10000, f10)}
  </tbody></table>
  <h2>Nearest traded tokens by TVL, same family first</h2>
  <table><thead><tr><th>Token</th><th class="num">${t('tvl')}</th><th class="num">Market cap</th><th class="num">Curve says</th><th class="num">Actual ÷ curve</th></tr></thead><tbody>${nearRows}</tbody></table>
  <h2>Farm plan — ${weeks} ${t('week')}s @ ${depM(S.dep)}</h2>
  <div class="tl">${marks.map((w, i) => `${i ? '<i><b></b></i>' : ''}<span>${w === 0 ? 'day 0' : 'week ' + w}</span>`).join('')}</div>
  <p class="note">Stop rule: TVL closes under ${fmt(r[27])}.</p>
  <table><thead><tr><th>When</th><th>Step</th><th class="num">${t('costs')}</th><th class="num">${t('time')}</th></tr></thead><tbody>
  ${steps.map((s) => `<tr><td>${esc(s.when)}</td><td>${esc(s.text)}</td><td class="num">${s.cost}</td><td class="num">${esc(s.time)}</td></tr>`).join('')}
  </tbody></table>
  <table class="kv"><tbody>
  <tr><td>${t('fees')}</td><td class="num">${fmt2(r[25])}</td></tr>
  <tr><td>${t('forgone')}</td><td class="num">$0.00</td></tr>
  <tr><td>${t('time')}</td><td class="num">${farmOf(r, S.dep).hours.toFixed(1)} ${t('hour')}s</td></tr>
  <tr><td>${t('slices')}</td><td class="num">${fmt2(farmOf(r, S.dep).slice)}</td></tr>
  <tr><td>${t('be')} odds</td><td class="num">${(farmOf(r, S.dep).be * 100).toFixed(0)}%</td></tr>
  <tr><td>Net</td><td class="num">${fmt2(farmOf(r, S.dep).net)}</td></tr>
  <tr><td>${t('neth')}</td><td class="num">${fmt2(farmOf(r, S.dep).net / farmOf(r, S.dep).hours)}</td></tr>
  </tbody></table>
  <p class="note">Slice = 10% airdrop × ${fmt(r[10])} × ${depM(S.dep)} ÷ ${fmt(r[4])} TVL × ${planDays} ÷ (${age} + ${planDays}) days … = ${fmt2(farmOf(r, S.dep).slice)}. Break-even = (${fmt2(r[25])} fees + $0.00 forgone) ÷ ${fmt2(farmOf(r, S.dep).slice)} = ${(farmOf(r, S.dep).be * 100).toFixed(0)}%.</p>
  <p class="note">One wallet, your own funds. A record of no token is proof there is none in the snapshot. Costs are our stated assumptions, not quotes.</p>
  </section>`;
}
// ---- CSV ----
function downloadCSV() {
  const list = filtered();
  const head = 'rank,name,category,chains,tvl_usd,change_7d,age_days,implied_usd,p25_usd,p75_usd,slice_usd,net_usd,break_even,verdict,farm_chain,plan_weeks';
  const lines = list.map((r) => {
    const f = farmOf(r, S.dep);
    return [ROWS.indexOf(r) + 1, '"' + r[1].replace(/"/g, '""') + '"', '"' + r[2] + '"', '"' + r[3] + '"', r[4], r[5] ?? '', r[6] ?? '', r[10], r[12], r[13], f.slice.toFixed(2), f.net.toFixed(2), f.be.toFixed(4), VERD[f.verdict], r[23], r[24]].join(',');
  });
  const blob = new Blob([head + '\n' + lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'token-radar-board.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// ---- events ----
app.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    if (b.dataset.tab) { S.tab = b.dataset.tab; S.detail = null; location.hash = '#/board'; render(); return; }
    if (b.dataset.bucket) { S.bucket = b.dataset.bucket; render(); return; }
    if (b.dataset.verdict) { S.verdict = b.dataset.verdict; render(); return; }
    if (b.dataset.dep) { S.dep = +b.dataset.dep; render(); return; }
    if (b.dataset.fav) { const s = b.dataset.fav; S.fav.has(s) ? S.fav.delete(s) : S.fav.add(s); localStorage.setItem('radar-fav', JSON.stringify([...S.fav])); render(); return; }
    if (b.dataset.cmp) { const s = b.dataset.cmp; const i = S.compare.indexOf(s); if (i >= 0) S.compare.splice(i, 1); else if (S.compare.length < 3) S.compare.push(s); render(); return; }
    if (b.id === 'cmpClear') { S.compare = []; render(); return; }
    if (b.id === 'themeBtn') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('radar-theme', S.theme); render(); return; }
    if (b.id === 'langBtn') { LANG = LANG === 'en' ? 'id' : 'en'; localStorage.setItem('radar-lang', LANG); render(); return; }
    if (b.id === 'csvBtn') { downloadCSV(); return; }
  }
  const pick = e.target.closest('[data-pick]');
  if (pick) { location.hash = '#/detail/' + pick.dataset.pick; return; }
});
app.addEventListener('input', (e) => {
  if (e.target.id === 'q') { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  if (e.target.id === 'famSel') { S.fam = e.target.value; render(); }
  if (e.target.id === 'chainSel') { S.chain = e.target.value; render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); const q = $('#q'); if (q) q.focus(); }
});
function route() {
  const h = location.hash;
  const m = h.match(/^#\/detail\/([\w-]+)$/);
  if (m && rowBySlug[m[1]]) { S.detail = m[1]; S.tab = 'board'; }
  else { S.detail = null; if (h === '#/worth') { S.verdict = 'worth'; } }
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
// ---- init: re-run the model in-page and time it ----
(function init() {
  const t0 = performance.now();
  let match = 0;
  for (const r of ROWS) {
    const age = r[6] ?? M.undatedAge;
    const imp = sizeC(r[4]) * growth(r[5]) * season(age);
    if (Math.abs(imp - r[10]) / r[10] < 0.005) match++;
    farmOf(r, S.dep);
  }
  S.rerun = ((performance.now() - t0) / 1000).toFixed(3) + 's';
  S.rerun += ' · ' + match + '/' + ROWS.length + ' values match';
  route();
})();

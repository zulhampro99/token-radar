// Gate check for token-radar-03 (Undercurrent model). Usage: node gate-check.mjs [outDir] [snapshotPath]
// All rows must PASS. Exit 0 when all pass, 1 otherwise.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'out';
const SNAPSHOT = process.argv[3] || '/home/hatch/workspace/makefun/token-radar-01-kit/input/snapshot.json';
const DASH_CAP = 65536;

let pass = 0, fail = 0;
function row(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (ok) pass++; else fail++;
}

const dashFiles = ['index.html', 'app.css', 'app.js'];
const dashSizes = {};
let dashOk = true, dashTotal = 0;
for (const f of dashFiles) {
  const p = join(OUT, 'dashboard', f);
  if (!existsSync(p)) { dashOk = false; continue; }
  dashSizes[f] = statSync(p).size;
  dashTotal += dashSizes[f];
}
row('dashboard files exist', dashOk, dashFiles.map((f) => f + ' ' + (dashSizes[f] ?? 'MISSING') + 'B').join(', ') + ' — total ' + dashTotal + ' bytes');
row('dashboard source under judge cap', dashTotal < DASH_CAP, dashTotal + ' / ' + DASH_CAP + ' bytes (' + (DASH_CAP - dashTotal) + ' headroom)');
// no http(s) addresses in any dashboard file (the no-network rule)
let netOk = true, netDetail = '';
for (const f of dashFiles) {
  const txt = readFileSync(join(OUT, 'dashboard', f), 'utf8');
  if (/https?:\/\//.test(txt)) { netOk = false; netDetail = f + ' names an http(s) address'; break; }
}
row('dashboard names no network address', netOk, netDetail || 'no http:// or https:// in index.html, app.css, app.js');

let board = null, boardOk = false;
try {
  board = JSON.parse(readFileSync(join(OUT, 'board.json'), 'utf8'));
  boardOk = Array.isArray(board.rows) && board.rows.length >= 100 && board.rows.length <= 4000;
} catch (e) { boardOk = false; }
row('board.json valid', boardOk, boardOk ? board.rows.length + ' rows (100–4000)' : 'unparseable or out of range');

let sortedOk = false, sortedDetail = '';
if (boardOk) {
  sortedOk = true;
  const ranks = new Set();
  for (let i = 0; i < board.rows.length; i++) {
    const r = board.rows[i];
    if (r.rank !== i + 1) { sortedOk = false; sortedDetail = 'row ' + i + ' has rank ' + r.rank + ', expected ' + (i + 1); break; }
    if (ranks.has(r.slug)) { sortedOk = false; sortedDetail = 'duplicate slug ' + r.slug; break; }
    ranks.add(r.slug);
    if (i > 0 && board.rows[i].implied_value_usd > board.rows[i - 1].implied_value_usd) { sortedOk = false; sortedDetail = 'row ' + i + ' (' + board.rows[i].slug + ') exceeds previous'; break; }
  }
  if (sortedOk) sortedDetail = 'ranks 1–' + board.rows.length + ' once each, top ' + board.rows[0].name + ' $' + board.rows[0].implied_value_usd.toLocaleString('en-US');
}
row('rows sorted by implied value desc, ranks 1–N', sortedOk, sortedDetail);

let covOk = false, covDetail = '';
try {
  const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  const inBoard = new Set(board.rows.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !inBoard.has(s));
  covOk = missing.length === 0 && snap.watchlist.length === 40;
  covDetail = snap.watchlist.length - missing.length + '/' + snap.watchlist.length + ' watchlist slugs on the board' + (missing.length ? ' — missing: ' + missing.slice(0, 5).join(', ') : '');
} catch (e) { covDetail = 'snapshot unreadable: ' + e.message; }
row('coverage 40/40 watchlist', covOk, covDetail);

let farmOk = true, farmDetail = '';
if (boardOk) {
  for (const r of board.rows) {
    const steps = r.farm_steps;
    if (!Array.isArray(steps) || steps.length < 3 || steps.length > 12) { farmOk = false; farmDetail = r.slug + ' has ' + (steps ? steps.length : 0) + ' steps'; break; }
    for (const s of steps) {
      const t = typeof s === 'string' ? s.trim() : '';
      if (!t || t.length < 20 || t.length > 600) { farmOk = false; farmDetail = r.slug + ' step is ' + t.length + ' chars: ' + JSON.stringify(t).slice(0, 80); break; }
    }
    if (!farmOk) break;
  }
  if (farmOk) farmDetail = 'every row has 3–12 farm steps, each 20–600 chars';
}
row('every row has 3–12 farm steps (20–600 chars)', farmOk, farmDetail);

const shotNames = ['1-board.png', '2-worth-farming.png', '3-detail.png'];
let shotOk = true, shotDetail = '';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
for (const n of shotNames) {
  const p = join(OUT, 'screenshots', n);
  if (!existsSync(p)) { shotOk = false; shotDetail = n + ' missing'; break; }
  const buf = readFileSync(p);
  if (!buf.subarray(0, 8).equals(PNG) || buf.length < 10000) { shotOk = false; shotDetail = n + ' is not a real screenshot (' + buf.length + ' bytes)'; break; }
  // PNG dimensions: width/height at bytes 16/20 (IHDR, big-endian)
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (Math.max(w, h) > 1440 || Math.min(w, h) < 800) { shotOk = false; shotDetail = n + ' is ' + w + 'x' + h + ' (long side > 1440 or short side < 800)'; break; }
  shotDetail += (shotDetail ? ', ' : '') + n + ' ' + w + 'x' + h + ' ' + buf.length + 'B';
}
row('3 real screenshots (long side ≤1440, short side ≥800)', shotOk, shotDetail);

let dossierOk = false, dossierDetail = '';
try {
  const dos = JSON.parse(readFileSync(join(OUT, 'dossier.json'), 'utf8'));
  dossierOk = dos.schema === 'makefun/dossier/v1' && Array.isArray(dos.images) && dos.images.length === 3 && typeof dos.text === 'string';
  dossierDetail = dossierOk ? 'schema ok, 3 images, text ' + Buffer.byteLength(dos.text, 'utf8') + ' bytes (cap 65536)' : 'dossier shape wrong';
} catch (e) { dossierDetail = 'dossier.json unreadable: ' + e.message; }
row('dossier.json present and shaped', dossierOk, dossierDetail);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

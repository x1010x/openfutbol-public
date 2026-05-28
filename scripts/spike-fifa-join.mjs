// Spike: join temp/world.pack.json against FIFA CSVs in ~/lab/pcfurbo/data
// via (dob, normalized name-token). Scoped to the top division of 8 countries.
// Latest FIFA year wins. Reports match rate and prints unmatched samples.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACK_PATH = resolve('temp/world.pack.json');
const FIFA_DIR = resolve(process.env.HOME, 'lab/pcfurbo/data');
const YEARS = [15, 16, 17, 18, 19, 20, 21, 22];

const TOP_LEAGUES = new Set([
  'Premier League',     // England
  'La Liga',            // Spain
  'Serie A',            // Italy
  'Bundesliga',         // Germany
  'Ligue 1',            // France
  'Premier Division',   // Argentina
  'Liga MX',            // Mexico
  'Série A',            // Brazil
]);

const normTokens = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const lastOf = (toks) => toks[toks.length - 1] ?? '';

function parseCsv(text) {
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      field += c; continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (c === '\r') continue;
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadFifaIndex() {
  const byKey = new Map(); // (dob|token) → { year, name, sofifa_id }
  let totalRows = 0;
  for (const yr of YEARS) {
    const text = readFileSync(`${FIFA_DIR}/players_${yr}.csv`, 'utf8');
    const rows = parseCsv(text);
    const h = rows[0];
    const ciSofifa = h.indexOf('sofifa_id');
    const ciLong = h.indexOf('long_name');
    const ciShort = h.indexOf('short_name');
    const ciDob = h.indexOf('dob');
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < h.length - 3) continue;
      const dob = row[ciDob]; if (!dob) continue;
      const long = row[ciLong] || '';
      const short = row[ciShort] || '';
      const entry = { year: yr, name: long, short, sofifa_id: row[ciSofifa] };
      const keys = new Set();
      for (const src of [long, short]) {
        const toks = normTokens(src);
        if (toks.length === 0) continue;
        keys.add(`${dob}|${lastOf(toks)}`);
        if (toks.length === 1) keys.add(`${dob}|${toks[0]}`);
      }
      for (const k of keys) byKey.set(k, entry); // later year overwrites
      totalRows++;
    }
  }
  return { byKey, totalRows };
}

const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));

const targetCountries = new Set(['Argentina','Brazil','England','France','Germany','Italy','Mexico','Spain']);
const countryIds = new Set(pack.countries.filter(c => targetCountries.has(c.name)).map(c => c.id));
const leagueIds = new Set(pack.leagues.filter(l => countryIds.has(l.country_id) && TOP_LEAGUES.has(l.name)).map(l => l.id));
const clubIds = new Set(pack.clubs.filter(c => leagueIds.has(c.league_id)).map(c => c.id));

const scopedPlayers = pack.players.filter(p => clubIds.has(p.club_id));
console.log(`Scope: ${TOP_LEAGUES.size} top divisions, ${clubIds.size} clubs, ${scopedPlayers.length} players`);

console.time('fifa index');
const { byKey, totalRows } = loadFifaIndex();
console.timeEnd('fifa index');
console.log(`fifa rows scanned: ${totalRows}, keys: ${byKey.size}`);

const tryMatch = (p) => {
  const dob = p.birth_date;
  const fn = normTokens(p.first_name || '');
  const ln = normTokens(p.last_name || '');
  const candidates = new Set();
  if (ln.length) candidates.add(lastOf(ln));
  if (fn.length && ln.length === 0) candidates.add(lastOf(fn)); // mononym
  if (fn.length === 1 && ln.length === 1) {
    candidates.add(ln[0]); candidates.add(fn[0]);
  }
  for (const t of candidates) {
    const hit = byKey.get(`${dob}|${t}`);
    if (hit) return hit;
  }
  return null;
};

let matched = 0;
const byYear = new Map();
const unmatched = [];
for (const p of scopedPlayers) {
  const hit = tryMatch(p);
  if (hit) {
    matched++;
    byYear.set(hit.year, (byYear.get(hit.year) ?? 0) + 1);
  } else if (unmatched.length < 25) {
    unmatched.push(`${p.first_name} ${p.last_name} (${p.birth_date}) ca=${p.current_ability}`);
  }
}

const pct = (matched / scopedPlayers.length * 100).toFixed(1);
console.log(`\nMATCHED (top-div, 8 countries): ${matched}/${scopedPlayers.length} (${pct}%)`);
console.log('matched-by-FIFA-year:', Object.fromEntries([...byYear].sort()));

// Per-league breakdown
const leagueOfClub = new Map(pack.clubs.map(c => [c.id, c.league_id]));
const nameOfLeague = new Map(pack.leagues.map(l => [l.id, l.name]));
const countryOfLeague = new Map(pack.leagues.map(l => [l.id, l.country_id]));
const countryName = new Map(pack.countries.map(c => [c.id, c.name]));
const perLeague = new Map();
for (const p of scopedPlayers) {
  const lid = leagueOfClub.get(p.club_id);
  const key = `${countryName.get(countryOfLeague.get(lid))} / ${nameOfLeague.get(lid)}`;
  const cur = perLeague.get(key) ?? { matched: 0, total: 0 };
  cur.total++;
  if (tryMatch(p)) cur.matched++;
  perLeague.set(key, cur);
}
console.log('\nper-league:');
for (const [name, { matched, total }] of [...perLeague.entries()].sort()) {
  console.log(`  ${name}: ${matched}/${total} (${(matched/total*100).toFixed(0)}%)`);
}

// Hit-rate by CA tier
const tiers = [[150, 200], [130, 149], [110, 129], [90, 109], [0, 89]];
console.log('\nby CA tier (within scope):');
for (const [lo, hi] of tiers) {
  const pool = scopedPlayers.filter(p => p.current_ability >= lo && p.current_ability <= hi);
  const hit = pool.filter(p => tryMatch(p)).length;
  if (pool.length) console.log(`  CA ${lo}-${hi}: ${hit}/${pool.length} (${(hit/pool.length*100).toFixed(0)}%)`);
}

console.log('\nsample unmatched (first 25):');
for (const u of unmatched) console.log('  -', u);

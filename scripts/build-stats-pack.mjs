// Build public/fifa-stats.json from FIFA CSVs (players_15..22) joined against
// temp/world.pack.json by (dob, normalized name-token). Scoped to top divisions
// of 8 countries. Latest FIFA year wins per (source_id).
//
// Output schema (compact to keep payload small):
//   { version, generated_at, stats: { [source_id]: FifaEntry } }
// where FifaEntry = { fy, ov, macro: {pa,sh,ps,dr,de,ph,gk?}, micro: {...} }
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACK_PATH = resolve('temp/world.pack.json');
const FIFA_DIR = resolve(process.env.HOME, 'lab/pcfurbo/data');
const OUT_PATH = resolve('public/fifa-stats.json');
const YEARS = [15, 16, 17, 18, 19, 20, 21, 22];

const TOP_LEAGUES = new Set([
  'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
  'Premier Division', 'Liga MX', 'Série A',
]);
const TARGET_COUNTRIES = new Set(['Argentina','Brazil','England','France','Germany','Italy','Mexico','Spain']);

const normTokens = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z\s'-]/g, ' ').trim().split(/\s+/).filter(Boolean);
const lastOf = (t) => t[t.length - 1] ?? '';

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

const N = (s) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : 0; };

function buildFifaIndex() {
  // (dob|token) → { year, row, header }  — latest year wins
  const idx = new Map();
  for (const yr of YEARS) {
    const rows = parseCsv(readFileSync(`${FIFA_DIR}/players_${yr}.csv`, 'utf8'));
    const h = rows[0];
    const cLong = h.indexOf('long_name'), cShort = h.indexOf('short_name'), cDob = h.indexOf('dob');
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < h.length - 3) continue;
      const dob = row[cDob]; if (!dob) continue;
      const keys = new Set();
      for (const src of [row[cLong] || '', row[cShort] || '']) {
        const toks = normTokens(src);
        if (!toks.length) continue;
        keys.add(`${dob}|${lastOf(toks)}`);
        if (toks.length === 1) keys.add(`${dob}|${toks[0]}`);
      }
      for (const k of keys) idx.set(k, { year: yr, row, header: h });
    }
  }
  return idx;
}

function extractEntry(year, row, h) {
  const v = (name) => N(row[h.indexOf(name)]);
  const positions = (row[h.indexOf('player_positions')] || '').split(',').map(s => s.trim());
  const isGK = positions[0] === 'GK';
  // GK rows have low macro pace/shooting; their real stats live in goalkeeping_*.
  const macro = isGK ? {
    pa: v('goalkeeping_speed') || v('goalkeeping_reflexes'),
    sh: 20,
    ps: v('goalkeeping_kicking'),
    dr: v('goalkeeping_handling'),
    de: v('goalkeeping_positioning'),
    ph: v('goalkeeping_diving'),
    gk: Math.round((v('goalkeeping_diving') + v('goalkeeping_handling') + v('goalkeeping_reflexes') + v('goalkeeping_positioning')) / 4),
  } : {
    pa: v('pace'), sh: v('shooting'), ps: v('passing'),
    dr: v('dribbling'), de: v('defending'), ph: v('physic'),
  };
  const micro = {
    // technical
    crossing: v('attacking_crossing'),
    finishing: v('attacking_finishing'),
    heading: v('attacking_heading_accuracy'),
    shortPassing: v('attacking_short_passing'),
    volleys: v('attacking_volleys'),
    dribblingSkill: v('skill_dribbling'),
    curve: v('skill_curve'),
    fkAccuracy: v('skill_fk_accuracy'),
    longPassing: v('skill_long_passing'),
    ballControl: v('skill_ball_control'),
    longShots: v('power_long_shots'),
    marking: v('defending_marking_awareness') || v('defending_marking'),
    standingTackle: v('defending_standing_tackle'),
    slidingTackle: v('defending_sliding_tackle'),
    penalties: v('mentality_penalties'),
    // mental
    aggression: v('mentality_aggression'),
    interceptions: v('mentality_interceptions'),
    positioning: v('mentality_positioning'),
    vision: v('mentality_vision'),
    composure: v('mentality_composure'),
    reactions: v('movement_reactions'),
    intRep: v('international_reputation'),
    // physical
    acceleration: v('movement_acceleration'),
    sprintSpeed: v('movement_sprint_speed'),
    agility: v('movement_agility'),
    balance: v('movement_balance'),
    shotPower: v('power_shot_power'),
    jumping: v('power_jumping'),
    stamina: v('power_stamina'),
    strength: v('power_strength'),
  };
  return {
    fy: year,
    ov: v('overall'),
    macro,
    micro,
    gk: isGK ? 1 : 0,
  };
}

const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
const countryIds = new Set(pack.countries.filter(c => TARGET_COUNTRIES.has(c.name)).map(c => c.id));
const leagueIds = new Set(pack.leagues.filter(l => countryIds.has(l.country_id) && TOP_LEAGUES.has(l.name)).map(l => l.id));
const clubIds = new Set(pack.clubs.filter(c => leagueIds.has(c.league_id)).map(c => c.id));
const scoped = pack.players.filter(p => clubIds.has(p.club_id));
console.log(`scope: ${scoped.length} players across ${clubIds.size} clubs`);

console.time('fifa index');
const fifaIdx = buildFifaIndex();
console.timeEnd('fifa index');

const out = {};
let matched = 0;
for (const p of scoped) {
  const dob = p.birth_date;
  const fn = normTokens(p.first_name || '');
  const ln = normTokens(p.last_name || '');
  const cands = new Set();
  if (ln.length) cands.add(lastOf(ln));
  if (fn.length && !ln.length) cands.add(lastOf(fn));
  if (fn.length === 1 && ln.length === 1) { cands.add(ln[0]); cands.add(fn[0]); }
  let hit = null;
  for (const t of cands) { const h = fifaIdx.get(`${dob}|${t}`); if (h) { hit = h; break; } }
  if (!hit) continue;
  out[p.source_id] = extractEntry(hit.year, hit.row, hit.header);
  matched++;
}

const payload = {
  version: 'fifa-15-22',
  generated_at: new Date().toISOString(),
  source: 'github.com/datasets/fifa-players (Kaggle FIFA 15-22)',
  scope: { leagues: [...TOP_LEAGUES], countries: [...TARGET_COUNTRIES] },
  count: matched,
  stats: out,
};
writeFileSync(OUT_PATH, JSON.stringify(payload));
const bytes = readFileSync(OUT_PATH).length;
console.log(`wrote ${OUT_PATH}: ${matched} entries, ${(bytes/1024).toFixed(0)} KB`);

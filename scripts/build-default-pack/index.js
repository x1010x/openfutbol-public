// Converts pcfurbo legacy DB into public/default.pack.json
// Usage: node scripts/build-default-pack/index.js --source /path/to/pcfurbo

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const source = get('--source');
  if (!source) {
    console.error('Usage: node scripts/build-default-pack/index.js --source <pcfurbo-root>');
    process.exit(1);
  }
  return { source: path.resolve(source) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Deterministic hash to derive potential from UUID
function deterministicExtra(uuid) {
  let h = 0;
  for (const c of uuid) h = ((h * 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 16;
}

// ─── Position mapping ─────────────────────────────────────────────────────────

const POS_MAP = {
  POR: [{ code: 'GK', level: 18 }],
  DEF: [{ code: 'DC', level: 17 }, { code: 'DL', level: 11 }, { code: 'DR', level: 11 }],
  MED: [{ code: 'MC', level: 17 }, { code: 'DMC', level: 12 }, { code: 'AMC', level: 10 }],
  AML: [{ code: 'AML', level: 17 }, { code: 'ML', level: 14 }, { code: 'AMC', level: 9 }],
  AMR: [{ code: 'AMR', level: 17 }, { code: 'MR', level: 14 }, { code: 'AMC', level: 9 }],
  DEL: [{ code: 'FC', level: 18 }, { code: 'AMC', level: 9 }],
};

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs();
  const dbDir = path.join(args.source, 'src', 'data', 'db');

  // Support worktree path if main src/data/db doesn't exist
  const worktreeDbDir = path.join(
    args.source,
    '.claude', 'worktrees', 'agent-aad48304b791b01e5', 'src', 'data', 'db'
  );
  const actualDbDir = fs.existsSync(dbDir) ? dbDir : (fs.existsSync(worktreeDbDir) ? worktreeDbDir : null);

  if (!actualDbDir) {
    console.error(`Error: DB directory not found at ${dbDir}`);
    console.error(`Also tried: ${worktreeDbDir}`);
    process.exit(1);
  }

  const teamsDir = path.join(actualDbDir, 'teams');
  const playersFile = path.join(actualDbDir, 'players.json');
  const freeAgentsFile = path.join(actualDbDir, 'free_agents.json');

  if (!fs.existsSync(teamsDir)) { console.error(`Missing: ${teamsDir}`); process.exit(1); }
  if (!fs.existsSync(playersFile)) { console.error(`Missing: ${playersFile}`); process.exit(1); }
  if (!fs.existsSync(freeAgentsFile)) { console.error(`Missing: ${freeAgentsFile}`); process.exit(1); }

  const allPlayersRaw = readJson(playersFile);
  const freeAgentIds = new Set(readJson(freeAgentsFile));

  // Index players by UUID
  const playerMap = new Map();
  for (const p of allPlayersRaw) playerMap.set(p.id, p);

  // Load all team files — each file is an array of season objects
  const teamFiles = fs.readdirSync(teamsDir).filter(f => f.endsWith('.json'));
  const allSeasons = [];
  for (const file of teamFiles) {
    const seasons = readJson(path.join(teamsDir, file));
    allSeasons.push(...(Array.isArray(seasons) ? seasons : [seasons]));
  }

  // Pick latest year per team id (numeric id from original data)
  const latestByTeamId = new Map();
  for (const s of allSeasons) {
    const existing = latestByTeamId.get(s.id);
    if (!existing || s.year > existing.year) {
      latestByTeamId.set(s.id, s);
    }
  }
  const teams = Array.from(latestByTeamId.values());

  // All teams are Spanish (pcfurbo only has Spanish teams)
  const COUNTRY_CODE = 'esp';
  const COUNTRY_NAME = 'España';

  // ── Continent ───────────────────────────────────────────────────────────────
  const continentId = crypto.randomUUID();
  const continents = [{ id: continentId, source_id: 1, name: 'World' }];

  // ── Country ─────────────────────────────────────────────────────────────────
  const countryId = crypto.randomUUID();
  const countries = [{
    id: countryId,
    source_id: 1,
    code: COUNTRY_CODE,
    slug: COUNTRY_CODE,
    name: COUNTRY_NAME,
    continent_id: continentId,
    reputation: 80,
  }];

  // ── League ──────────────────────────────────────────────────────────────────
  const leagueId = crypto.randomUUID();
  const leagues = [{
    id: leagueId,
    source_id: 1,
    country_id: countryId,
    slug: 'esp-liga',
    name: 'España Liga',
    reputation: 90,
    tier: 1,
    promotion_spots: 0,
    relegation_spots: 0,
  }];

  // ── Clubs — sorted by team UUID for stability ───────────────────────────────
  // Teams use numeric IDs in legacy DB. Convert to stable string for sorting.
  const sortedTeams = [...teams].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const clubs = [];
  const clubIdByTeamId = new Map(); // legacy team numeric id → pack Club UUID

  for (let i = 0; i < sortedTeams.length; i++) {
    const t = sortedTeams[i];
    const clubUuid = crypto.randomUUID();
    clubIdByTeamId.set(t.id, clubUuid);

    let colors = null;
    if (Array.isArray(t.colors) && t.colors.length >= 2) {
      colors = { background: t.colors[0], foreground: t.colors[1] };
    }

    clubs.push({
      id: clubUuid,
      source_id: i + 1,
      league_id: leagueId,
      name: t.name,
      colors,
      rivals_source_ids: [],
    });
  }

  // ── Players ─────────────────────────────────────────────────────────────────
  // Collect rostered player IDs and their club mapping
  const rosteredPlayerClub = new Map(); // player UUID → club UUID
  for (const t of sortedTeams) {
    const clubUuid = clubIdByTeamId.get(t.id);
    for (const entry of (t.players || [])) {
      if (entry.player_id) rosteredPlayerClub.set(entry.player_id, clubUuid);
    }
  }

  // Eligible: rostered OR free agent
  const eligiblePlayerIds = new Set([
    ...rosteredPlayerClub.keys(),
    ...freeAgentIds,
  ]);

  // Sort by UUID for stable source_id assignment
  const eligibleSorted = [...eligiblePlayerIds].sort();

  const players = [];
  const contractExpiration = `${new Date().getFullYear() + 3}-06-30`;

  for (let i = 0; i < eligibleSorted.length; i++) {
    const uuid = eligibleSorted[i];
    const dbPlayer = playerMap.get(uuid);
    if (!dbPlayer) continue; // not in DB — skip

    const pos = dbPlayer.preferred_pos;
    const posStats = dbPlayer.positions?.[pos];

    let ca = 100;
    if (posStats) {
      const { speed, dribbling, passing, shooting, defending, physical } = posStats;
      const avg = (speed + dribbling + passing + shooting + defending + physical) / 6;
      ca = Math.round(avg * 2);
    }
    ca = Math.max(1, Math.min(200, ca));

    const extra = deterministicExtra(uuid);
    const pa = Math.min(200, ca + extra);

    const fullName = dbPlayer.full_name || dbPlayer.shirt_name || '';
    const shirtName = dbPlayer.shirt_name || fullName;
    const lastSpace = fullName.lastIndexOf(' ');
    const firstName = lastSpace > 0 ? fullName.slice(0, lastSpace) : shirtName;
    const lastName = shirtName;

    const clubUuid = rosteredPlayerClub.get(uuid) ?? null;

    players.push({
      id: crypto.randomUUID(),
      source_id: i + 1,
      club_id: clubUuid,
      country_id: countryId,
      first_name: firstName,
      last_name: lastName,
      birth_date: `${dbPlayer.birth_year}-01-01`,
      positions: POS_MAP[pos] || [{ code: 'MC', level: 10 }],
      current_ability: ca,
      potential_ability: pa,
      value: Math.round(Math.pow(ca, 3) * 5),
      contract: { salary: ca * 1000, expiration: contractExpiration },
    });
  }

  // ── Build pack ───────────────────────────────────────────────────────────────
  const pack = {
    meta: {
      name: 'OpenFutbol Default Pack',
      version: '1.0.0',
      source_url: 'https://github.com/x1010x/pcfurbo',
      source_commit: null,
      imported_at: new Date().toISOString(),
      schema_version: 1,
    },
    continents,
    countries,
    leagues,
    clubs,
    players,
  };

  const outPath = path.resolve('public/default.pack.json');
  const output = JSON.stringify(pack, null, 2);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, 'utf-8');

  const sizeKb = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1);
  const sizeMb = (Buffer.byteLength(output, 'utf-8') / 1024 / 1024).toFixed(2);

  console.log(`continents: ${continents.length}`);
  console.log(`countries:  ${countries.length}`);
  console.log(`leagues:    ${leagues.length}`);
  console.log(`clubs:      ${clubs.length}`);
  console.log(`players:    ${players.length}`);
  console.log(`-> wrote ${outPath} (${sizeKb} KB / ${sizeMb} MB)`);
}

main();

// Builds public/default.pack.json from this repo's main branch DB.
// Usage: node scripts/build-default-pack/index.js

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

function gitShow(ref) {
  return JSON.parse(execSync(`git show ${ref}`, { encoding: 'utf-8' }));
}

function deterministicExtra(uuid) {
  let h = 0;
  for (const c of uuid) h = ((h * 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 31; // 0–30 PA bonus over CA
}

const POS_MAP = {
  POR: [{ code: 'GK',  level: 20 }],
  DEF: [{ code: 'DC',  level: 20 }],
  MED: [{ code: 'MC',  level: 20 }],
  AML: [{ code: 'AML', level: 20 }],
  AMR: [{ code: 'AMR', level: 20 }],
  DEL: [{ code: 'FC',  level: 20 }],
};

const COUNTRY_NAMES = {
  AR: 'Argentina', BE: 'Belgium', BR: 'Brazil', CZ: 'Czech Republic',
  DE: 'Germany', ES: 'Spain', FR: 'France', GB: 'England',
  IL: 'Israel', IT: 'Italy', NL: 'Netherlands', PL: 'Poland',
  PT: 'Portugal', RU: 'Russia', SE: 'Sweden',
};

function main() {
  const DB = 'main:src/data/db';

  const teamsRaw  = gitShow(`${DB}/teams/teams_test.json`);
  const playersRaw = gitShow(`${DB}/players/players_2024.json`);
  const freeAgentIds = new Set(gitShow(`${DB}/free_agents.json`));
  const playerNames  = gitShow(`${DB}/names/player_names.json`);
  const teamNames    = gitShow(`${DB}/names/team_names.json`);
  const stadiumNames = gitShow(`${DB}/names/stadium_names.json`);

  // Index players by UUID
  const playerMap = new Map(playersRaw.map(p => [p.id, p]));

  // ── Continent ────────────────────────────────────────────────────────────────
  const continentId = '00000000-0000-0000-0000-000000000001';
  const continents = [{ id: continentId, source_id: 1, name: 'World' }];

  // ── Countries — one per unique country code ──────────────────────────────────
  const countryCodes = [...new Set(teamsRaw.map(t => t.country))].sort();
  const countryByCode = new Map();
  const countries = countryCodes.map((code, i) => {
    const id = `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`;
    const entry = {
      id,
      source_id: i + 1,
      code: code.toLowerCase(),
      slug: code.toLowerCase(),
      name: COUNTRY_NAMES[code] ?? code,
      continent_id: continentId,
      reputation: 80,
    };
    countryByCode.set(code, entry);
    return entry;
  });

  // ── Leagues — one per country ────────────────────────────────────────────────
  const leagueByCode = new Map();
  const leagues = countries.map((country, i) => {
    const id = `00000000-0000-0000-0002-${String(i + 1).padStart(12, '0')}`;
    const entry = {
      id,
      source_id: i + 1,
      country_id: country.id,
      slug: `${country.code}-liga`,
      name: `${country.name} Liga`,
      reputation: 85,
      tier: 1,
      promotion_spots: 0,
      relegation_spots: 0,
    };
    leagueByCode.set(country.code.toUpperCase(), entry);
    return entry;
  });

  // ── Clubs — preserve original UUID, sorted for stable source_id ──────────────
  const sortedTeams = [...teamsRaw].sort((a, b) => a.id.localeCompare(b.id));
  const clubs = sortedTeams.map((t, i) => {
    const season = t.seasons?.[t.seasons.length - 1] ?? {};
    const colors = Array.isArray(season.colors) && season.colors.length >= 2
      ? { background: season.colors[0], foreground: season.colors[1] }
      : null;
    const country = countryByCode.get(t.country);
    const league  = leagueByCode.get(t.country);
    return {
      id: t.id, // preserve UUID — logos are named by this
      source_id: i + 1,
      league_id: league?.id ?? leagues[0].id,
      country_id: country?.id ?? countries[0].id,
      name: teamNames[t.id] ?? t.id,
      stadium_name: stadiumNames[t.id] ?? null,
      stadium_capacity: season.stadiumCapacity ?? null,
      colors,
      rivals_source_ids: [],
    };
  });

  // ── Collect roster assignments ───────────────────────────────────────────────
  const playerClub = new Map(); // player UUID → club UUID
  for (const t of teamsRaw) {
    const season = t.seasons?.[t.seasons.length - 1] ?? {};
    for (const entry of (season.players ?? [])) {
      if (entry.player_id) playerClub.set(entry.player_id, t.id);
    }
  }

  // ── Players — preserve UUID + name, random CA/PA ─────────────────────────────
  const eligibleIds = new Set([...playerClub.keys(), ...freeAgentIds]);
  const sortedIds = [...eligibleIds].sort();
  const contractExpiry = `${new Date().getFullYear() + 3}-06-30`;

  const players = [];
  for (let i = 0; i < sortedIds.length; i++) {
    const uuid = sortedIds[i];
    const db = playerMap.get(uuid);
    if (!db) continue;

    const nameEntry = playerNames[uuid];
    const fullName  = nameEntry?.f ?? uuid;
    const shirtName = nameEntry?.s ?? fullName;
    const lastSpace = fullName.lastIndexOf(' ');
    const firstName = lastSpace > 0 ? fullName.slice(0, lastSpace) : fullName;

    const pos = db.preferred_pos ?? 'MED';
    const posStats = db.positions?.[pos];
    let ca = 100;
    if (posStats) {
      const { speed, dribbling, passing, shooting, defending, physical } = posStats;
      ca = Math.round((speed + dribbling + passing + shooting + defending + physical) / 6 * 2);
      ca = Math.max(1, Math.min(200, ca));
    }
    const pa = Math.min(200, ca + deterministicExtra(uuid));

    const clubId = playerClub.get(uuid) ?? null;
    const club = clubs.find(c => c.id === clubId);
    const countryId = club?.country_id ?? countries[0].id;

    players.push({
      id: uuid, // preserve UUID — photos are named by this
      source_id: i + 1,
      club_id: clubId,
      country_id: countryId,
      first_name: firstName,
      last_name: shirtName,
      birth_date: `${db.birth_year}-01-01`,
      positions: POS_MAP[pos] ?? [{ code: 'MC', level: 10 }],
      current_ability: ca,
      potential_ability: pa,
      value: Math.round(Math.pow(ca, 3) * 5),
      contract: { salary: ca * 1000, expiration: contractExpiry },
    });
  }

  // ── Write ─────────────────────────────────────────────────────────────────────
  const pack = {
    meta: {
      name: 'OpenFutbol Default Pack',
      version: '1.0.0',
      source_url: 'https://github.com/x1010x/openfutbol-public',
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

  const outPath = resolve('public/default.pack.json');
  const output = JSON.stringify(pack, null, 2);
  mkdirSync('public', { recursive: true });
  writeFileSync(outPath, output, 'utf-8');

  const kb = (Buffer.byteLength(output) / 1024).toFixed(1);
  console.log(`continents: ${continents.length}`);
  console.log(`countries:  ${countries.length}`);
  console.log(`leagues:    ${leagues.length}`);
  console.log(`clubs:      ${clubs.length}`);
  console.log(`players:    ${players.length}`);
  console.log(`-> ${outPath} (${kb} KB)`);
}

main();

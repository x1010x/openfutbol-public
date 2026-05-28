import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import type {
  Pack, PackMeta,
  Continent, Country, League, Club, Player, PlayerPosition,
  PositionCode,
} from './types.js';

// ─── Arg parsing ────────────────────────────────────────────────────────────

function parseArgs(): { source: string; out: string; name: string; version: string } {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const source = get('--source');
  const out = get('--out');
  if (!source || !out) {
    console.error('Usage: import-pack --source <path> --out <path.pack.json> [--name <name>] [--version <version>]');
    process.exit(1);
  }
  return {
    source: path.resolve(source),
    out: path.resolve(out),
    name: get('--name') ?? path.basename(source),
    version: get('--version') ?? '1.0.0',
  };
}

// ─── Source JSON types ────────────────────────────────────────────────────────

interface SourceContinent { id: number; name: string; }
interface SourceCountry {
  id: number; code: string; slug: string; name: string;
  continent_id: number; reputation: number;
  [key: string]: unknown;
}
interface SourceLeague {
  id: number; slug: string; name: string;
  reputation: number; tier: number;
  promotion_spots: number; relegation_spots: number;
  [key: string]: unknown;
}
interface SourceTeam { id: number; name: string; team_type: string; [key: string]: unknown; }
interface SourceClub {
  id: number; name: string;
  teams: SourceTeam[];
  colors?: { background: string; foreground: string };
  rivals?: number[];
  [key: string]: unknown;
}
interface SourceContract { salary: number; expiration: string; [key: string]: unknown; }
interface SourcePlayer {
  id: number;
  first_name: string; last_name: string;
  birth_date: string;
  country_id: number;
  club_id?: number | null;
  positions?: Array<{ code: string; level: number }>;
  current_ability?: number;
  potential_ability?: number;
  value?: number;
  contract?: SourceContract | null;
  history?: unknown;
  [key: string]: unknown;
}

// ─── Position code normalization ─────────────────────────────────────────────

// Maps source codes that don't match our 14 FM codes to the closest equivalent.
const POSITION_ALIASES: Record<string, PositionCode> = {
  ST: 'FC',   // striker → centre forward
  DM: 'DMC',  // defensive mid → defensive mid centre
  // WBR and WBL are now first-class codes — no aliasing needed.
};

const VALID_POSITION_CODES = new Set<string>([
  'GK', 'DC', 'DL', 'DR', 'WBL', 'WBR',
  'DMC', 'MC', 'ML', 'MR',
  'AMC', 'AML', 'AMR', 'FC',
]);

function normalizePositionCode(code: string): PositionCode | null {
  if (VALID_POSITION_CODES.has(code)) return code as PositionCode;
  const alias = POSITION_ALIASES[code];
  return alias ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function getSourceCommit(sourceDir: string): string | null {
  try {
    return execSync(`git -C ${JSON.stringify(sourceDir)} rev-parse HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();
  const dataDir = path.join(args.source, 'data');

  if (!fs.existsSync(dataDir)) {
    console.error(`Error: data/ directory not found at ${dataDir}`);
    process.exit(1);
  }

  let warnings = 0;

  // ── Continents ──────────────────────────────────────────────────────────
  const continentIdMap = new Map<number, string>(); // source_id → UUID
  const continentsSrc = readJson<SourceContinent[]>(path.join(dataDir, 'continents.json'));
  const continents: Continent[] = continentsSrc.map((c) => {
    const id = uuid();
    continentIdMap.set(c.id, id);
    return { id, source_id: c.id, name: c.name };
  });

  // ── Countries ────────────────────────────────────────────────────────────
  const countryIdMap = new Map<number, string>(); // source_id → UUID
  const countryCodeMap = new Map<string, string>(); // code (e.g. 'es') → UUID
  const countriesSrc = readJson<SourceCountry[]>(path.join(dataDir, 'countries.json'));
  const countries: Country[] = [];
  for (const c of countriesSrc) {
    const continentUuid = continentIdMap.get(c.continent_id);
    if (!continentUuid) {
      console.warn(`[warn] Country ${c.id} (${c.name}): unknown continent_id ${c.continent_id} — skipping`);
      warnings++;
      continue;
    }
    const id = uuid();
    countryIdMap.set(c.id, id);
    countryCodeMap.set(c.code, id);
    const { id: _id, code, slug, name, continent_id: _cid, reputation, ...rest } = c;
    countries.push({
      id, source_id: _id,
      code, slug, name,
      continent_id: continentUuid,
      reputation,
      raw: rest,
    });
  }

  // ── Leagues & Clubs & Players — walk the directory tree ─────────────────
  const leagueIdMap = new Map<number, string>();
  const clubIdMap = new Map<number, string>();

  const leagues: League[] = [];
  const clubs: Club[] = [];
  const players: Player[] = [];

  const countryDirs = fs.readdirSync(dataDir).filter((entry) => {
    const fullPath = path.join(dataDir, entry);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const countryCode of countryDirs) {
    const countryDir = path.join(dataDir, countryCode);
    const countryUuid = countryCodeMap.get(countryCode);

    if (!countryUuid) {
      // country code in filesystem not matched to any country record
      // e.g. some dirs may not match a code exactly
      console.warn(`[warn] Directory ${countryCode}: no country record with code "${countryCode}" — skipping`);
      warnings++;
      continue;
    }

    const countryEntries = fs.readdirSync(countryDir);

    for (const entry of countryEntries) {
      // Skip names.json and files
      if (!fs.statSync(path.join(countryDir, entry)).isDirectory()) continue;

      if (entry === 'free_agents') {
        // Free agents: players with club_id = null
        const faDir = path.join(countryDir, 'free_agents');
        for (const playerFile of fs.readdirSync(faDir)) {
          if (!playerFile.endsWith('.json')) continue;
          const playerPath = path.join(faDir, playerFile);
          const player = importPlayer(readJson<SourcePlayer>(playerPath), null, countryIdMap, warnings);
          if (player.skipped) { warnings++; continue; }
          players.push(player.player);
        }
        continue;
      }

      // League directory
      const leagueDir = path.join(countryDir, entry);
      const leagueJsonPath = path.join(leagueDir, 'league.json');
      if (!fs.existsSync(leagueJsonPath)) continue;

      const leagueSrc = readJson<SourceLeague>(leagueJsonPath);
      const leagueUuid = uuid();
      leagueIdMap.set(leagueSrc.id, leagueUuid);

      const { id: lid, slug, name: lname, reputation: lrep, tier, promotion_spots, relegation_spots, ...leagueRest } = leagueSrc;
      leagues.push({
        id: leagueUuid,
        source_id: lid,
        country_id: countryUuid,
        slug, name: lname,
        reputation: lrep,
        tier,
        promotion_spots,
        relegation_spots,
        raw: leagueRest,
      });

      // Club directories inside league
      const leagueEntries = fs.readdirSync(leagueDir);
      for (const clubEntry of leagueEntries) {
        if (!fs.statSync(path.join(leagueDir, clubEntry)).isDirectory()) continue;

        const clubDir = path.join(leagueDir, clubEntry);
        const clubJsonPath = path.join(clubDir, 'club.json');
        if (!fs.existsSync(clubJsonPath)) continue;

        const clubSrc = readJson<SourceClub>(clubJsonPath);

        // Only import main team
        const mainTeam = clubSrc.teams?.find((t) => t.team_type === 'Main');
        if (!mainTeam) {
          console.warn(`[warn] Club ${clubSrc.id} (${clubDir}): no Main team — skipping`);
          warnings++;
          continue;
        }

        const clubUuid = uuid();
        // Map all team IDs for this club to the same club UUID
        // (players reference club_id which may be the main team id = club id)
        clubIdMap.set(clubSrc.id, clubUuid);
        // Also map the main team's id in case it differs
        if (mainTeam.id !== clubSrc.id) {
          clubIdMap.set(mainTeam.id, clubUuid);
        }

        const colors = clubSrc.colors
          ? { background: clubSrc.colors.background, foreground: clubSrc.colors.foreground }
          : null;

        const rivals_source_ids: number[] = Array.isArray(clubSrc.rivals) ? clubSrc.rivals : [];

        const { id: cid, name: _cname, teams: _teams, colors: _colors, rivals: _rivals, ...clubRest } = clubSrc;
        clubs.push({
          id: clubUuid,
          source_id: cid,
          league_id: leagueUuid,
          name: mainTeam.name,
          colors,
          rivals_source_ids,
          raw: clubRest,
        });

        // Players
        const playersDir = path.join(clubDir, 'players');
        if (!fs.existsSync(playersDir)) continue;

        for (const playerFile of fs.readdirSync(playersDir)) {
          if (!playerFile.endsWith('.json')) continue;
          const playerPath = path.join(playersDir, playerFile);
          const result = importPlayer(readJson<SourcePlayer>(playerPath), clubUuid, countryIdMap, warnings);
          if (result.skipped) { warnings++; continue; }
          players.push(result.player);
        }
      }
    }
  }

  // ── Build pack ────────────────────────────────────────────────────────────
  const meta: PackMeta = {
    name: args.name,
    version: args.version,
    source_url: 'https://github.com/ZOXEXIVO/open-football-database',
    source_commit: getSourceCommit(args.source),
    imported_at: new Date().toISOString(),
    schema_version: 1,
  };

  const pack: Pack = { meta, continents, countries, leagues, clubs, players };

  const output = JSON.stringify(pack, null, 2);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, output, 'utf-8');

  const sizeMb = (Buffer.byteLength(output, 'utf-8') / 1024 / 1024).toFixed(1);

  console.log(`continents: ${continents.length}`);
  console.log(`countries:  ${countries.length}`);
  console.log(`leagues:    ${leagues.length}`);
  console.log(`clubs:      ${clubs.length}`);
  console.log(`players:    ${players.length}`);
  if (warnings > 0) {
    console.log(`warnings:   ${warnings}`);
  }
  console.log(`-> wrote ${args.out} (${sizeMb} MB)`);
}

// ─── Player import helper ─────────────────────────────────────────────────────

function importPlayer(
  src: SourcePlayer,
  clubUuid: string | null,
  countryIdMap: Map<number, string>,
  _warnings: number,
): { skipped: true } | { skipped: false; player: Player } {
  if (!src.positions || src.positions.length === 0) {
    console.warn(`[warn] Player ${src.id} (${src.last_name}): no positions — skipping`);
    return { skipped: true };
  }
  if (src.current_ability == null) {
    console.warn(`[warn] Player ${src.id} (${src.last_name}): no current_ability — skipping`);
    return { skipped: true };
  }

  const countryUuid = countryIdMap.get(src.country_id);
  if (!countryUuid) {
    console.warn(`[warn] Player ${src.id} (${src.last_name}): unknown country_id ${src.country_id} — skipping`);
    return { skipped: true };
  }

  const positions: PlayerPosition[] = [];
  for (const pos of src.positions) {
    const normalized = normalizePositionCode(pos.code);
    if (normalized) {
      positions.push({ code: normalized, level: pos.level });
    } else {
      console.warn(`[warn] Player ${src.id}: unknown position code "${pos.code}" — omitting position`);
    }
  }

  if (positions.length === 0) {
    console.warn(`[warn] Player ${src.id} (${src.last_name}): no valid positions after filtering — skipping`);
    return { skipped: true };
  }

  const contract = src.contract
    ? { salary: src.contract.salary ?? 0, expiration: src.contract.expiration }
    : null;

  const {
    id,
    first_name, last_name, birth_date,
    country_id: _cid, club_id: _club,
    positions: _pos,
    current_ability, potential_ability,
    value,
    contract: _contract,
    history,
    ...rest
  } = src;

  return {
    skipped: false,
    player: {
      id: crypto.randomUUID(),
      source_id: id,
      club_id: clubUuid,
      country_id: countryUuid,
      first_name: first_name ?? '',
      last_name: last_name ?? '',
      birth_date: birth_date ?? '',
      positions,
      current_ability: current_ability ?? 0,
      potential_ability: potential_ability ?? current_ability ?? 0,
      value: value ?? 0,
      contract,
      history: history ?? null,
      raw: rest,
    },
  };
}

main();

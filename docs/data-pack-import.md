# Data pack import — work plan

**Branch (suggested):** `feature/data-pack-import` (new, off `main`)
**Source analysis:** `temp/analysis.md`, `temp/analysis.json`
**Reference format:** [ZOXEXIVO/open-football-database](https://github.com/ZOXEXIVO/open-football-database)
**Independent of:** UI redesign work. Do not branch off, merge into, or coordinate with `feature/ui-redesign`. Schema changes are UI-agnostic; existing components adapt later.

This is a two-part initiative:

1. **Schema refactor** — drop our 7 hardcoded stats; adopt CA/PA + position-competence (FM-style) as the canonical player model. Restructure the data layer around a normalized hierarchy (continent → country → league → club → player).
2. **Data pack importer** — let users bring their own data in ZOXEXIVO-compatible format. Ship the game with **no player/team data of our own**, which sidesteps copyright entirely. We publish an empty "template" dataset repo; the community builds packs.

---

## Why this approach

- **Copyright:** today we ship mangled real names. Owners of the data are responsible if they choose to bring a pack of real players. We ship nothing.
- **Format:** ZOXEXIVO is the closest thing to a de-facto open standard for fan football data. Adopting it = free interoperability with any dataset following that shape.
- **Stat model:** CA/PA + position competence is more general than 7 fixed attributes, scales better to real-world depth, and is what we'd evolve toward anyway.
- **One refactor, not two:** since we're touching the engine anyway, do schema + engine in one pass rather than incremental migration.

---

## Decisions (locked 2026-05-27)

| # | Decision | Notes |
|---|---|---|
| 1 | Adopt CA/PA + position-level model | Drop the 7-stat `PlayerStats` interface entirely. No derived/heuristic fallback. |
| 2 | Adopt ZOXEXIVO normalized hierarchy | Continents, countries, leagues, clubs, players as separate entity sets. 1:1 with source — no flatten layer. |
| 3 | Ship **no** built-in data | `src/data/db/players/`, `src/data/db/teams/` removed. Empty state until user imports a pack. |
| 4 | Position codes: expand to FM resolution | GK / DC / DL / DR / DMC / MC / ML / MR / AMC / AML / AMR / FC. Replaces our 6 Spanish codes. UI labels stay localized. |
| 5 | IDs: generate UUIDs at import | Source numeric IDs preserved as `source_id` on each entity for traceability / re-import diff. |
| 6 | Pack format: single JSON file | One `*.pack.json` per dataset. Entity arrays at top level. See "Pack format" below. |
| 7 | Two-step import flow | (a) Standalone Node script clones a repo and produces a `pack.json`; (b) in-app file picker loads the pack. Browser-side git clone is out of scope for v1. |
| 8 | Save migration: none | Old saves are invalidated. First load on the new version wipes localStorage and forces a fresh "New Game" once a pack is loaded. |
| 9 | Scope: all of it | Whole world, all leagues, all clubs. Same import effort regardless of breadth. |
| 10 | Engine: refactor in same branch | CA-based strength calc replaces stat-averaging. Position-level penalty replaces our `slotPenalty`. |

---

## New schema (target)

```ts
// All IDs are UUIDs. source_id is the numeric ID from the imported pack.
interface Continent { id: string; source_id: number; name: string; }
interface Country   { id: string; source_id: number; code: string; name: string; continent_id: string; reputation: number; }
interface League    { id: string; source_id: number; country_id: string; name: string; slug: string; tier: number; reputation: number; promotion_spots: number; relegation_spots: number; }
interface Club      { id: string; source_id: number; league_id: string; name: string; colors: { background: string; foreground: string }; rivals: string[]; finance: { balance: number }; }
interface PlayerPosition { code: PositionCode; level: number; } // FM codes; level 1-20
type PositionCode = 'GK'|'DC'|'DL'|'DR'|'DMC'|'MC'|'ML'|'MR'|'AMC'|'AML'|'AMR'|'FC';
interface Player {
  id: string; source_id: number;
  club_id: string | null;        // null = free agent
  country_id: string;
  first_name: string; last_name: string;
  birth_date: string;            // ISO YYYY-MM-DD
  positions: PlayerPosition[];
  current_ability: number;       // 1-200 (FM scale)
  potential_ability: number;     // 1-200
  value: number;                 // currency units
  contract: { salary: number; expiration: string } | null;
  history: { season: number; club_id: string; appearances: number; goals: number }[];
  // runtime/game state, not from pack:
  stamina: number; injuryWeeksRemaining: number; seasonStats: { /* unchanged */ };
}
```

The `seasonStats` block and runtime fields (`stamina`, `injury`) stay as they are — they are game state, not pack data.

---

## Engine impact

The engine currently averages 7 stats with position-specific weights. After refactor:

- **Player effective ability at slot S** = `CA × positionLevelFactor(player, S)`
  - `positionLevelFactor` maps the player's competence at S (1-20) to a 0-1 multiplier. Natural position (20) = 1.0; awkward (<10) decays sharply.
- **Team strength** = average effective ability across the 11 starting slots × stamina factor × discipline modifiers.
- **Goalkeeping**: GK-only players have `positions: [{code: 'GK', level: 20}]`. Field players never have GK level > 5.
- Remove `effectiveStat`, `slotPenalty`'s current logic, `PlayerStats` everywhere. Replace with the two helpers above.
- Update `florentinometro` (transfer values) to use CA/PA directly instead of stat-derived heuristics.

Concrete files to rewrite (in `openfutbol-public`):
- `src/types/game.d.ts` — schema
- `src/engine/simEngine.ts` — `calculateTeamStrength`
- `src/engine/formations.ts` — `effectiveStat`, `slotPenalty` rewritten
- `src/engine/florentinometro.ts` — value/transfer based on CA/PA
- `src/store/leagueStore.ts` — load/save shape; bump storage version, wipe on mismatch
- `src/data/packLoader.ts` — replace with pack-import code path
- `src/data/mockTeams.ts`, `src/data/db/*` — delete
- Player UI components — show CA/PA + position bars instead of speed/dribbling/etc.

---

## Pack format

A pack is a single JSON file. No zip, no chunks, no streaming for v1. If size becomes a problem later we revisit.

```jsonc
{
  "meta": {
    "name": "world-2026",
    "version": "1.0.0",
    "source_url": "https://github.com/ZOXEXIVO/open-football-database",
    "source_commit": "<sha at import time>",
    "imported_at": "2026-05-27T...",
    "schema_version": 1
  },
  "continents": [ /* Continent[] */ ],
  "countries":  [ /* Country[]  */ ],
  "leagues":    [ /* League[]   */ ],
  "clubs":      [ /* Club[]     */ ],
  "players":    [ /* Player[] without runtime fields */ ]
}
```

The in-app loader validates `schema_version`, then writes everything into the store under a new top-level `packs` namespace. Loaded pack identity (name + version) is stored so saves know which pack they belong to.

---

## Phases

### Phase 0 — License + license-isolation check
- Read ZOXEXIVO's LICENSE.
- Confirm: we ship NO data, NO names, NO IDs from their repo in our git history. Importer reads from a path the user provides; output is gitignored.
- Add `data-pack-license-notes.md` summarizing what we found.

### Phase 1 — Standalone Node importer
- New script: `scripts/import-pack/` in openfutbol-public.
- CLI: `npm run import-pack -- --source <path-to-cloned-repo> --out <out-file.pack.json>`.
- Behavior:
  - Walk `data/` of the source repo.
  - For each entity: assign a UUID, keep `source_id`.
  - Build a single `pack.json`.
  - Log a summary (counts per entity, warnings for missing refs).
- No app changes yet. Importer is testable in isolation.

### Phase 2 — Schema + engine refactor
- Done on the same branch but in its own commit series.
- Change `game.d.ts` to the new shape.
- Rewrite engine math (CA × position factor).
- Delete legacy stats, mock teams, current DB JSON.
- App will be **broken / empty** at this point — that's expected. No data = nothing to play.

### Phase 3 — In-app pack loader
- New screen: "Datos del juego" / "Game data".
  - Empty state: "No data loaded. Import a pack to begin."
  - File picker (`.pack.json`).
  - Validation, preview (counts, source repo, version), confirm → write to store.
  - Replace pack: confirm dialog wipes saves.
- New game flow guards: can't start a new game without a loaded pack.

### Phase 4 — Restore playability
- Reconnect the UI to the new schema.
- Player cards, squad screens, league tables — read from the new entity types.
- Acceptance: load a pack, start a season, play a match through to end. No crashes.

## Phase 4 status (2026-05-28)

### What works
- `npm run import-pack` produces a valid 39.5 MB `world.pack.json` from ZOXEXIVO source (54,568 players, 1,355 clubs, 92 leagues, 218 countries, 6 continents)
- `npm run build` passes with no TypeScript errors
- `npm run dev` shows `PackLoaderView` when no pack is loaded
- Loading `temp/world.pack.json` via file picker persists to IndexedDB and transitions to the main menu
- `LeagueSetupView` populates with all 1,355 clubs from the pack, grouped by country
- Selecting 4+ clubs and confirming builds `Team` objects from pack players using CA × positionLevelFactor engine
- `PlayerCard` shows CA, PA, and per-position competence bars
- Match engine runs (CA-based strength calculation)

### What still needs migration (Phase 4 remainder)
- `PlayerDetailView`, `StatRadar`, `TransfersView`: still read old 7-stat `PlayerStats` shape (values are uniform stubs — not wrong but not meaningful)
- `EndOfSeasonView`: uses `isPlayerActive` + `getRetireAge` stubs — retirement logic is disabled
- `EditorView` / `PlayerPickerPanel`: legacy pack import flow is disabled (returns null)
- Transfer value display: `formatEuros(computePrice(...))` uses `media` shim — works but not CA-calibrated
- ProManager mode: `getTeamTemplatesForYear` returns empty — ProManager setup broken
- Fantasy mode: same issue — disabled until pack-aware setup is implemented

### Phase 5 — Polish
- Pack management: show currently loaded pack in settings. "Unload" option.
- Multiple packs: out of scope for v1. Single active pack only.

### Phase 6 — Optional: in-app fetch from GitHub URL
- Browser fetches `https://github.com/<owner>/<repo>/archive/refs/heads/<branch>.tar.gz`.
- Decompress with `DecompressionStream`. Walk in-memory. Build pack. Skip the standalone script entirely.
- Rate-limited and slower, but UX is "paste a URL → done". Worth doing once Phase 1-5 are stable.

### Phase 7 — Publish the template repo
- New empty repo `openfutbol-data-template`. ZOXEXIVO-compatible structure, no real players, minimal example data so contributors can clone and fill it in.
- README explains the format, points back to ZOXEXIVO for reference, and links to our importer.

---

## Open questions

- **Stamina/injury seeds:** today these live on the Player object. After import, every player starts at full stamina, no injury. Fine, but confirm we don't want to import a "fitness" or "morale" field from source if one becomes available.
- **Currency:** source uses raw integers (e.g. value `46000000`). We need a display unit and inflation/era scaling, especially when pulling 2026 data into a 1995 season. **Defer to its own design pass** — not blocking import.
- **Position label localization:** UI shows "POR" today (Spanish). With 12 FM codes, do we localize ("POR / DC / DL / …") or keep FM codes universal? Mild preference for keeping FM codes verbatim — they're standard, scan well, and avoid 12 i18n strings.
- **History field:** ZOXEXIVO has per-season stats history. We'd ingest as-is into `Player.history`. We don't currently *use* it. Confirm we want to keep it on import even though it's unused at first.
- **AMC mapping in formations:** our 6-position UI had no AMC slot. Now we have it. Some formations (4-2-3-1) get more accurate. Do we add new formations to `FormationId`, or treat AMC like a deep DEL for now?

---

## Working agreement

- **Branch:** new branch `feature/data-pack-import` off `main`. Do NOT branch off `feature/ui-redesign`. Do NOT merge UI redesign work into this branch.
- **Independence:** this work changes the data layer + engine math; it does not change UI structure. When the UI redesign lands, components adapt to the new schema then — no merge conflict by design as long as both sides treat the player object as opaque-ish.
- **One pack file format = one schema version.** Bump `schema_version` for any breaking pack shape change. Loader rejects unknown versions with a clear error.
- **No real data in git.** The importer's output is gitignored. The cloned source repo is gitignored (e.g. `temp/open-football-database/`).
- **Engine tests:** keep simulation tests green. If a test relies on `PlayerStats` shape, update the fixture; don't disable the test.
- **Done = a fresh user can:** clone the project, run `npm run import-pack`, load the resulting file in the app, start a season, and play a match end-to-end.

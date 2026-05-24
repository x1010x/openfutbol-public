# Architecture

Developer reference for OpenFútbol. Read this before touching the codebase.

---

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b, then vite build — type errors fail the build
npm run lint      # ESLint (flat config, typescript-eslint + react-hooks + react-refresh)
npm run preview   # serve the production build
```

No test runner is configured.

---

## Stack

React 19 · TypeScript · Tailwind CSS v4 (Vite plugin, no separate `tailwind.config`) · Vite 8

UI language: Spanish. Deploys to GitHub Pages on push to `main` via `.github/workflows/deploy.yml` (Node 22, output `dist/` → `gh-pages` branch).

---

## High-level structure

```
src/
  App.tsx              ← all game state + view routing (see below)
  types/game.d.ts      ← shared types and save-format interfaces
  store/leagueStore.ts ← pure functions that operate on LeagueState
  engine/              ← pure simulation modules (no React, no localStorage)
  data/                ← data loading, economy, pack parsing
  components/          ← flat directory of screen-level UI components
  contexts/            ← PlayerTooltipContext (UI only)
```

---

## State and persistence

- **All game state lives in `App.tsx`** via `useState<LeagueState>`. There is no Redux, Zustand, or game-state Context. `PlayerTooltipContext` is the only React Context and is UI-only.
- State is persisted to `localStorage` under the key `openfutbol_league`.
- On load, `App.tsx` runs a **schema migration check** (`needsReset`): if any expected field is missing or in its old shape, the save is discarded, `openfutbol_db_wiped` is set, and a flavor-text message is shown. **When you add a required field to `LeagueState`, add a corresponding check to the `needsReset` chain in `App.tsx`.** The `LeagueState` interface in `leagueStore.ts` is the save schema — see the comment there.
- `src/store/leagueStore.ts` is **not** a store — it is a collection of pure functions that take `LeagueState` and return a new `LeagueState`. `App.tsx` calls these and feeds the result back into `setLeague`.

---

## Game data pipeline (`src/data/`)

- Team and player data live as JSON under `src/data/db/teams/teams_*.json` and `src/data/db/players/players_*.json`. They are loaded **at build time** via Vite's `import.meta.glob(..., { eager: true })` in `src/data/mockTeams.ts`. To add a new year: drop in a JSON file matching that glob pattern.
- Names are separated from IDs: `src/data/db/names/{player,team,manager,stadium}_names.json` map IDs → display strings. The DB JSON contains no display names; `mockTeams.ts` joins them at load time.
- `src/data/packLoader.ts` parses user-imported packs (`player_pack`, `team_pack`, `combined_pack`) for the in-game editor and backup flows.
- `src/data/economy.ts` owns all money logic: prices, offers, salaries, attendance. Do not recompute prices ad-hoc — call `computePrice` / `evaluateOffer`.

**Important:** `TeamSeasonData.players` can be `RosterEntry[]` (new DB format) or `RawPlayer[]` (legacy packs). `mockTeams.ts` handles both. Don't assume one format.

---

## Simulation engine (`src/engine/`)

All engine modules are **pure** (no React, no localStorage). Keep them that way.

- **`simEngine.ts`** — minute-by-minute match simulation via `simulateMinute(state) → MatchState`. The main function is large; it is divided into clearly commented sections: AI subs, goal/shot resolution, foul/card resolution, stamina decay, injury handling, and stoppage time.

  **Stamina math gotcha:** `calculateTeamStrength` uses `rawMedia * slotPenalty * stamFactor` — **not** `effectiveMedia` — because `effectiveMedia` already applies its own stamina factor based on `player.stamina`. Using `effectiveMedia` here would double-apply the stamina penalty. Preserve this if touching strength math.

- **`formations.ts`** — formation slot maps, `effectiveStat`, `rawMedia`, `liveMed`, `slotPenalty`, `pickBestXI`, `pickBestFormation`, `reslotLineup`.

- **`calendar.ts`** — schedule generator and jornada date formatting.

- **`playerMood.ts`** — mood effects on player stats.

---

## UI (`src/components/`)

Flat directory of screen-level components. Navigation is driven by the `View` string union in `App.tsx` (`LEAGUE | SQUAD | ALIGNMENT | …`). There is no router. A `useEffect` in `App.tsx` mirrors the current view into `location.hash` (e.g. `#plantilla`) for shareable URLs — back/forward navigation is not wired.

---

## Build-time version stamping

`vite.config.ts` writes `public/version.json` with a build timestamp on every build and exposes it as the `__BUILD_TIMESTAMP__` define. The running app polls `version.json` every 5 minutes and prompts a reload when the timestamp differs — this is how users receive updates without a service worker.

- Do not remove or rename either side without updating the other.
- `base: './'` in `vite.config.ts` is required for GitHub Pages (asset paths must be relative). Do not switch to an absolute base.

---

## Content conventions

Player, team, manager, and stadium IDs are stable strings. User-facing names are jokes/puns in Spanish (see `CONTRIBUIR.md`). When adding fixtures:
1. Follow the existing ID scheme in the JSON files.
2. Add a matching entry to each of the four `names/*.json` maps.

---

## Coding principles

- **Keep it simple.** This is a small game. Three obvious lines beat one clever abstraction.
- **Pure engine, stateful UI.** Engine modules must never import React or touch localStorage. Components should not contain game logic.
- **No new dependencies without good reason.** Check the PolyForm Noncommercial 1.0.0 license for compatibility before adding packages.
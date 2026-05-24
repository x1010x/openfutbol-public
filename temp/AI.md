# AI.md — OpenFutbol Context Document

> **Purpose:** Give any AI agent working on this codebase instant, accurate context. Read this first. It replaces the need to grep widely. Update it whenever architectural facts change.

---

## 1. Project Identity

**OpenFutbol** — browser-based retro football management game. Inspired by PC Fútbol (90s). Runs entirely in-browser with no backend. State persisted in `localStorage`.

- **Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4
- **Deployment:** Cloudflare Pages (`wrangler.jsonc`)
- **Repo:** `openfutbol-public` (public, PolyForm Noncommercial)
- **Current version:** 1.4.0 (branch: `promanager-florentino`)

---

## 2. Architecture — Critical Files

Read these before touching anything:

| File | What it contains |
|------|-----------------|
| `src/store/leagueStore.ts` | `LeagueState` type, all game logic functions, transfer system, AI behaviour |
| `src/App.tsx` | All views, all event handlers, modal rendering, routing (single-page, `view` state) |
| `src/types/game.d.ts` | `Player`, `Team`, `Position`, `FormationId` — core types |
| `src/engine/simEngine.ts` | Minute-by-minute match simulation, team strength |
| `src/engine/florentinometro.ts` | ProManager scoring: board meter, reputation, job offers |
| `src/engine/formations.ts` | `pickBestXI`, `effectiveMedia`, `isOOP`, `liveMed` |
| `src/data/economy.ts` | `computePrice`, `teamWeeklySalary`, `formatEuros` |
| `src/i18n/en.json` + `es.json` | All UI strings — always keep in sync |

### Directory map

```
src/
  components/   UI: views, modals, widgets (one file per component)
  engine/       Pure game logic (no React)
  store/        LeagueState definition + all mutating functions
  data/         Static data, economy helpers, team/player generators
  types/        game.d.ts (Player, Team, etc.)
  i18n/         en.json, es.json, index.ts (custom hook, not i18next)
```

---

## 3. i18n System — NOT i18next

The project uses a **custom** i18n system, NOT i18next.

```typescript
// src/i18n/index.ts — custom hook
import { useT } from '../i18n';
const t = useT();
t('some.key')                         // basic
t('some.key', { n: '3' })            // interpolation with {n}
```

- String files: `src/i18n/en.json` and `src/i18n/es.json`
- Language detected from browser; stored in localStorage
- **Rule:** Every new UI string gets a key in BOTH files. Keys are dot-namespaced: `section.x`, `btn.x`, `misc.x`, `status.x`, `nav.x`, `label.x`, `florentino.x`, `promanager.x`, `career.x`, `transfer.x`, `tutorial.x`

---

## 4. State — LeagueState

Single object in `localStorage` key `openfutbol_league`. All fields optional where backward-compat required.

### Key fields

```typescript
LeagueState {
  // Core
  isStarted: boolean
  year: number                       // e.g. 2026
  currentJornada: number
  schedule: Jornada[]                // full season schedule
  teams: Team[]                      // all teams incl. user team
  stats: Record<string, TeamStats>
  userTeamId: string
  gameMode: 'standard' | 'fantasy' | 'promanager'

  // Finances
  transferLog: TransferRecord[]      // capped at 30 entries
  finances: Record<string, TeamFinances>

  // ProManager fields (all optional for compat)
  managerName?: string
  managerCareer?: ManagerSeasonRecord[]
  managerReputation?: number         // 0–100, persists across seasons
  managerInitialSquadValue?: number  // budget + player values at stint start
  florentinometro?: number           // 0–10, current season board meter
  boardObjective?: BoardObjective    // 'win_league' | 'top_4' | 'top_half' | 'avoid_relegation'
  boardFired?: boolean
  boardWarnings?: number
  transferWindowEmergency?: boolean  // one free signing after clausulazo on last window day
}
```

### Mutating functions (in leagueStore.ts)

All return a new `LeagueState` — never mutate in place.

- `advanceSeason(state)` — advance to next year
- `generateIncomingOffers(state)` — offers for listed players only, window-gated
- `simulateAiClausulazos(state)` — rival teams trigger release clauses (5% per eligible rival)
- `autoListAiPlayers(state)` — AI squad management

---

## 5. ProManager Mode — Full Feature Map

ProManager is the career mode. Activated via "PRO MANAGER" on main menu.

### Board Meter (Florentinómetro)

- Scale: **0–10**, starts at 5 each new stint
- Per-match delta: `computeMatchMeterDelta()` in `florentinometro.ts`
  - Win base: +0.30, draw: 0.00, loss: −0.35
  - Context multipliers: upset win (vs stronger away) = +0.55, home loss vs weaker = −0.60
  - +0.04/goal (cap 0.16), +0.12 clean sheet, −0.015/yellow, −0.08/red
- Board fires at meter < 2 (with escalating warnings)
- Objective: assigned at season start, computed by `computeBoardObjective(team, allTeams)`

### Reputation System

- Scale: **0–100**, persists across seasons (does NOT reset)
- Per-match delta: `computeMatchReputationDelta()` in `florentinometro.ts`
- Season-end delta: `computeSeasonReputationDelta()` — objective met/missed, fired, squad value
- Gates job offers: thresholds at 30/45/60/75 (poor/average/good/elite clubs)
- Displayed in StatusBar (ProManager row) and ManagerCareerView

### Transfer Windows

```typescript
// src/store/leagueStore.ts
SUMMER_WINDOW_SIZE = 10   // jornadas 1–10
WINTER_WINDOW_SIZE = 8    // jornadas midSeason to midSeason+7

isTransferWindowOpen(jornada, totalJornadas): boolean
windowJornadasLeft(jornada, totalJornadas): number
jornadasUntilWindowOpen(jornada, totalJornadas): number
```

- All transfers/offers blocked outside windows
- `transferWindowEmergency` flag: one free signing when clausulazo hits on last window jornada
- StatusBar shows: `▲ Mercado · Cierra en NJ` / `▼ Mercado · Abre en NJ`

### Job Offers

- `teamsOfferingJobs(teams, userTeamId, reputation)` — filters by reputation
- Called in both `ProManagerSetupView` and `ProManagerEndView`

### Career Export/Import

- **Export:** In `ManagerCareerView` — downloads `{ managerName, managerCareer, managerReputation }` as JSON
- **Import:** Main menu "IMPORTAR MANAGER" button — loads JSON, opens team picker
- Career screen also has inline name edit

---

## 6. Component Inventory

Key components and what they do:

| Component | Role |
|-----------|------|
| `StatusBar` | Fixed bar: team name, position, round, points, GD, cash, market status, board meter (promanager), REP |
| `AlignmentView` | Full-width lineup editor — pitch diagram + sortable roster table, in-game substitutions |
| `SwapModal` | Player picker modal (fixed overlay, 860px max, 96vh) — pre-match swap |
| `TransfersView` | Market: listed players, free agents, incoming offers, window banner |
| `FinancesView` | Accounts, squad value, total assets, transfer log, weekly ledger |
| `ManagerCareerView` | Career stats, W/D/L bar, season history, export button, inline name edit |
| `ProManagerSetupView` | Year selector + team offer list with reputation bar |
| `ProManagerEndView` | End-of-season summary, next team picker |
| `ProManagerTutorialModal` | One-time tutorial shown on first team pick each stint |
| `BoardAlertModal` | Warning/praise from president |
| `PitchDiagram` | Visual 2D pitch with player circles |

---

## 7. Token-Saving Patterns

**Before starting a session, read only:**
1. This file (AI.md)
2. The file you're about to edit
3. `LeagueState` interface in `leagueStore.ts` (lines ~185–250) if touching state

**Do NOT read wholesale:**
- All of `App.tsx` (2500+ lines) — grep for the specific handler/view first
- All of `leagueStore.ts` (1400+ lines) — grep for the function, read ±30 lines
- i18n files — grep for the key namespace you need

**Grep patterns that work well:**
```bash
grep -n "functionName\|relatedTerm" src/App.tsx | head -20
grep -n "interface\|export.*const\|export.*function" src/store/leagueStore.ts | head -40
grep -n "key.namespace" src/i18n/en.json
```

**Adding a feature checklist:**
1. Add state fields to `LeagueState` (optional, for backward compat)
2. Add logic function to `leagueStore.ts` or engine file
3. Wire handler in `App.tsx` (`setLeague(prev => ...)`)
4. Update/create component
5. Add i18n keys to BOTH `en.json` and `es.json`
6. `npx tsc -b --noEmit` — must be clean before committing

---

## 8. What's Stable vs Active Development

**Stable (don't touch without reason):**
- Match simulation engine (`simEngine.ts`)
- Calendar/scheduling (`calendar.ts`)
- Formation logic (`formations.ts`)
- Economy (`economy.ts`)
- Fantasy mode

**Active development (branch: `promanager-florentino`):**
- ProManager mode — board meter, reputation, windows, career
- Transfer market logic
- Finances view

---

## 9. Session Log

| Date | Work done |
|------|-----------|
| 2026-05-21 | i18n refactor, simEngine localization, TypeScript fixes |
| 2026-05-22 | ProManager mode: Florentinómetro, board alerts, career screen |
| 2026-05-23 | Clausulazo system, transfer windows (10+8 jornadas), SwapModal full-screen |
| 2026-05-24 | Reputation system (0–100), context-aware match scoring, market status in StatusBar, full-screen AlignmentView, career export/import, FinancesView transfer log, ProManager tutorial modal |

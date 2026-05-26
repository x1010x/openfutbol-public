# OpenFutbol: Technical Documentation

OpenFutbol is a lightweight, browser-based football management game built with React, TypeScript, Vite, and Tailwind CSS. This document provides an architectural overview for technical contributors.

## Stack

- **Framework:** React 19 with functional components and hooks
- **Language:** TypeScript (strict mode)
- **Build:** Vite 8 + `tsc` for type checking
- **Styling:** Tailwind CSS v4 (VGA retro palette + optional `cool:` theme variant)
- **Deployment:** Cloudflare Pages (`wrangler.jsonc`)

## Directory Structure

```
src/
  components/     UI: views, modals, widgets — one file per component
  engine/         Pure game logic (no React): match sim, formations, florentinómetro
  store/          LeagueState type + all mutating functions (leagueStore.ts)
  data/           Economy helpers, static team/player generators
  types/          game.d.ts — Player, Team, Position, FormationId
  i18n/           en.json, es.json, index.ts (custom hook)
public/
  assets/         Sprites, crest colours, misc images
  version.json    Build timestamp
```

## State Management

All game state lives in a single `LeagueState` object (defined in `src/store/leagueStore.ts`) persisted to `localStorage` under the key `openfutbol_league`.

- **Initialization:** `getInitialLeagueState()` builds a fresh world from static data
- **Advancement:** `advanceSeason()` snapshots stats, handles retirements, resets rosters, generates a new schedule
- **Mutations:** All logic functions return a **new** `LeagueState` — never mutate in place
- **React layer:** `App.tsx` owns `useState<LeagueState>` and wires all handlers via `setLeague(prev => ...)`

New fields added to `LeagueState` should be **optional** for backward compatibility with saves from older versions.

## Internationalisation (i18n)

The project uses a **custom** i18n system — not i18next.

```typescript
import { useT } from '../i18n';
const t = useT();
t('section.key')                    // simple string
t('section.key', { n: '3' })       // interpolation — {n} in the JSON value
```

String bundles: `src/i18n/en.json` and `src/i18n/es.json`. Both files must stay in sync. Language is auto-detected from the browser and stored in localStorage.

Key namespaces: `btn`, `nav`, `label`, `misc`, `section`, `status`, `florentino`, `promanager`, `career`, `transfer`, `tutorial`.

## Simulation Engine (`src/engine/simEngine.ts`)

Runs a minute-by-minute match simulation.

- `simulateMinute()` — calculates possession, goal chances, fouls
- `calculateTeamStrength(team, sentOff?, stamina?)` — weighted average of player media adjusted for formation fit and stamina
- AI substitutions: triggered between minutes 60–88 when stamina < 55

## Scheduling (`src/engine/calendar.ts`)

- `generateSchedule()` — standard round-robin rotation
- `balanceSchedule()` — post-processing pass to reduce home/away streaks

## Formation & Lineup Logic (`src/engine/formations.ts`)

- `pickBestXI(players, formation, excluded, discipline)` — two-pass selection: fill natural positions first, then best available
- `pickBestFormation(team)` — tests all formations, picks highest total strength
- `effectiveMedia(player, slotPos)` — media penalised for out-of-position play
- `isOOP(player, slotPos)` — true if player is out of position
- `liveMed(player, stamina, slotPos)` — real-time media accounting for fatigue

## ProManager Mode (`src/engine/florentinometro.ts`)

Career mode with two persistent scoring systems:

**Board Meter (Florentinómetro), 0–10:**
- Resets to 5 each new stint; tracks president satisfaction
- `computeMatchMeterDelta()` — per-match delta based on result, home/away, relative team strength, goals, clean sheets, cards
- `computeBoardObjective()` — assigns seasonal objective based on team strength

**Reputation, 0–100:**
- Persists across clubs and seasons
- `computeMatchReputationDelta()` — per-match delta
- `computeSeasonReputationDelta()` — end-of-season delta (objective, firing, squad value change)
- Gates job offers via `teamsOfferingJobs(teams, userTeamId, reputation)`

**Transfer Windows:**
- Summer: jornadas 1–10; Winter: mid-season for 8 jornadas
- `isTransferWindowOpen()`, `windowJornadasLeft()`, `jornadasUntilWindowOpen()` in `leagueStore.ts`
- All transfers blocked outside windows; one emergency signing allowed after a clausulazo on the last window day

## Economy (`src/data/economy.ts`)

- `computePrice(player, year)` — player market value
- `teamWeeklySalary(team, year)` — total weekly wage bill
- `computeAttendance(team, match)` — gate revenue per home match
- `formatEuros(amount)` — display helper

## Contribution Guidelines

1. **Type safety:** Add new game objects to `src/types/game.d.ts`; new state fields to `LeagueState` as optional
2. **i18n:** Every UI string needs a key in both `en.json` and `es.json`
3. **Backward compat:** New `LeagueState` fields must be optional; read them with `?? defaultValue`
4. **Verify:** Run `npx tsc -b --noEmit` — must be clean before committing
5. **No auto-push:** Commits go on the active feature branch; only push explicitly

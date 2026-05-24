# OpenFutbol: Technical Documentation

OpenFutbol is a lightweight, browser-based football management simulation game built with React, TypeScript, and Vite. This document provides an architectural overview for technical contributors.

## Architecture

The project follows a component-based UI architecture with a centralized state management approach.

### Core Architecture
- **Framework:** [React](https://react.dev/) with functional components and hooks.
- **Language:** TypeScript for type safety.
- **Build System:** [Vite](https://vitejs.dev/) with `tsc` for type checking.
- **Styling:** Vanilla CSS (no Tailwind/SASS, relying on standard CSS/utility classes where appropriate).

### Directory Structure
- `src/components/`: UI components (Views, modals, UI widgets).
- `src/engine/`: Core game logic: match simulation, formation algorithms, calendar/scheduling.
- `src/store/`: Centralized state definitions (`LeagueState`), main business logic for league advancement, transfers, and AI management.
- `src/data/`: Mock data generators, economics definitions, and static assets.
- `src/types/`: Centralized type definitions for game objects (Player, Team, MatchState).

## State Management

The game state is managed in a single object `LeagueState` (defined in `src/store/leagueStore.ts`). 

- **Persistence:** The `LeagueState` is serialized and stored in `localStorage` (`openfutbol_league`).
- **Initialization:** `getInitialLeagueState()` creates a new game world.
- **Advancement:** The league advances season-by-season via `advanceSeason()`, which snapshots stats, handles retirements, resets rosters, and generates a new schedule.

## Simulation Engine (`src/engine/simEngine.ts`)

The simulation engine runs a minute-by-minute match simulation.

- **Match Simulation:** `simulateMinute()` calculates possession, goal chances, and fouls based on `calculateTeamStrength`.
- **Strength Calculation:** Factors in player media, formation compatibility, and stamina.
- **Tactical Substitutions:** AI manages stamina by making substitutions between minutes 60 and 88 if players are below 55 stamina.

## Scheduling Algorithm (`src/engine/calendar.ts`)

Fixtures are generated using a standard rotation algorithm:
- `generateSchedule()` produces a Round Robin table.
- A `balanceSchedule()` post-processing pass is applied to swap home/away games to minimize streaks (consecutive games at home/away) while maintaining a balanced total count.

## Team Selection & Lineup Logic (`src/engine/formations.ts`)

AI and UI tools optimize team selection:
- **`pickBestXI`:** A two-pass selection algorithm. It fills the lineup with players natural to their position, then fills any remaining slots with the best available candidates.
- **`pickBestFormation`:** Iterates through all available formations to find the one that yields the highest total strength for the team.

## Contribution Guidelines

1. **Keep it fast:** Avoid heavy client-side processing in the render loop.
2. **Type Safety:** Always add types to new game objects in `src/types/game.d.ts`.
3. **Simulation Integrity:** When modifying match logic, verify impact on the overall league economy and team strength distributions.
4. **Validation:** Always verify changes by running `npm run build` to ensure type compatibility.

# OpenFutbol

Open-source retro football management game inspired by PC Fútbol (1990s).

Game is live at: https://x1010x.github.io/openfutbol-public/

## Features

- Pick a club from the available leagues and manage your squad.
- Set your lineup, choose formation, and tweak tactics.
- Simulate matches minute-by-minute with individual player stats driving outcomes.
- Manage stamina, substitutions (3/match), injuries, and suspensions.
- Negotiate transfers, set ticket prices, and track finances.
- Fantasy mode: custom league + snake draft from a player pool.
- League table, top scorers (Pichichi / Zamora), and full season stats.
- End-of-season awards and season progression.

## Quick Start

```bash
git clone https://github.com/your-username/openfutbol.git
cd openfutbol
npm install
npm run dev
```

`npm run dev` starts the Vite dev server.
`npm run build` type-checks then produces the production bundle.

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 8 (Rolldown), `tsc -b` for type checking |
| State | `useState` + `localStorage` — no external store |

## Project Structure

```
src/
  App.tsx                   Main app: view router, match loop, all top-level state
  types/game.d.ts           All shared TypeScript types
  index.css                 Tailwind config + theme styling

  engine/
    simEngine.ts            Minute-by-minute match simulation
    formations.ts           Formation definitions, OOP penalty, effective media
    calendar.ts             Round-robin schedule generator
    playerMood.ts           Mood system (affects effective stats)

  store/
    leagueStore.ts          League state helpers, stats, transfers, salary logic

  data/
    mockTeams.ts            Loads DB, builds Team objects, age curves, helpers
    economy.ts              Player pricing, salary calculation, TV bonuses
    db/
      players/              Placeholder players with randomized stats
      teams/                Team rosters and season data
      free_agents.json      Player IDs available as free agents
      names/
        player_names.json   Player names keyed by UUID
        team_names.json     Team names keyed by UUID
        manager_names.json  Manager names keyed by teamUUID_year
        stadium_names.json  Stadium names keyed by teamUUID_year

  components/               UI components
```

## Data Layer

OpenFutbol uses a decoupled data architecture where both identity and attributes are easily editable by the community:

- `players/` — Player stats and attributes mapped by UUID. **Editable: adjust skills, peak age, or birth years here.**
- `teams/` — Team rosters and season configurations.
- `names/` — Editable name maps; change a name here (players, teams, managers, stadiums) and it propagates everywhere at runtime.

The default dataset included is a placeholder set of 10 teams and 220 players designed for development and testing. Players now include a specific **Goalkeeping (POR)** stat that distinguishes keepers from field players.

## Contributing

The easiest way to contribute is editing the JSON files in `src/data/db/names/` — fix a stadium name, correct a manager, or update player names. No build step required; changes are loaded at runtime.

## License

PolyForm Noncommercial License 1.0.0

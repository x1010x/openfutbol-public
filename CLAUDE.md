# OpenFútbol — Codebase Reference

## Stack
- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS v4 (config via `@theme` in `src/index.css`, NOT tailwind.config.js)
- No router, no state library, no tests. Single-page app.
- `npm run dev` — dev server. `npm run build` — type-check + build.

## File Map

| File | Purpose |
|------|---------|
| `src/App.tsx` | ~2200 lines. ALL app state, routing, match simulation loop, navigation bar. The monolith. |
| `src/store/leagueStore.ts` | ~1173 lines. Pure functions that transform `LeagueState`. No React. |
| `src/types/game.d.ts` | All TypeScript types. Source of truth for data shapes. |
| `src/data/economy.ts` | `computePrice`, `formatEuros`, `evaluateOffer`, `computeAttendance`, salary math. |
| `src/engine/formations.ts` | Formations, `pickBestXI`, `liveMed`, `STAT_WEIGHTS`, `buildSlotMap`. |
| `src/engine/simEngine.ts` | Match simulation engine (~378 lines). |
| `src/engine/playerMood.ts` | `moodStateOf`, `applyMoodToTeam`, mood score logic. |
| `src/engine/calendar.ts` | `generateSchedule` (round-robin). |
| `src/data/mockTeams.ts` | Team/player loaders from JSON DB files. |
| `src/index.css` | Tailwind config + VGA color palette + retrocool theme overrides. |

### Components

| Component | Purpose |
|-----------|---------|
| `PlayerCard.tsx` | Player card with stats bars. Props: `player, seasonYear, highlight?, onNameClick?, footer?, moodState?, liveMedValue?`. `highlight` values: `'listed'`=yellow border, `'free'`=green, `'rival'`=cyan. |
| `SquadView.tsx` | Squad management. Renders player cards by position group. Has inline offer accept/reject/counter UI. Props include `incomingOffers`, `teams`, offer callbacks. |
| `TransfersView.tsx` | Transfer market (buy from other teams, free agents). Has two modals: `BidModal` and `FreeAgentModal`. |
| `AlignmentView.tsx` | Tactical lineup editor (drag to swap, formation picker). |
| `MessageModal.tsx` | Generic modal. Props: `title, subtitle?, tone?, buttonLabel?, onClose, children`. Tones: `info/success/danger/warning`. Has `max-h-[90vh] flex flex-col` + scrollable body. |
| `SwapModal.tsx` | Player picker modal (swap in lineup). Already scrollable: `max-h-[90vh] flex flex-col + flex-1 overflow-y-auto`. |
| `StatDrillDown.tsx` | Stat detail popup. Already scrollable: `max-h-[85vh] flex flex-col`. |
| `PlayerName.tsx` | Renders player name (handles `useShirt` prop for shirt name). |
| `PlayerPhoto.tsx` | Player portrait. Falls back to silhouette if no photo. |
| `PitchDiagram.tsx` | SVG football pitch with player bubbles. |
| `StatusBar.tsx` | Bottom navigation bar. |
| `PlayerCard.tsx` | Used by SquadView, TransfersView, PlayerDetailView, EquipoView. |
| `TeamSelection.tsx` | Initial team picker screen. |
| `EndOfSeasonView.tsx` | Season summary + awards. |
| `FinancesView.tsx` | Budget, salary, attendance charts. |
| `StatsView.tsx` | League stats table. |
| `ResultsView.tsx` | Match results history. |
| `EditorView.tsx` | Dev/admin editor for teams/players. |
| `BackupView.tsx` | Save/load game state (Base64 encoded JSON). |
| `ColaborarView.tsx` | Community contribution screen. |

## Navigation / View System

`App.tsx` uses a single `view` state (no router):

```ts
type View = 'LEAGUE' | 'SQUAD' | 'ALIGNMENT' | 'RESULTS' | 'STATS' |
            'FINANCES' | 'TRANSFERS' | 'JORNADA_RESULTS' | 'END_OF_SEASON' |
            'PLAYER_DETAIL' | 'BACKUP' | 'EDITOR' | 'EQUIPO';
```

Navigation: `setView(...)`. `PLAYER_DETAIL` saves `previousView` to go back. `viewingTeamId` controls whether SQUAD shows user's team or an opponent.

## Key Data Types (`src/types/game.d.ts`)

```ts
Position = 'POR' | 'DEF' | 'MED' | 'DEL' | 'AML' | 'AMR'
FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '4-2-4' | '5-4-1' | '3-4-3'

Player {
  id, name, fullName, position, preferredPos, allowedPositions,
  number, stats: PlayerStats, media, birthYear, peakAge,
  forSale?, seasonStats, suspensionMatches, stamina, injuryWeeksRemaining
}

PlayerStats { speed, dribbling, passing, shooting, defending, physical, goalkeeping }

Team {
  id, name, colors?, year, manager?, stadiumName?, stadiumCapacity,
  ticketPrice, players, lineup, formation, budget, tacticalDiscipline
}

LeagueState {
  teams, stats, finances, incomingOffers, freeAgents, schedule,
  currentJornada, lastPlayedJornada, userTeamId, isStarted,
  seasonFinished, year, transferLog, playerHistory, teamRecords,
  leagueHistory, blockedSignings
}
```

## State / Persistence

- Game state = `LeagueState` stored in `localStorage` key `openfutbol_league` (JSON).
- Saved on every state change via `useEffect`.
- Backup/restore: Base64-encoded JSON via `src/utils/backupUtils.ts`.
- Other `localStorage` keys: `openfutbol_muted`, `openfutbol_theme`, `openfutbol_welcomed`, `openfutbol_seen_version`.
- No server, no database. 100% client-side.

## Economy (`src/data/economy.ts`)

- `computePrice(player, year)` — cubic curve on `media/99`, capped at €70M, with age multiplier.
- `ageMultiplier` — 1.2x before peak, 1.0x at peak±2, -10% per year after.
- `computeWeeklySalary(price)` — price / 2000.
- `formatEuros(amount)` — Spanish locale (€ format).
- `offerStep(price)` — 5% of price, min €100k, rounded to €100k.

## Engine (`src/engine/formations.ts`)

- `FORMATIONS` — maps FormationId → Position[] (11 slots).
- `STAT_WEIGHTS` — per-position weighting of the 7 stats for `media` calculation.
- `OOP_PENALTY = 0.825` — out-of-position multiplier. `GK_OOP_PENALTY = 0.45`.
- `liveMed(player, stam, slotPos?)` — effective MED for simulation (stamina + OOP).
- `pickBestXI(players, formation, excludeIds, disciplined)` — greedy lineup builder.
- `buildSlotMap(team)` — returns Map<playerId, slotPosition>.

## Transfers / Offers

- `IncomingOffer { id, playerId, fromTeamId, amount, jornada, expiresAt, offeredPlayerIds? }` — in `leagueStore.ts`.
- `generateIncomingOffers(state)` — AI generates offers each jornada. Considers `forSale`, player attraction, budget.
- `affordableOffers` = offers where `bidder.budget >= offer.amount` (filtered in SquadView before display).
- `signingBlockKey(sellerTeamId, playerId)` — key for `blockedSignings` (prevents re-offers after rejection).
- SquadView: offers shown **inline on player cards** (VER OFERTA button → expands ACEPTAR/RECHAZAR/CONTRA). NO separate top panel.

## VGA Color Palette (Tailwind classes)

| Class | Hex | Use |
|-------|-----|-----|
| `vga-black` | #000000 | backgrounds |
| `vga-blue` | #0000aa | panels |
| `vga-yellow` | #ffff55 | highlights, alerts, selected |
| `vga-light-green` | #55ff55 | prices, positive stats |
| `vga-light-red` | #ff5555 | danger, injury, red cards |
| `vga-cyan` | #00aaaa | labels, headers |
| `vga-light-cyan` | #55ffff | accent, links |
| `vga-gray` | #555555 | disabled, muted |
| `vga-bright-white` | #ffffff | primary text |
| `vga-magenta` | #aa00aa | special events |
| `vga-light-magenta` | #ff55ff | AML/AMR position color |

Second theme `retrocool` (selector: `data-theme="retrocool"` on body, Tailwind variant `cool:`). Scales fonts with `clamp()` for larger screens.

## Modal / Scrollability Pattern

All modals must follow this pattern to avoid content being cut off on small screens:

```jsx
<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
  <div className="... max-h-[90vh] flex flex-col gap-2 min-h-0">
    <div className="... shrink-0">{ /* fixed header */ }</div>
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
      { /* scrollable content */ }
    </div>
    <div className="... shrink-0">{ /* fixed footer/button */ }</div>
  </div>
</div>
```

Key: `min-h-0` on both outer and scrollable div (flex children default to `min-height: auto` which breaks overflow). `shrink-0` on header and footer buttons.

## Match Simulation (App.tsx ~line 780–1000)

- `match: MatchState | null` — live match state.
- Match loop runs via `setInterval` (speed-controlled). Calls `simEngine` tick-by-tick.
- `showSubPanel` — CAMBIOS modal. `subsUsed` tracks substitutions (max 3).
- Half-time: `htPaused` flag. Second half resumes via "CONTINUAR".
- CAMBIOS modal: header (shrink-0) + tabs (shrink-0) + scrollable content area (`flex-1 overflow-y-auto min-h-0`) + CONTINUAR button (shrink-0).

## AI Behavior (leagueStore.ts)

- `repickAiFormations` — AI picks best formation each jornada.
- `autoListAiPlayers` — AI lists surplus players for sale.
- `simulateAiMarketSignings` — AI buys from transfer market.
- `simulateAiTrades` — AI-to-AI trades.
- `simulateAiFreeAgentSignings` — AI signs free agents.
- `generateIncomingOffers` — AI makes offers to buy user's players.
- `advanceSeason` — end-of-season: player aging, stats reset, budget recalculation.

## Player Mood (`src/engine/playerMood.ts`)

5 states (0–4): `▼▼ ▼ — ▲ ▲▲`. Score 0–100 based on lineup spot, goals, assists, minutes/game. Mood symbol shown in PlayerCard next to MED value. `applyMoodToTeam` adjusts 1–2 stats ±1 for match simulation only (not persisted).

## Stamina / Injuries

- `player.stamina` — 1-99. Decays after matches (`decayTeamStaminaAfterMatch`). Recovers weekly (`applyStaminaRecovery`).
- `player.injuryWeeksRemaining` — 0 = healthy. Shown as `LES Xs` badge on player card.
- `player.suspensionMatches` — yellow card accumulation.

## Formations Available

`'4-4-2' | '5-3-2' | '4-3-3' | '4-2-4' | '5-4-1' | '3-4-3'`

Position slots per formation defined in `FORMATIONS` record in `formations.ts`.

## Position Groups (for squad management)

```ts
PosGroup = 'POR' | 'DEF' | 'MED' | 'DEL'  // AML/AMR map to MED group
SQUAD_TARGETS = { POR: 3, DEF: 6, MED: 6, DEL: 5 }
```

SquadView groups players into 5 display sections: PORTEROS, DEFENSAS, CENTROCAMPO, EXTREMOS, DELANTEROS.

## Common Patterns

**Adding a badge/indicator to PlayerCard footer:**
The `footer` prop is a `ReactNode`. In SquadView, the footer row structure is:
```
[CAN bar]  [injury badge] [offer badge]   ← row 1
[price]    [action button]                ← row 2
[offer detail panel if expanded]          ← row 3 (conditional)
```

**Checking player offers in SquadView:**
```ts
const playerOffers = affordableOffers.filter(o => o.playerId === player.id);
const hasOffers = playerOffers.length > 0;
```
`affordableOffers` is computed at component top from `incomingOffers` prop (filters out bids the AI can't afford).

**Price formatting:** Always use `formatEuros(computePrice(player, seasonYear))`.

**Highlight border on PlayerCard:** Pass `highlight='listed'` (yellow), `'free'` (green), or `'rival'` (cyan). Default is white.

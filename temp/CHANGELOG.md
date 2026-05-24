# Changelog

## [1.5.0] - 2026-05-24

### Junior players (natural selection)
- When a player retires, their child appears the next season as a 17-year-old free agent
- Name: "{Name} Jr." — chains to "Jr. Jr.", "Jr. Jr. Jr." etc. for dynasty lines
- Stats: parent's approximate peak stats recovered from retirement degradation, then each attribute varies ±10 independently (natural selection — some better, some worse)
- Goalkeepers pass on GK ability; outfield players do not
- Peak age inherited from parent with ±3 random variation
- Juniors persist as free agents across seasons until they retire; they also generate their own juniors if they retire from a team

### Florentinómetro tuning
- Diminishing returns near extremes: resistance zone spans 0–3 and 7–10
- Positive deltas shrink as meter approaches 10; negative deltas shrink near 0
- Factor at zone boundary: 100% → floor of 15% at the extreme

### ProManager end-of-season retention
- Probabilistic: meter ≥ 9 → 97% kept; ≥ 7 → 80%; ≥ 6 → 60%; below 6 → exponential decay (5 → 24%, 4 → 10%, 3 → 4%)

### Florentinómetro 6.0 milestone
- New "LA JUNTA HA TOMADO NOTA" message band triggers at ≥ 6.0 (5 dark-humor variants)
- Layered threshold reset: each band can re-trigger independently on re-climb

### Clausulazo shows player MED in alert
- Alert body now displays the transferred player's media rating in parentheses

### Career view
- Career stats are now purely historical — no live-state leakage between jornadas

### Transfer one-per-season rule
- Players can only be transferred between teams once per season

## [1.4.0] - 2026-05-24

### ProManager — Career Mode Expansion

**Reputation system (0–100)**
- New `managerReputation` score persists across clubs and seasons (separate from Florentinómetro)
- Per-match reputation delta based on result vs opponent strength, home/away factor
- Season-end delta: objective met/missed, firing penalty, squad value change
- Gates job offers: thresholds at 30/45/60/75 (rookie → elite clubs)
- Displayed in StatusBar, ManagerCareerView, and ProManager screens

**Context-aware match scoring**
- `computeMatchMeterDelta()` replaces flat win/draw/loss deltas
- Upset wins (away vs stronger) rewarded; home losses vs weaker punished
- Goals, clean sheets, yellow/red cards all affect both meters

**Transfer windows**
- Summer window: first 10 jornadas; Winter window: 8 jornadas at mid-season
- All transfers and incoming offers blocked outside windows
- Emergency signing unlocked when a clausulazo fires on the last window day
- Market status visible at all times in StatusBar: `▲ Mercado · Cierra en NJ`
- Window banner in TransfersView with countdown

**Clausulazo tuning**
- Reduced from 10% → 5% probability per eligible rival per jornada (~1 per window average)
- Incoming offers now only generated for players listed on the market

**Career export / import**
- Export career JSON from the Career screen (name, history, reputation)
- Import career from main menu "IMPORTAR MANAGER" button — restores and opens team picker
- Inline manager name edit in Career screen

**UI improvements**
- AlignmentView: removed maxWidth cap, player list fills viewport height
- SwapModal: widened to 860px, 96vh height, longer name column
- ProManagerTutorialModal: shown on first team pick, explains all game systems
- FinancesView: transfer history, squad value, total assets added

---

## [1.3.0] - 2026-05-22

### ProManager mode
- Florentinómetro (0–10 board satisfaction meter)
- Board objective system: win league / top 4 / top half / avoid relegation
- Board warning alerts and firing mechanic
- Manager career record — persists across seasons
- Job offer system filtered by career rating
- Career screen with W/D/L history and season records

### AI clausulazo system
- Rival AI teams can trigger release clauses on high-value user players
- Pays 2× market price directly; player leaves immediately
- Gated to transfer windows

---

## [1.2.0] - 2026-05-21

### i18n — Full English/Spanish support
- Custom `useT()` hook with `en.json` / `es.json` bundles
- All UI components, match events, and menus translated
- Language auto-detected from browser; persisted in localStorage

---

## [1.0.0] - 2026-05-20

### Ready for Public Repository
- **Database Refactor:** Migrated to UUID-based architecture for teams and players
- **Data Anonymization:** Replaced historical datasets with fictional placeholder data (10 teams, 220 players)
- **Performance:** Raw JSON imports, removed Base64 encoding layer
- **Project Rebranding:** Renamed from `pcfurbo` to `openfutbol`
- **UI/UX:** Finalized two retro themes (`retrocutre` and `retrocool`)
- **Clean Slate:** Removed all internal analytics and private developer docs

---

### Previous Versions (Alpha/Beta)
- **v0.14.2:** Initial migration to separated name maps
- **v0.10.0–v0.14.0:** SimEngine, Fantasy Draft, and Economy layers
- **v0.1.0–v0.9.0:** Core React architecture, theme system, basic league simulation

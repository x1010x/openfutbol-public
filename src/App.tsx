import { useState, useEffect, useRef, useMemo } from 'react';
import { t, useT } from './i18n';

import { getAvailableYears, getAvailableYearsWithStats, getTeamColorsForYear, migrateTeam, buildFreeAgentFromDB, buildTeamFromSeason, getTeamTemplatesForYear, getFantasyPool, buildFantasyTeam } from './data/mockTeams';
import type { FormationId, MatchEvent, MatchState, Player, Team } from './types/game.d.ts';
import { applyMoodToTeam } from './engine/playerMood';
import { simulateMinute, calculateTeamStrength } from './engine/simEngine';
import { FORMATIONS, pickBestXI } from './engine/formations';
import { getInitialLeagueState, getFantasyLeagueState, updateLeagueStats, deductWeeklySalaries, generateIncomingOffers, autoListAiPlayers, simulateAiMarketSignings, advanceSeason, simulateAiTrades, simulateAiFreeAgentSignings, simulateAiClausulazos, simulateAiInterClausulazos, appendTransfer, decrementSuspensions, signingBlockKey, transferredKey, squadNeeds, groupFor, repickAiFormations, writebackMatchStamina, decayTeamStaminaAfterMatch, decrementInjuries, applyStaminaRecovery, computeTvBonus, applyTvBonus, isTransferWindowOpen, windowJornadasLeft, jornadasUntilWindowOpen } from './store/leagueStore';
import type { TransferRecord, ManagerSeasonRecord, IncomingOffer } from './store/leagueStore';
import type { LeagueState } from './store/leagueStore';
import { migrateLegacyKey, getActiveSlotId, saveSlot, createSlotFromCurrent } from './store/saveSlots';
import { computeBoardObjective, computeTransferDelta, firingChance, applyMeterDelta, isObjectiveMet, computeMatchMeterDelta, computeMatchReputationDelta, computeSeasonReputationDelta, computeSeasonMeterDelta } from './engine/florentinometro';
import { engineSettings, loadEngineSettings } from './engine/engineSettings';
loadEngineSettings();
import { LeagueTable } from './components/LeagueTable';
import { StatusBar } from './components/StatusBar';
import { AppHeader } from './components/AppHeader';
import { SquadView } from './components/SquadView';
import { SquadViewCompact } from './components/SquadViewCompact';
import { TeamPicker } from './components/TeamPicker';
import { AlignmentView } from './components/AlignmentView';
import { ResultsView } from './components/ResultsView';
import { StatsView } from './components/StatsView';
import { FinancesView } from './components/FinancesView';
import { EndOfSeasonView } from './components/EndOfSeasonView';
import { InstructionsView } from './components/InstructionsView';
import { ColaborarView } from './components/ColaborarView';
import { TransfersView } from './components/TransfersView';
import { JornadaResultsView } from './components/JornadaResultsView';
import { PlayerDetailView } from './components/PlayerDetailView';
import { BackupView } from './components/BackupView';
import { EditorView } from './components/EditorView';
import { LeagueSetupView } from './components/LeagueSetupView';
import { ManagerCareerView } from './components/ManagerCareerView';
import { ProManagerEndView } from './components/ProManagerEndView';
import { ProManagerSetupView } from './components/ProManagerSetupView';
import { ProManagerTutorialModal } from './components/ProManagerTutorialModal';
import { EquipoView } from './components/EquipoView';
import { TeamCrest } from './components/TeamCrest';
import { PitchDiagram } from './components/PitchDiagram';
import { StatDrillDown } from './components/StatDrillDown';
import { MessageModal } from './components/MessageModal';
import { PlayerNegotiationModal } from './components/PlayerNegotiationModal';
import { TournamentSetupView } from './components/TournamentSetupView';
import { BracketView } from './components/BracketView';
import { TournamentRoundResultsModal } from './components/TournamentRoundResultsModal';
import { TournamentMatchPreview } from './components/TournamentMatchPreview';
import { SeasonStatsTable } from './components/SeasonStatsTable';
import { PackEditorView } from './components/PackEditorView';
import { createTournament, advanceCurrentStage, saveTournament, loadTournament, userNextAction, spectatorNextMatch, recordUserLigaMatch, recordUserKoLeg } from './store/tournamentStore';
import type { TournamentState, UserNextAction } from './store/tournamentStore';
import { BoardAlertModal } from './components/BoardAlertModal';
import { DisclaimerView } from './components/DisclaimerView';
import { SwapModal } from './components/SwapModal';
import { FantasySetupView } from './components/FantasySetupView';
import { FantasyDraftView } from './components/FantasyDraftView';
import type { StatKey } from './components/StatDrillDown';
import { extractDbId } from './data/mockTeams';
import { startAmbiance, stopAmbiance, fadeOutAmbiance, setAmbianceMuted, playGoalSignal, playGoalWithCelebration, playMissed, playWhistle, playWhistleEnd } from './sfx';
import { computePrice, evaluateOffer, formatEuros, computeClausulazoPrice, computeAttendance } from './data/economy';
import { PlayerTooltipProvider } from './contexts/PlayerTooltipContext';
import { formatJornadaDate } from './engine/calendar';
import type { OfferResult } from './data/economy';
import { PackLoaderView } from './components/PackLoaderView';
import MatchScreen from './components/MatchScreen';
import { usePack } from './state/PackContext';
import { buildTeamFromPackClub, trimRoster, isAgeEligible } from './data/packTeamBuilder';
import { runtimePlayerFromPack, joinPlayerName } from './data/playerBuilder';

type View = 'LEAGUE' | 'SQUAD' | 'ALIGNMENT' | 'RESULTS' | 'STATS' | 'FINANCES' | 'TRANSFERS' | 'JORNADA_RESULTS' | 'END_OF_SEASON' | 'PLAYER_DETAIL' | 'BACKUP' | 'EDITOR' | 'EQUIPO' | 'MANAGER_CAREER' | 'PACK_LOADER' | 'PACK_EDITOR';


function App({ onLeagueReady }: { onLeagueReady?: () => void } = {}) {
  useT(); // subscribe to language changes so nav labels and messages re-render
  const { pack, loading: packLoading } = usePack();
  const PICKER_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const [pickerYear, setPickerYear] = useState<number>(PICKER_YEARS[PICKER_YEARS.length - 1]);
  const pickerSummaries = useMemo(() => {
    if (!pack) return [] as import('./components/TeamPicker').TeamSummary[];
    const countryById = new Map(pack.countries.map(c => [c.id, c.code?.toUpperCase() ?? 'unknown']));
    const leagueById = new Map(pack.leagues.map(l => [l.id, l]));
    const playersByClub = new Map<string, typeof pack.players>();
    for (const p of pack.players) {
      if (!p.club_id) continue;
      const arr = playersByClub.get(p.club_id) ?? [];
      arr.push(p);
      playersByClub.set(p.club_id, arr);
    }
    // Same age-curve the engine uses at runtime (calculateTeamStrength /
    // simEngine): clamp(1 - |age - peakAge| * 0.02, 0.7, 1). peakAge defaults
    // to 28 for all pack players (matches playerBuilder).
    const PEAK = 28;
    const ageMed = (p: typeof pack.players[number]) => {
      const birthYear = parseInt(p.birth_date.slice(0, 4), 10);
      const age = pickerYear - birthYear;
      const factor = Math.min(1, Math.max(0.7, 1 - Math.abs(age - PEAK) * 0.02));
      return Math.floor((p.current_ability * factor) / 2);
    };
    const ageOk = (p: typeof pack.players[number]) => {
      const by = parseInt(p.birth_date.slice(0, 4), 10);
      return isAgeEligible(by, pickerYear);
    };
    return pack.clubs.map(c => {
      const players = (playersByClub.get(c.id) ?? []).filter(ageOk);
      const withMed = players.map(p => ({ p, med: ageMed(p) }));
      const sorted = [...withMed].sort((a, b) => b.med - a.med);
      const core = sorted.slice(0, 18);
      const avg = core.length ? core.reduce((s, x) => s + x.med, 0) / core.length : 0;
      const med = Math.floor(avg);
      const top = sorted[0];
      const lg = c.league_id ? leagueById.get(c.league_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        colors: c.colors ? [c.colors.background, c.colors.foreground] as [string, string] : undefined,
        country: (lg?.country_id && countryById.get(lg.country_id)) || undefined,
        league: lg?.name ?? null,
        med,
        playerCount: players.length,
        topPlayerName: top ? `${top.p.first_name} ${top.p.last_name}` : undefined,
        topPlayerMed: top?.med,
      };
    });
  }, [pack, pickerYear]);
  const buildPickerTeam = useMemo(
    () => pack ? ((id: string) => {
      const club = pack.clubs.find(c => c.id === id);
      return club ? buildTeamFromPackClub(club, pack, pickerYear) : null;
    }) : undefined,
    [pack, pickerYear]
  );
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [league, setLeague] = useState<LeagueState>(() => {
    migrateLegacyKey();
    const saved = localStorage.getItem('openfutbol_league');
    if (saved) {
      const parsed = JSON.parse(saved);
      const firstPlayer = parsed.teams?.[0]?.players?.[0];
      const hasOldStats = firstPlayer?.stats?.velocidad !== undefined;
      // Each line guards against a specific old save format. If a field is
      // missing or in its legacy shape, wipe and start fresh rather than
      // trying to patch a broken state. Add a check here whenever LeagueState
      // gains a required field that old saves won't have.
      const needsReset =
        (parsed.schema_version ?? 1) !== 2 ||       // schema_version mismatch — wipe
        parsed.isStarted === undefined ||           // pre-isStarted saves
        !parsed.schedule ||                         // pre-schedule saves
        !parsed.year ||                             // pre-multi-year saves
        !parsed.teams[0]?.lineup ||                 // pre-formation/lineup saves
        parsed.teams[0]?.players?.length < 9 ||     // saves with undersized squads
        parsed.teams[0]?.players?.[0]?.id?.includes('_p') || // old _p player ID format
        hasOldStats ||                              // old Spanish stat names (velocidad etc.)
        firstPlayer?.birthYear === undefined ||     // pre-age/retirement system
        !parsed.finances ||                         // pre-finances system
        !Array.isArray(parsed.incomingOffers) ||    // pre-transfer-offers system
        !Array.isArray(parsed.freeAgents) ||        // pre-free-agent-market
        !Array.isArray(parsed.finances[Object.keys(parsed.finances)[0]]?.weeks) || // pre-weekly-finance-tracking
        typeof parsed.lastPlayedJornada !== 'number'; // pre-jornada-tracking

      if (needsReset) {
        localStorage.setItem('openfutbol_db_wiped', '1');
        return getInitialLeagueState();
      }
      const colorsByTeamId = getTeamColorsForYear(parsed.year);
      const hydratedTeams = parsed.teams.map((t: Team) => migrateTeam({
        ...t,
        colors: t.colors ?? colorsByTeamId.get(t.id),
        players: (t.players ?? []).map(p => {
          if (!p.first_name || !p.last_name) return p;
          const joined = joinPlayerName(p.first_name, p.last_name);
          return { ...p, name: joined, fullName: joined };
        }),
      }));
      const teamRecords: Record<string, import('./store/leagueStore').TeamRecords> = parsed.teamRecords && typeof parsed.teamRecords === 'object' ? parsed.teamRecords : {};
      hydratedTeams.forEach((t: Team) => {
        const existing = teamRecords[t.id];
        teamRecords[t.id] = {
          biggestWin: existing?.biggestWin ?? null,
          heaviestDefeat: existing?.heaviestDefeat ?? null,
          mostGoalsInMatch: existing?.mostGoalsInMatch ?? null,
          longestUnbeaten: existing?.longestUnbeaten ?? 0,
          longestUnbeatenSpan: existing?.longestUnbeatenSpan ?? null,
          currentUnbeaten: existing?.currentUnbeaten ?? 0,
          currentUnbeatenStart: existing?.currentUnbeatenStart ?? null,
          longestWinning: existing?.longestWinning ?? 0,
          longestWinningSpan: existing?.longestWinningSpan ?? null,
          currentWinning: existing?.currentWinning ?? 0,
          currentWinningStart: existing?.currentWinningStart ?? null,
        };
      });
      return {
        ...parsed,
        teams: hydratedTeams,
        seasonFinished: parsed.seasonFinished ?? false,
        transferLog: Array.isArray(parsed.transferLog) ? parsed.transferLog : [],
        playerHistory: parsed.playerHistory && typeof parsed.playerHistory === 'object' ? parsed.playerHistory : {},
        teamRecords,
        leagueHistory: Array.isArray(parsed.leagueHistory) ? parsed.leagueHistory : [],
        blockedSignings: Array.isArray(parsed.blockedSignings) ? parsed.blockedSignings : [],
      };
    }
    return getInitialLeagueState();
  });
  const [view, setView] = useState<View>(() =>
    league.seasonFinished && league.isStarted ? 'END_OF_SEASON' : 'LEAGUE'
  );
  const [match, setMatch] = useState<MatchState | null>(null);
  const [matchDuration, setMatchDuration] = useState<number>(30); // 30s por defecto
  const [showPreview, setShowPreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayFlow, setShowPlayFlow] = useState(false);
  const [showTournamentFlow, setShowTournamentFlow] = useState(false);
  const [tournament, setTournament] = useState<TournamentState | null>(() => loadTournament());
  const [tournamentRoundRecap, setTournamentRoundRecap] = useState<number | null>(null);
  const [tournamentMatchCtx, setTournamentMatchCtx] = useState<UserNextAction | null>(null);
  const [tournamentSubView, setTournamentSubView] = useState<null | 'ALIGNMENT' | 'SQUAD' | 'STATS'>(null);
  // When set, the SQUAD subview shows this team instead of the user's team.
  const [tournamentViewingTeamId, setTournamentViewingTeamId] = useState<string | null>(null);
  const [tournamentPendingAction, setTournamentPendingAction] = useState<UserNextAction | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showColaborar, setShowColaborar] = useState(false);
  const [instructionsScroll, setInstructionsScroll] = useState<'changelog' | 'engine' | undefined>(undefined);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [drillDown, setDrillDown] = useState<{ teamId: string; stat: StatKey } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<View>('LEAGUE');
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ title: string; body: string; tone?: 'info' | 'danger' | 'warning' } | null>(null);
  const [saleNegotiation, setSaleNegotiation] = useState<{ offer: IncomingOffer; player: Player; buyer: Team; seller: Team } | null>(null);
  const [clausulaNegotiation, setClausulaNegotiation] = useState<{ player: Player; buyer: Team; seller: Team; cost: number; fromTeamId: string } | null>(null);
  const [outgoingNegotiation, setOutgoingNegotiation] = useState<{ player: Player; buyer: Team; seller: Team; amount: number; fromTeamId: string; offeredPlayerIds: string[] } | null>(null);
  const [freeAgentNegotiation, setFreeAgentNegotiation] = useState<{ player: Player; buyer: Team } | null>(null);
  const [boardAlert, setBoardAlert] = useState<{ title: string; body: string; tone: 'danger' | 'warning' | 'success' } | null>(null);
  const [lastBoardAlert, setLastBoardAlert] = useState<{ title: string; body: string; tone: 'danger' | 'warning' | 'success' } | null>(null);
  const [htPaused, setHtPaused] = useState(false);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [preselectedSubPlayerId, setPreselectedSubPlayerId] = useState<string | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [squadCompact, setSquadCompact] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('openfutbol_squad_compact');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const toggleSquadCompact = () => {
    setSquadCompact(prev => {
      const next = !prev;
      try { localStorage.setItem('openfutbol_squad_compact', next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };
  const [previewSwapSlot, setPreviewSwapSlot] = useState<number | null>(null);
  const [showFantasyFlow, setShowFantasyFlow] = useState(false);
  const [showProManagerFlow, setShowProManagerFlow] = useState(false);
  const [showProManagerTutorial, setShowProManagerTutorial] = useState(false);
  const [fantasyYear, setFantasyYear] = useState(0);
  const [fantasyConfig, setFantasyConfig] = useState<{ teamIds: string[]; userTeamId: string; cap: number | null } | null>(null);
  const [returnToFantasy, setReturnToFantasy] = useState(false);

  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(() => localStorage.getItem('openfutbol_welcomed') !== '1');
  const dismissDisclaimer = () => {
    localStorage.setItem('openfutbol_welcomed', '1');
    localStorage.setItem('openfutbol_disclaimer', '1');
    setShowDisclaimer(false);
  };

  useEffect(() => {
    const VIEW_SLUGS: Partial<Record<View, string>> = {
      LEAGUE: 'menu', SQUAD: 'plantilla', ALIGNMENT: 'alineacion',
      TRANSFERS: 'fichajes', STATS: 'estadisticas', FINANCES: 'dinero',
      RESULTS: 'partido', JORNADA_RESULTS: 'resultados', END_OF_SEASON: 'fin-temporada',
      PLAYER_DETAIL: 'jugador', BACKUP: 'sistema', EDITOR: 'editor', EQUIPO: 'equipo',
    };
    let slug: string;
    if (showInstructions) slug = 'instrucciones';
    else if (showFantasyFlow && !fantasyConfig) slug = 'fantasy-setup';
    else if (showFantasyFlow && fantasyConfig) slug = 'fantasy-sorteo';
    else if (!league.isStarted) slug = view === 'EDITOR' ? 'editor' : view === 'BACKUP' ? 'sistema' : 'inicio';
    else slug = VIEW_SLUGS[view] ?? view.toLowerCase();
    history.replaceState(null, '', `#${slug}`);
  }, [view, showInstructions, showFantasyFlow, fantasyConfig, league.isStarted]);

  const DB_WIPE_JOKES = [0, 1, 2, 3, 4, 5].map(i => t(`dbWipe.${i}`));
  const [dbWipeMsg] = useState<string | null>(() => {
    if (localStorage.getItem('openfutbol_db_wiped') !== '1') return null;
    localStorage.removeItem('openfutbol_db_wiped');
    return DB_WIPE_JOKES[Math.floor(Math.random() * DB_WIPE_JOKES.length)];
  });
  const [dbWipeDismissed, setDbWipeDismissed] = useState(false);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('version.json?t=' + Date.now());
        const data = await res.json();
        if (String(data.ts) !== __BUILD_TIMESTAMP__) setUpdateAvailable(true);
      } catch {}
    };
    const initial = setTimeout(check, 20000);
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const flagged = localStorage.getItem('openfutbol_show_changelog') === '1';
    if (flagged) {
      localStorage.removeItem('openfutbol_show_changelog');
      setInstructionsScroll('changelog');
      setShowInstructions(true);
      return;
    }
    const seen = localStorage.getItem('openfutbol_seen_version');
    if (seen !== __BUILD_TIMESTAMP__) {
      if (seen) setHasNewVersion(true);
      localStorage.setItem('openfutbol_seen_version', __BUILD_TIMESTAMP__);
    }
  }, []);

  const [muted] = useState<boolean>(() => localStorage.getItem('openfutbol_muted') === '1');

  const [theme] = useState<'retrocutre' | 'retrocool'>(() =>
    (localStorage.getItem('openfutbol_theme') as 'retrocutre' | 'retrocool') ?? 'retrocool'
  );
  useEffect(() => {
    if (theme === 'retrocool') {
      document.body.dataset.theme = 'retrocool';
    } else {
      delete document.body.dataset.theme;
    }
  }, [theme]);

  // Persist tournament state to its own localStorage key.
  useEffect(() => { saveTournament(tournament); }, [tournament]);


  const showPlayerDetail = (playerId: string) => {
    if (view !== 'PLAYER_DETAIL') setPreviousView(view);
    setSelectedPlayerId(playerId);
    setView('PLAYER_DETAIL');
  };
  const eventLogRef = useRef<HTMLDivElement>(null);

  const didNotifyReady = useRef(false);
  useEffect(() => {
    localStorage.setItem('openfutbol_league', JSON.stringify(league));
    if (league.isStarted) {
      const activeId = getActiveSlotId();
      if (activeId) {
        try { saveSlot(activeId, league); } catch (e) { console.warn('saveSlot failed', e); }
      } else {
        try { createSlotFromCurrent(league); } catch (e) { console.warn('createSlotFromCurrent failed', e); }
      }
    }
    if (league.isStarted && !didNotifyReady.current) {
      didNotifyReady.current = true;
      onLeagueReady?.();
    }
  }, [league]);

  const [leagueSetupDone, setLeagueSetupDone] = useState(false);

  const handleSelectYear = (year: number) => {
    if (year === 0) {
      setSelectedYear(null);
      setLeagueSetupDone(false);
      return;
    }
    setSelectedYear(year);
    setLeagueSetupDone(false);
  };

  const handleLeagueSetupConfirm = (selectedTeamIds: string[], extraRawPlayers: import('./types/game.d.ts').RawPlayerDB[], importedRawTeams: import('./types/game.d.ts').RawTeamDB[], yearOverride?: number) => {
    const yr = yearOverride ?? selectedYear!;
    const selectedSet = new Set(selectedTeamIds);
    let extraTeams: import('./types/game.d.ts').Team[] = [];
    let extraFreeAgents: import('./types/game.d.ts').Player[] = [];

    if (pack) {
      // Build teams from pack clubs
      const packClubIds = new Set(pack.clubs.map(c => c.id));
      const selectedPackClubs = pack.clubs.filter(c => selectedSet.has(c.id));
      extraTeams = selectedPackClubs.map(club => buildTeamFromPackClub(club, pack, yr));
      // Free agents: players not assigned to any selected club
      extraFreeAgents = pack.players
        .filter(p => !p.club_id || !packClubIds.has(p.club_id) || !selectedSet.has(p.club_id))
        .filter(p => {
          const by = parseInt(p.birth_date.slice(0, 4), 10);
          return isAgeEligible(by, yr);
        })
        .slice(0, 500) // cap to avoid bloat
        .map(p => runtimePlayerFromPack(p, 0));
    } else {
      // Legacy: build from imported raw teams + editor teams
      const importedTeams = importedRawTeams
        .filter(rt => selectedSet.has(rt.id))
        .flatMap(rt => {
          const season = rt.seasons.find(s => s.year === yr) ?? rt.seasons[0];
          if (!season) return [];
          return [buildTeamFromSeason({ id: rt.id, name: rt.name, ...season })];
        });
      const dbTeamIds = new Set(getTeamTemplatesForYear(yr).map(t => t.id));
      const importedRawIds = new Set(importedRawTeams.map(rt => rt.id));
      const editorTeams = league.teams.filter(t => !dbTeamIds.has(t.id) && !importedRawIds.has(t.id));
      extraTeams = [...importedTeams, ...editorTeams];
      extraFreeAgents = extraRawPlayers
        .map(p => buildFreeAgentFromDB(p, yr))
        .filter((p): p is import('./types/game.d.ts').Player => p !== null);
    }

    // Belt-and-suspenders: enforce 22-player cap at selection time. Any squad
    // overflow becomes free agents so they're not lost.
    const overflowFreeAgents: import('./types/game.d.ts').Player[] = [];
    const trimmedExtraTeams = extraTeams.map(t => {
      const kept = trimRoster(t.players);
      if (kept.length < t.players.length) {
        const keptIds = new Set(kept.map(p => p.id));
        overflowFreeAgents.push(...t.players.filter(p => !keptIds.has(p.id)));
      }
      return { ...t, players: kept, lineup: t.lineup.filter(id => kept.some(p => p.id === id)) };
    });

    setLeague(getInitialLeagueState(
      yr,
      selectedTeamIds,
      [...extraFreeAgents, ...overflowFreeAgents],
      trimmedExtraTeams,
    ));
    setLeagueSetupDone(true);
  };

  const handleSelectTeam = (teamId: string) => {
    setLeague(prev => {
      const team = prev.teams.find(t => t.id === teamId)!;
      const objective = computeBoardObjective(team, prev.teams);
      let next: LeagueState = { ...prev, userTeamId: teamId, isStarted: true, boardObjective: objective, florentinometro: 5, florentinometroPeak: 5, florentinometroMin: 5 };
      for (let i = 0; i < 4; i++) {
        next = autoListAiPlayers(next);
      }
      return next;
    });
  };

  const handleProManagerSelectYear = (year: number) => {
    if (year === 0) {
      setSelectedYear(null);
      setLeagueSetupDone(false);
      return;
    }
    setSelectedYear(year);
    setLeagueSetupDone(false);
  };

  const handleSelectTeamProManager = (teamId: string, managerName: string) => {
    setLeague(prev => {
      const team = prev.teams.find(t => t.id === teamId)!;
      const objective = computeBoardObjective(team, prev.teams);
      const initialSquadValue = team.budget + team.players.reduce((s, p) => s + computePrice(p, prev.year), 0);
      let next: LeagueState = {
        ...prev,
        userTeamId: teamId,
        isStarted: true,
        gameMode: 'promanager',
        managerName,
        boardObjective: objective,
        florentinometro: 5,
        florentinometroPeak: 5,
        florentinometroMin: 5,
        seasonTransferSpent: 0,
        seasonTransferEarned: 0,
        managerStartJornada: 1,
        managerWins: 0,
        managerDraws: 0,
        managerLosses: 0,
        managerReputation: prev.managerReputation ?? 50,
        managerInitialSquadValue: initialSquadValue,
      };
      for (let i = 0; i < 4; i++) {
        next = autoListAiPlayers(next);
      }
      return next;
    });
    setShowProManagerFlow(false);
    setSelectedYear(null);
    setShowProManagerTutorial(true);
    setView('LEAGUE');
  };

  const buildSeasonCareerRecord = (prev: LeagueState, fired: boolean): ManagerSeasonRecord => {
    const sortedStats = Object.values(prev.stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    });
    const userRank = sortedStats.findIndex(s => s.teamId === prev.userTeamId) + 1;
    const totalTeams = sortedStats.length;
    const userTeam = prev.teams.find(t => t.id === prev.userTeamId);
    const objective = prev.boardObjective ?? 'avoid_relegation';
    return {
      year: prev.year,
      teamName: userTeam?.name ?? '',
      teamId: prev.userTeamId,
      finalPosition: userRank,
      totalTeams,
      objective,
      objectiveMet: isObjectiveMet(objective, userRank, totalTeams),
      florentinometroFinal: prev.florentinometro ?? 5,
      florentinometroPeak: prev.florentinometroPeak ?? 5,
      florentinometroMin: prev.florentinometroMin ?? 5,
      gamesManaged: (prev.managerWins ?? 0) + (prev.managerDraws ?? 0) + (prev.managerLosses ?? 0),
      wins: prev.managerWins ?? 0,
      draws: prev.managerDraws ?? 0,
      losses: prev.managerLosses ?? 0,
      transferBalance: (prev.seasonTransferEarned ?? 0) - (prev.seasonTransferSpent ?? 0),
      fired,
    };
  };

  const handleUpdateAlignment = (patch: { lineup: string[]; formation: FormationId }) => {
    setLeague(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === prev.userTeamId ? { ...t, lineup: patch.lineup, formation: patch.formation } : t
      )
    }));
  };

  const handleUpdateTicketPrice = (price: number) => {
    setLeague(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === prev.userTeamId ? { ...t, ticketPrice: price } : t
      )
    }));
  };

  // Free agents have no transfer fee — the user goes straight to negotiating
  // wages with the player. The `amount` arg is kept for backwards compat with
  // the existing inline UI but is ignored.
  const handleOfferForFreeAgent = (playerId: string, _amount: number): OfferResult => {
    void _amount;
    if (!windowOpen) {
      return { accepted: false, message: t('transfer.windowClosedAction') };
    }
    const player = league.freeAgents.find(p => p.id === playerId);
    const buyer = league.teams.find(t => t.id === league.userTeamId);
    if (!player || !buyer) {
      return { accepted: false, message: 'Operación inválida.' };
    }
    const blockKey = signingBlockKey(null, playerId);
    if (league.blockedSignings.includes(blockKey)) {
      return { accepted: false, message: 'No se admiten más ofertas por este jugador esta temporada.' };
    }
    setFreeAgentNegotiation({ player, buyer });
    return { accepted: true, message: 'Negociando con el jugador...' };
  };

  const commitFreeAgentSigning = (player: Player, agreedSalary: number, years: number) => {
    setLeague(prev => {
      const userTeam = prev.teams.find(t => t.id === prev.userTeamId);
      if (!userTeam) return prev;
      const expYear = prev.year + years;
      const signedPlayer: Player = {
        ...player,
        forSale: false,
        contract: { salary: agreedSalary, expiration: `${expYear}-06-30` },
      };
      const entry: TransferRecord = {
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada, year: prev.year,
        playerName: player.name, playerPosition: player.position,
        fromTeamName: null, toTeamName: userTeam.name,
        amount: 0,
      };
      return {
        ...prev,
        teams: prev.teams.map(t =>
          t.id === prev.userTeamId
            ? { ...t, players: [...t.players, signedPlayer] }
            : t
        ),
        freeAgents: prev.freeAgents.filter(p => p.id !== player.id),
        transferLog: appendTransfer(prev.transferLog, entry),
      };
    });
  };

  const handleOfferForPlayer = (
    playerId: string,
    fromTeamId: string,
    amount: number,
    offeredPlayerIds: string[] = [],
  ): OfferResult => {
    if (!windowOpen) {
      return { accepted: false, message: t('transfer.windowClosedAction') };
    }
    const seller = league.teams.find(t => t.id === fromTeamId);
    const player = seller?.players.find(p => p.id === playerId);
    const buyer = league.teams.find(t => t.id === league.userTeamId);
    if (!seller || !buyer || !player) {
      return { accepted: false, message: 'Operación inválida.' };
    }
    const blockKey = signingBlockKey(fromTeamId, playerId);
    if (league.blockedSignings.includes(blockKey)) {
      return { accepted: false, message: 'El club no acepta más ofertas por este jugador esta temporada.' };
    }
    if (league.blockedSignings.includes(transferredKey(playerId))) {
      return { accepted: false, message: t('msg.alreadyTransferred.body', { player: player.name }) };
    }
    if (buyer.budget < amount) {
      return { accepted: false, message: 'No tienes presupuesto suficiente.' };
    }
    const offeredPlayers = offeredPlayerIds
      .map(id => buyer.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (offeredPlayers.length !== offeredPlayerIds.length) {
      return { accepted: false, message: 'Algunos jugadores ofrecidos no están en tu plantilla.' };
    }
    // Squad floors: both clubs must stay at >= 11 players after the swap.
    const buyerFinalSize = buyer.players.length - offeredPlayers.length + 1;
    const sellerFinalSize = seller.players.length - 1 + offeredPlayers.length;
    if (buyerFinalSize < 11) {
      return { accepted: false, message: 'Tu plantilla quedaría con menos de 11 jugadores.' };
    }
    if (sellerFinalSize < 11) {
      return { accepted: false, message: 'La plantilla del club rival quedaría incompleta.' };
    }

    const price = computePrice(player, league.year);
    const offeredValue = offeredPlayers.reduce((s, p) => s + computePrice(p, league.year), 0);
    const totalValue = amount + offeredValue;
    // Small need-based adjustment: if the offered players fill positions the seller
    // is short in, drop the threshold a touch; if they pile onto a surplus, raise it.
    const sellerNeeds = squadNeeds(seller);
    let needAdjust = 1.0;
    for (const op of offeredPlayers) {
      const g = groupFor(op.position);
      if (sellerNeeds[g] > 0) needAdjust -= 0.03;
      else if (sellerNeeds[g] <= -2) needAdjust += 0.03;
    }
    needAdjust = Math.max(0.9, Math.min(1.1, needAdjust));
    const effectivePrice = price * needAdjust;
    const result = evaluateOffer(effectivePrice, totalValue);
    if (!result.accepted) {
      if (result.blocked) {
        setLeague(prev => ({ ...prev, blockedSignings: [...prev.blockedSignings, blockKey] }));
      }
      return result;
    }
    // AI seller accepted the fee. Now open the player negotiation modal —
    // the player still has to want the move and we (the buyer) set the terms.
    setOutgoingNegotiation({ player, buyer, seller, amount, fromTeamId, offeredPlayerIds });
    return { accepted: true, message: '¡Club acepta! Negociando con el jugador...' };
  };

  const commitOutgoingOfferAccept = (
    player: Player, fromTeamId: string, amount: number,
    offeredPlayerIds: string[], agreedSalary: number, years: number,
  ) => {
    setLeague(prev => {
      const seller = prev.teams.find(tm => tm.id === fromTeamId);
      const buyerTeam = prev.teams.find(tm => tm.id === prev.userTeamId);
      if (!seller || !buyerTeam) return prev;
      const offeredPlayers = offeredPlayerIds
        .map(id => buyerTeam.players.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const tradeId = offeredPlayers.length > 0
        ? `usr_trade_${prev.currentJornada}_${player.id}_${Date.now()}`
        : undefined;
      const records: TransferRecord[] = [];
      records.push({
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada,
        year: prev.year,
        playerName: player.name,
        playerPosition: player.position,
        fromTeamName: seller.name,
        toTeamName: buyerTeam.name,
        amount,
        tradeId,
      });
      offeredPlayers.forEach((op, i) => {
        records.push({
          id: `tx_${prev.currentJornada}_${op.id}_${Date.now()}_${i}`,
          jornada: prev.currentJornada,
          year: prev.year,
          playerName: op.name,
          playerPosition: op.position,
          fromTeamName: buyerTeam.name,
          toTeamName: seller.name,
          amount: 0,
          tradeId,
        });
      });

      const offeredIdSet = new Set(offeredPlayerIds);
      const marketValue = computePrice(player, prev.year);
      const florentinoDelta = (prev.gameMode === 'promanager' && !prev.boardFired)
        ? computeTransferDelta(player, amount, marketValue, true, prev.year)
        : 0;
      const newMeter = florentinoDelta !== 0 ? applyMeterDelta(prev.florentinometro ?? 5, florentinoDelta) : (prev.florentinometro ?? 5);
      const expYear = prev.year + years;
      const newContract = { salary: agreedSalary, expiration: `${expYear}-06-30` };
      return {
        ...prev,
        teams: prev.teams.map(tm => {
          if (tm.id === fromTeamId) {
            return {
              ...tm,
              players: tm.players
                .filter(p => p.id !== player.id)
                .concat(offeredPlayers.map(p => ({ ...p, forSale: false }))),
              lineup: tm.lineup.filter(id => id !== player.id),
              budget: tm.budget + amount,
            };
          }
          if (tm.id === prev.userTeamId) {
            return {
              ...tm,
              players: tm.players
                .filter(p => !offeredIdSet.has(p.id))
                .concat({ ...player, forSale: false, contract: newContract }),
              lineup: tm.lineup.filter(id => !offeredIdSet.has(id)),
              budget: tm.budget - amount,
            };
          }
          return tm;
        }),
        transferLog: records.reduce((log, rec) => appendTransfer(log, rec), prev.transferLog),
        florentinometro: newMeter,
        florentinometroPeak: Math.max(prev.florentinometroPeak ?? 5, newMeter),
        florentinometroMin: Math.min(prev.florentinometroMin ?? 5, newMeter),
        seasonTransferSpent: (prev.seasonTransferSpent ?? 0) + amount,
        blockedSignings: [...prev.blockedSignings,
          transferredKey(player.id),
          ...offeredPlayers.map(p => transferredKey(p.id)),
        ],
      };
    });
  };

  const handleClausula = (playerId: string, fromTeamId: string): OfferResult => {
    if (!windowOpen) {
      return { accepted: false, message: t('transfer.windowClosedAction') };
    }
    if (league.blockedSignings.includes(transferredKey(playerId))) {
      return { accepted: false, message: t('msg.alreadyTransferred.body', { player: '' }).trim() };
    }
    // In Pro Manager mode: board veto increases exponentially after 2 clausulazos
    if (league.gameMode === 'promanager') {
      const made = league.seasonClausulazosMade ?? 0;
      const vetoProb = made <= 1 ? 0 : made === 2 ? 0.5 : made === 3 ? 0.82 : 0.96;
      if (vetoProb > 0 && Math.random() < vetoProb) {
        const msgs = [
          t('misc.tebas.floren0'),
          t('misc.tebas.floren1'),
          t('misc.tebas.floren2'),
          t('misc.tebas.floren3'),
        ];
        const msg = msgs[Math.min(made - 2, msgs.length - 1)];
        return { accepted: false, message: msg };
      }
    }
    const prevReceived = league.seasonClausulazosReceived ?? {};
    if ((prevReceived[fromTeamId] ?? 0) >= 2) {
      return { accepted: false, message: t('misc.tebas.limitReceived') };
    }
    const seller = league.teams.find(t => t.id === fromTeamId);
    const player = seller?.players.find(p => p.id === playerId);
    const buyer = league.teams.find(t => t.id === league.userTeamId);
    if (!seller || !player || !buyer) return { accepted: false, message: 'Operación inválida.' };
    const price = computePrice(player, league.year);
    const clausulaCost = computeClausulazoPrice(price);
    if (buyer.budget < clausulaCost) return { accepted: false, message: 'No tienes presupuesto suficiente para la cláusula.' };
    // Clubs side: clausulazo amount is established. Open the player
    // negotiation modal; the actual commit waits for the modal outcome.
    setClausulaNegotiation({ player, buyer, seller, cost: clausulaCost, fromTeamId });
    return { accepted: true, message: 'Negociando con el jugador...' };
  };

  const commitClausula = (player: Player, fromTeamId: string, clausulaCost: number, agreedSalary: number, years: number) => {
    setLeague(prev => {
      const seller = prev.teams.find(tm => tm.id === fromTeamId);
      const buyer = prev.teams.find(tm => tm.id === prev.userTeamId);
      if (!seller || !buyer) return prev;
      const expYear = prev.year + years;
      const playerWithContract: Player = {
        ...player,
        forSale: false,
        contract: { salary: agreedSalary, expiration: `${expYear}-06-30` },
      };
      const entry: TransferRecord = {
        id: `clausula_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada, year: prev.year,
        playerName: player.name, playerPosition: player.position,
        fromTeamName: seller.name, toTeamName: buyer.name,
        amount: clausulaCost,
      };
      const marketValue = computePrice(player, prev.year);
      const florentinoDelta = (prev.gameMode === 'promanager' && !prev.boardFired)
        ? computeTransferDelta(player, clausulaCost, marketValue, true, prev.year)
        : 0;
      const newMeter = florentinoDelta !== 0 ? applyMeterDelta(prev.florentinometro ?? 5, florentinoDelta) : (prev.florentinometro ?? 5);
      const prevRec = prev.seasonClausulazosReceived ?? {};
      return {
        ...prev,
        teams: prev.teams.map(tm => {
          if (tm.id === fromTeamId) return { ...tm, players: tm.players.filter(p => p.id !== player.id), lineup: tm.lineup.filter(id => id !== player.id) };
          if (tm.id === prev.userTeamId) return { ...tm, players: [...tm.players, playerWithContract], budget: tm.budget - clausulaCost };
          return tm;
        }),
        transferLog: appendTransfer(prev.transferLog, entry),
        florentinometro: newMeter,
        florentinometroPeak: Math.max(prev.florentinometroPeak ?? 5, newMeter),
        florentinometroMin: Math.min(prev.florentinometroMin ?? 5, newMeter),
        seasonTransferSpent: (prev.seasonTransferSpent ?? 0) + clausulaCost,
        blockedSignings: [...prev.blockedSignings, transferredKey(player.id)],
        seasonClausulazosMade: (prev.seasonClausulazosMade ?? 0) + 1,
        seasonClausulazosReceived: { ...prevRec, [fromTeamId]: (prevRec[fromTeamId] ?? 0) + 1 },
      };
    });
  };

  const handleToggleForSale = (playerId: string) => {
    setLeague(prev => {
      const userTeam = prev.teams.find(t => t.id === prev.userTeamId);
      const wasForSale = userTeam?.players.find(p => p.id === playerId)?.forSale ?? false;
      const willBeForSale = !wasForSale;
      return {
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id !== prev.userTeamId) return t;
          return {
            ...t,
            players: t.players.map(p =>
              p.id === playerId ? { ...p, forSale: willBeForSale } : p
            ),
          };
        }),
        incomingOffers: willBeForSale
          ? prev.incomingOffers
          : prev.incomingOffers.filter(o => o.playerId !== playerId),
      };
    });
  };

  const handleAcceptIncomingOffer = (offerId: string) => {
    if (!windowOpen) {
      setMessage({ title: t('transfer.windowClosed'), body: t('transfer.windowClosedAction'), tone: 'warning' });
      return;
    }
    // Pre-validamos contra el estado actual para poder explicar el motivo si falla.
    const offer = league.incomingOffers.find(o => o.id === offerId);
    if (!offer) {
      setMessage({ title: t('msg.offerNotFound.title'), body: t('msg.offerNotFound.body'), tone: 'warning' });
      return;
    }
    const userTeam = league.teams.find(t => t.id === league.userTeamId);
    const buyer = league.teams.find(t => t.id === offer.fromTeamId);
    const player = userTeam?.players.find(p => p.id === offer.playerId);
    if (!userTeam || !buyer || !player) {
      setMessage({ title: t('msg.offerInvalid.title'), body: t('msg.offerInvalid.body'), tone: 'danger' });
      return;
    }
    if (league.blockedSignings.includes(transferredKey(offer.playerId))) {
      setMessage({ title: t('msg.alreadyTransferred.title'), body: t('msg.alreadyTransferred.body', { player: player.name }), tone: 'warning' });
      return;
    }
    if (buyer.budget < offer.amount) {
      setLeague(prev => ({
        ...prev,
        incomingOffers: prev.incomingOffers.filter(o => o.id !== offerId),
      }));
      setMessage({ title: t('msg.offerWithdrawn.title'), body: t('msg.offerWithdrawn.body', { buyer: buyer.name, amount: `${offer.amount.toLocaleString()}€`, player: player.name }), tone: 'warning' });
      return;
    }
    const offeredIds = offer.offeredPlayerIds ?? [];
    const offeredPlayers = offeredIds
      .map(id => buyer.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (offeredPlayers.length !== offeredIds.length) {
      setMessage({ title: t('msg.playerUnavailable.title'), body: t('msg.playerUnavailable.body', { team: buyer.name }), tone: 'warning' });
      return;
    }
    const userFinalSize = userTeam.players.length - 1 + offeredPlayers.length;
    const buyerFinalSize = buyer.players.length - offeredPlayers.length + 1;
    if (userFinalSize < 11) {
      setMessage({ title: t('msg.minSquad.title'), body: t('msg.minSquad.body', { n: String(userFinalSize) }), tone: 'warning' });
      return;
    }
    if (buyerFinalSize < 11) {
      setMessage({ title: t('msg.minSquadRival.title'), body: t('msg.minSquadRival.body', { team: buyer.name, n: String(buyerFinalSize) }), tone: 'warning' });
      return;
    }
    // Clubs have agreed. Open a visible negotiation modal: the AI buyer talks
    // to the player. The actual transfer commit waits for the modal outcome.
    setSaleNegotiation({ offer, player, buyer, seller: userTeam });
    return;
  };

  const commitIncomingOfferAccept = (offer: IncomingOffer, agreedSalary: number, years: number) => {
    const userTeam = league.teams.find(t => t.id === league.userTeamId);
    const buyer = league.teams.find(t => t.id === offer.fromTeamId);
    const player = userTeam?.players.find(p => p.id === offer.playerId);
    if (!userTeam || !buyer || !player) return;
    const offeredIds = offer.offeredPlayerIds ?? [];
    const offeredPlayers = offeredIds
      .map(id => buyer.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    setLeague(prev => {

      const tradeId = offeredPlayers.length > 0
        ? `inc_trade_${prev.currentJornada}_${offer.id}`
        : undefined;
      const records: TransferRecord[] = [];
      records.push({
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada,
        year: prev.year,
        playerName: player.name,
        playerPosition: player.position,
        fromTeamName: userTeam.name,
        toTeamName: buyer.name,
        amount: offer.amount,
        tradeId,
      });
      offeredPlayers.forEach((op, i) => {
        records.push({
          id: `tx_${prev.currentJornada}_${op.id}_${Date.now()}_${i}`,
          jornada: prev.currentJornada,
          year: prev.year,
          playerName: op.name,
          playerPosition: op.position,
          fromTeamName: buyer.name,
          toTeamName: userTeam.name,
          amount: 0,
          tradeId,
        });
      });

      const offeredIdSet = new Set(offeredIds);
      const marketValue = computePrice(player, prev.year);
      const florentinoDelta = (prev.gameMode === 'promanager' && !prev.boardFired)
        ? computeTransferDelta(player, offer.amount, marketValue, false, prev.year)
        : 0;
      const newMeter = florentinoDelta !== 0 ? applyMeterDelta(prev.florentinometro ?? 5, florentinoDelta) : (prev.florentinometro ?? 5);
      return {
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id === prev.userTeamId) {
            return {
              ...t,
              players: t.players
                .filter(p => p.id !== offer.playerId)
                .concat(offeredPlayers.map(p => ({ ...p, forSale: false }))),
              lineup: t.lineup.filter(id => id !== offer.playerId),
              budget: t.budget + offer.amount,
            };
          }
          if (t.id === offer.fromTeamId) {
            const expYear = prev.year + years;
            return {
              ...t,
              players: t.players
                .filter(p => !offeredIdSet.has(p.id))
                .concat({ ...player, forSale: false, contract: { salary: agreedSalary, expiration: `${expYear}-06-30` } }),
              lineup: t.lineup.filter(id => !offeredIdSet.has(id)),
              budget: t.budget - offer.amount,
            };
          }
          return t;
        }),
        incomingOffers: prev.incomingOffers.filter(o => o.playerId !== offer.playerId),
        transferLog: records.reduce((log, rec) => appendTransfer(log, rec), prev.transferLog),
        florentinometro: newMeter,
        florentinometroPeak: Math.max(prev.florentinometroPeak ?? 5, newMeter),
        florentinometroMin: Math.min(prev.florentinometroMin ?? 5, newMeter),
        seasonTransferEarned: (prev.seasonTransferEarned ?? 0) + offer.amount,
        blockedSignings: [...prev.blockedSignings,
          transferredKey(offer.playerId),
          ...offeredPlayers.map(p => transferredKey(p.id)),
        ],
      };
    });
  };

  const handleRejectIncomingOffer = (offerId: string) => {
    setLeague(prev => ({
      ...prev,
      incomingOffers: prev.incomingOffers.filter(o => o.id !== offerId),
    }));
  };

  const handleCounterIncomingOffer = (offerId: string, requestedCash: number, requestedPlayerIds: string[]) => {
    const offer = league.incomingOffers.find(o => o.id === offerId);
    if (!offer) return;
    const userTeam = league.teams.find(t => t.id === league.userTeamId);
    const buyer = league.teams.find(t => t.id === offer.fromTeamId);
    const player = userTeam?.players.find(p => p.id === offer.playerId);
    if (!userTeam || !buyer || !player) return;

    const requestedPlayers = requestedPlayerIds
      .map(id => buyer.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    if (requestedPlayers.length !== requestedPlayerIds.length) {
      setMessage({ title: t('msg.playerUnavailable.title'), body: t('msg.playerUnavailableRival.body'), tone: 'warning' });
      return;
    }

    const requestedPlayersValue = requestedPlayers.reduce((s, p) => s + computePrice(p, league.year), 0);
    const totalRequested = requestedCash + requestedPlayersValue;
    const playerPrice = computePrice(player, league.year);
    // AI evaluates from their side: they give up totalRequested, receive a player worth playerPrice.
    // If playerPrice < totalRequested * 0.7, it's insulting (asking way more than the player is worth).
    const result = evaluateOffer(totalRequested, playerPrice);

    if (!result.accepted) {
      if (result.blocked) {
        setLeague(prev => ({
          ...prev,
          incomingOffers: prev.incomingOffers.filter(o => o.id !== offerId),
          blockedSignings: [...prev.blockedSignings, signingBlockKey(offer.fromTeamId, offer.playerId)],
        }));
      }
      setMessage({ title: t('msg.rejected.title', { team: buyer.name }), body: result.message, tone: 'warning' });
      return;
    }

    // Accepted — execute with the counter terms
    const userFinalSize = userTeam.players.length - 1 + requestedPlayers.length;
    const buyerFinalSize = buyer.players.length - requestedPlayers.length + 1;
    if (userFinalSize < 11) {
      setMessage({ title: t('msg.minSquad.title'), body: t('msg.minSquadCounter.body', { n: String(userFinalSize) }), tone: 'warning' });
      return;
    }
    if (buyerFinalSize < 11) {
      setMessage({ title: t('msg.minSquadRival.title'), body: t('msg.minSquadRival.body', { team: buyer.name, n: String(buyerFinalSize) }), tone: 'warning' });
      return;
    }
    if (buyer.budget < requestedCash) {
      setMessage({ title: t('msg.budgetShort.title'), body: t('msg.budgetShort.body', { team: buyer.name, amount: formatEuros(requestedCash) }), tone: 'warning' });
      return;
    }

    setLeague(prev => {
      const tradeId = `counter_${prev.currentJornada}_${offer.id}`;
      const records: TransferRecord[] = [];
      records.push({
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada, year: prev.year,
        playerName: player.name, playerPosition: player.position,
        fromTeamName: userTeam.name, toTeamName: buyer.name,
        amount: requestedCash, tradeId,
      });
      requestedPlayers.forEach((rp, i) => {
        records.push({
          id: `tx_${prev.currentJornada}_${rp.id}_${Date.now()}_${i}`,
          jornada: prev.currentJornada, year: prev.year,
          playerName: rp.name, playerPosition: rp.position,
          fromTeamName: buyer.name, toTeamName: userTeam.name,
          amount: 0, tradeId,
        });
      });
      const reqIdSet = new Set(requestedPlayerIds);
      return {
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id === prev.userTeamId) return {
            ...t,
            players: t.players.filter(p => p.id !== offer.playerId).concat(requestedPlayers.map(p => ({ ...p, forSale: false }))),
            lineup: t.lineup.filter(id => id !== offer.playerId),
            budget: t.budget + requestedCash,
          };
          if (t.id === offer.fromTeamId) return {
            ...t,
            players: t.players.filter(p => !reqIdSet.has(p.id)).concat({ ...player, forSale: false }),
            lineup: t.lineup.filter(id => !reqIdSet.has(id)),
            budget: t.budget - requestedCash,
          };
          return t;
        }),
        incomingOffers: prev.incomingOffers.filter(o => o.playerId !== offer.playerId),
        transferLog: records.reduce((log, rec) => appendTransfer(log, rec), prev.transferLog),
        blockedSignings: [...prev.blockedSignings,
          transferredKey(offer.playerId),
          ...requestedPlayers.map(p => transferredKey(p.id)),
        ],
      };
    });
    setMessage({ title: t('msg.dealDone.title'), body: requestedPlayers.length > 0
      ? t('msg.dealDoneWith.body', { buyer: buyer.name, player: player.name, players: requestedPlayers.map(p => p.name).join(', ') })
      : t('msg.dealDone.body', { buyer: buyer.name, player: player.name }), tone: 'info' });
  };

  // Transfer window state (computed from current jornada)
  const totalJornadas = league.schedule.length;
  const windowOpen = isTransferWindowOpen(league.currentJornada, totalJornadas) || !!(league.transferWindowEmergency);
  const winLeft = windowJornadasLeft(league.currentJornada, totalJornadas);
  const winUntil = jornadasUntilWindowOpen(league.currentJornada, totalJornadas);

  // Encontrar el próximo partido del usuario
  const currentJornadaData = league.schedule.find(j => j.number === league.currentJornada);
  const userMatch = currentJornadaData?.matches.find(m =>
    m.homeId === league.userTeamId || m.awayId === league.userTeamId
  );

  const startNextMatch = () => {
    if (!userMatch) return;

    const homeTeam = league.teams.find(t => t.id === userMatch.homeId)!;
    const awayTeam = league.teams.find(t => t.id === userMatch.awayId)!;

    const userTeam = homeTeam.id === league.userTeamId ? homeTeam : awayTeam;
    const hasGk = userTeam.players.some(p => userTeam.lineup.includes(p.id) && p.position === 'POR');
    if (!hasGk) {
      alert(t('msg.noGK'));
      return;
    }
    const injuredInLineup = userTeam.players.filter(p => userTeam.lineup.includes(p.id) && (p.injuryWeeksRemaining ?? 0) > 0);
    if (injuredInLineup.length > 0) {
      alert(t('msg.injuredInLineup', { players: injuredInLineup.map(p => p.name).join(', ') }));
      return;
    }

    const opponentTeam = homeTeam.id === league.userTeamId ? awayTeam : homeTeam;
    const userIsHome = homeTeam.id === league.userTeamId;
    if (opponentTeam.players.length < 8) {
      const hScore = userIsHome ? 3 : 0;
      const aScore = userIsHome ? 0 : 3;
      let newLeague = updateLeagueStats(league, homeTeam.id, awayTeam.id, hScore, aScore, []);
      newLeague = simulateOtherMatches(newLeague, league.userTeamId);
      advanceAfterJornada(newLeague);
      return;
    }
    if (userTeam.players.length < 8) {
      const hScore = userIsHome ? 0 : 3;
      const aScore = userIsHome ? 3 : 0;
      let newLeague = updateLeagueStats(league, homeTeam.id, awayTeam.id, hScore, aScore, []);
      newLeague = simulateOtherMatches(newLeague, league.userTeamId);
      advanceAfterJornada(newLeague);
      return;
    }

    const speed = (matchDuration * 1000) / 90;
    const moodHomeTeam = applyMoodToTeam(homeTeam);
    const moodAwayTeam = applyMoodToTeam(awayTeam);
    const initialMatch: MatchState = {
      homeTeam: moodHomeTeam,
      awayTeam: moodAwayTeam,
      homeScore: 0,
      awayScore: 0,
      minute: 0,
      isFinished: false,
      events: [{ minute: 0, type: 'commentary', description: '¡Empieza el partido!' }],
      matchSpeed: speed,
      homeSentOff: [],
      awaySentOff: [],
      homeYellows: [],
      awayYellows: [],
      homePossession: 0,
      awayPossession: 0,
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homeFouls: 0,
      awayFouls: 0,
      homeBoost: 1 + ((0.05 + Math.random() * 0.15) * engineSettings.homeAdvantageMult),
      homeStamina: Object.fromEntries(homeTeam.players.map(p => [p.id, p.stamina ?? 99])),
      awayStamina: Object.fromEntries(awayTeam.players.map(p => [p.id, p.stamina ?? 99])),
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      homeInjuredInMatch: [],
      awayInjuredInMatch: [],
      homeStartingLineup: [...homeTeam.lineup],
      awayStartingLineup: [...awayTeam.lineup],
      stoppageTime1: 0,
      stoppageTime2: 0,
      attendance: computeAttendance(homeTeam, awayTeam),
    };

    setHtPaused(false);
    setShowSubPanel(false);

    if (matchDuration === 0) {
      let m = initialMatch;
      while (!m.isFinished) m = simulateMinute(m, league.userTeamId);
      finalizeMatch(m);
      return;
    }

    setMatch(initialMatch);
    setShowPreview(false);
    setIsPlaying(true);
  };

  const samplePoisson = (lambda: number): number => {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  };

  const simulateOtherMatches = (startingLeague: LeagueState, userTeamId: string | null): LeagueState => {
    let newLeague = startingLeague;
    currentJornadaData?.matches.forEach(m => {
      if (m.homeId === userTeamId || m.awayId === userTeamId) return;
      const hTeam = applyMoodToTeam(league.teams.find(t => t.id === m.homeId)!);
      const aTeam = applyMoodToTeam(league.teams.find(t => t.id === m.awayId)!);
      const homeBoost = 1 + ((0.05 + Math.random() * 0.15) * engineSettings.homeAdvantageMult);
      const hStr = calculateTeamStrength(hTeam) * homeBoost;
      const aStr = calculateTeamStrength(aTeam);

      const hCanPlay = hTeam.players.length >= 8;
      const aCanPlay = aTeam.players.length >= 8;
      let hScore: number, aScore: number;
      if (!hCanPlay && !aCanPlay) { hScore = 0; aScore = 0; }
      else if (!hCanPlay) { hScore = 0; aScore = 3; }
      else if (!aCanPlay) { hScore = 3; aScore = 0; }
      else {
      // Goles esperados basados en el ratio de fuerza (amplificado) — el más fuerte marca más en promedio.
      const ratio = hStr / Math.max(aStr, 1);
      const hLambda = 1.3 * Math.pow(ratio, 1.5);
      const aLambda = 1.0 * Math.pow(1 / ratio, 1.5);
      hScore = samplePoisson(hLambda);
      aScore = samplePoisson(aLambda);
      }

      const simulatedEvents: MatchEvent[] = [];
      const randMinute = () => Math.floor(Math.random() * 90) + 1;
      const addEvents = (team: Team, score: number) => {
        const lineup = team.players.filter(p => team.lineup.includes(p.id));
        for(let i=0; i<score; i++) {
          const scorer = lineup[Math.floor(Math.random() * lineup.length)];
          const minute = randMinute();
          simulatedEvents.push({ minute, type: 'goal', playerId: scorer.id });
          if(Math.random() < 0.7) {
            const asst = lineup.filter(p => p.id !== scorer.id)[Math.floor(Math.random() * (lineup.length-1))];
            if(asst) simulatedEvents.push({ minute, type: 'commentary', description: '', assistantId: asst.id, playerId: scorer.id });
          }
        }
        if(Math.random() < 0.3) {
          const p = lineup[Math.floor(Math.random() * lineup.length)];
          simulatedEvents.push({ minute: randMinute(), type: Math.random() < 0.9 ? 'yellow' : 'red', playerId: p.id });
        }
      };
      addEvents(hTeam, hScore);
      addEvents(aTeam, aScore);

      newLeague = updateLeagueStats(newLeague, m.homeId, m.awayId, hScore, aScore, simulatedEvents);
      newLeague = decayTeamStaminaAfterMatch(newLeague, m.homeId);
      newLeague = decayTeamStaminaAfterMatch(newLeague, m.awayId);
    });
    return newLeague;
  };

  const advanceAfterJornada = (newLeague: LeagueState) => {
    const playedJornada = newLeague.currentJornada;
    // Clear emergency signing flag from previous window close
    newLeague = { ...newLeague, transferWindowEmergency: false };
    newLeague = decrementSuspensions(newLeague);
    newLeague = decrementInjuries(newLeague);
    // Remove unavailable players from lineups so empty slots appear in pre-match preview
    newLeague = {
      ...newLeague,
      teams: newLeague.teams.map(t => ({
        ...t,
        lineup: t.lineup.map(id => {
          if (!id) return id;
          const p = t.players.find(pl => pl.id === id);
          if (!p) return id;
          return (p.injuryWeeksRemaining ?? 0) > 0 || p.suspensionMatches > 0 ? '' : id;
        }),
      })),
    };
    newLeague = applyStaminaRecovery(newLeague);
    newLeague = deductWeeklySalaries(newLeague);
    // Florentinometro: weekly financial delta
    if (newLeague.gameMode === 'promanager' && !newLeague.boardFired) {
      const teamFinances = newLeague.finances[newLeague.userTeamId];
      const weeks = teamFinances?.weeks;
      const lastWeek = weeks?.[weeks.length - 1];
      if (lastWeek) {
        const net = (lastWeek.income ?? 0) - (lastWeek.salaries ?? 0);
        const weekDelta = net >= 0 ? engineSettings.meterWeeklyPositive : engineSettings.meterWeeklyNegative;
        const newMeter = applyMeterDelta(newLeague.florentinometro ?? 5, weekDelta);
        newLeague = {
          ...newLeague,
          florentinometro: newMeter,
          florentinometroPeak: Math.max(newLeague.florentinometroPeak ?? 5, newMeter),
          florentinometroMin: Math.min(newLeague.florentinometroMin ?? 5, newMeter),
        };
      }
    }
    newLeague = autoListAiPlayers(newLeague);
    newLeague = simulateAiMarketSignings(newLeague);
    newLeague = simulateAiTrades(newLeague);
    newLeague = simulateAiFreeAgentSignings(newLeague);
    const afterInter = simulateAiInterClausulazos(newLeague);
    const afterClausulazo = simulateAiClausulazos(afterInter);
    const clausulazoNews = afterClausulazo.aiClausulazoNews ?? [];
    const clausulazoWasLastDay = windowJornadasLeft(playedJornada, newLeague.schedule.length) === 1;
    newLeague = { ...afterClausulazo, aiClausulazoNews: [] };
    if (clausulazoNews.length > 0) {
      const n = clausulazoNews[0];
      if (clausulazoWasLastDay) {
        newLeague = { ...newLeague, transferWindowEmergency: true };
      }
      const emergencySuffix = clausulazoWasLastDay
        ? ` ${t('transfer.emergencyWindow')}`
        : winLeft > 1 ? ` ${t('transfer.windowOpenLeft', { n: String(winLeft - 1) })}` : '';
      setTimeout(() => setMessage({
        title: t('ai.clausulazoTitle'),
        body: t('ai.clausulazoBody', { player: `${n.playerName} (${n.playerMedia})`, team: n.teamName, amount: formatEuros(n.amount) }) + emergencySuffix,
        tone: 'danger',
      }), 100);
    }
    newLeague = repickAiFormations(newLeague);
    newLeague = generateIncomingOffers(newLeague);
    const allMatchesPlayed = newLeague.schedule.every(j => j.matches.every(m => m.played));
    if (allMatchesPlayed) {
      newLeague.seasonFinished = true;
    } else if (newLeague.currentJornada < newLeague.schedule.length) {
      newLeague.currentJornada++;
    }
    // Florentinometro: firing check (only mid-season, after grace period)
    const GRACE_JORNADAS = 5;
    const FIRE_THRESHOLD = 4;
    const jornadasManaged = newLeague.currentJornada - (newLeague.managerStartJornada ?? 1);
    if (newLeague.gameMode === 'promanager' && !newLeague.boardFired && !newLeague.seasonFinished) {
      if (jornadasManaged >= GRACE_JORNADAS) {
        const chance = firingChance(newLeague.florentinometro ?? 5);
        if (chance > 0 && Math.random() < chance) {
          const warnings = (newLeague.boardWarnings ?? 0) + 1;
          if (warnings >= FIRE_THRESHOLD) {
            const firedTeams = Array.from(new Set([...(newLeague.firedByTeamIds ?? []), newLeague.userTeamId]));
            newLeague = { ...newLeague, boardFired: true, boardWarnings: warnings, seasonFinished: true, firedByTeamIds: firedTeams };
            const firedIdx = Math.floor(Math.random() * 4);
            const firedMsg = { title: t('florentino.fired'), body: t(`florentino.firedBody.${firedIdx}`), tone: 'danger' as const };
            setTimeout(() => { setBoardAlert(firedMsg); setLastBoardAlert(firedMsg); }, 100);
            // Skip the jornada-results step when fired — go straight to the
            // season summary + Pro Manager end view together.
            setTimeout(() => setView('END_OF_SEASON'), 200);
          } else {
            newLeague = { ...newLeague, boardWarnings: warnings };
            const isLastWarning = warnings === FIRE_THRESHOLD - 1;
            const isFirst = warnings === 1;
            const warnTitle = isLastWarning ? t('florentino.warning2') : t('florentino.warning');
            const warnBody = isLastWarning
              ? t(`florentino.warning2Body.${Math.floor(Math.random() * 3)}`)
              : t(`florentino.warningBody.${Math.floor(Math.random() * (isFirst ? 7 : 4))}`);
            const warnMsg = { title: warnTitle, body: warnBody, tone: 'warning' as const };
            setTimeout(() => { setBoardAlert(warnMsg); setLastBoardAlert(warnMsg); }, 100);
          }
        }
      }
      // Warning reduction: meter in safe zone forgives 1 warning per jornada
      const meter = newLeague.florentinometro ?? 5;
      const currentWarnings = newLeague.boardWarnings ?? 0;
      if (meter >= 5 && currentWarnings > 0 && !newLeague.boardFired) {
        newLeague = { ...newLeague, boardWarnings: currentWarnings - 1 };
      }
    }
    // Florentinometro: positive threshold rewards (only mid-season)
    if (newLeague.gameMode === 'promanager' && !newLeague.boardFired && !newLeague.seasonFinished) {
      const meter = newLeague.florentinometro ?? 5;
      const threshold = newLeague.boardRewardThreshold ?? 0;
      // Layered reset: dropping below a band allows that band's reward to trigger again on re-climb
      if (meter < 6 && threshold > 0) {
        newLeague = { ...newLeague, boardRewardThreshold: 0 };
      } else if (meter < 7 && threshold > 6) {
        newLeague = { ...newLeague, boardRewardThreshold: 6 };
      } else if (meter >= 9 && threshold < 9) {
        const BONUS = 2_000_000;
        newLeague = {
          ...newLeague,
          boardRewardThreshold: 9,
          teams: newLeague.teams.map(t =>
            t.id === newLeague.userTeamId
              ? { ...t, budget: t.budget + BONUS, players: t.players.map(p => ({ ...p, stamina: Math.min(99, (p.stamina ?? 99) + 10) })) }
              : t
          ),
        };
        const marbellaIdx = Math.floor(Math.random() * 3);
        const marbellaMsg = { title: t('florentino.excellent'), body: t(`florentino.marbellaBody.${marbellaIdx}`), tone: 'success' as const };
        setTimeout(() => { setBoardAlert(marbellaMsg); setLastBoardAlert(marbellaMsg); }, 100);
      } else if (meter >= 7 && threshold < 7) {
        newLeague = { ...newLeague, boardRewardThreshold: 7 };
        const praiseIdx = Math.floor(Math.random() * 4);
        const praiseMsg = { title: t('florentino.praise'), body: t(`florentino.praiseBody.${praiseIdx}`), tone: 'success' as const };
        setTimeout(() => { setBoardAlert(praiseMsg); setLastBoardAlert(praiseMsg); }, 100);
      } else if (meter >= 6 && threshold < 6) {
        newLeague = { ...newLeague, boardRewardThreshold: 6 };
        const okIdx = Math.floor(Math.random() * 5);
        const okMsg = { title: t('florentino.ok'), body: t(`florentino.okBody.${okIdx}`), tone: 'success' as const };
        setTimeout(() => { setBoardAlert(okMsg); setLastBoardAlert(okMsg); }, 100);
      }
    }
    newLeague.lastPlayedJornada = playedJornada;
    setLeague(newLeague);
    setMatch(null);
    setIsPlaying(false);
    setView('JORNADA_RESULTS');
  };

  // Live-play a tournament tie: build a MatchState from the tie's teams and
  // hand off to the existing match loop. The tournamentMatchCtx flag tells
  // finalizeMatch which post-match path to take.
  // Live-play whatever match the user has next in the tournament: a liga
  // group match, or a single leg of their KO tie. In spectator mode (no
  // user team) this falls back to the next unplayed match of the stage.
  const startTournamentMatch = () => {
    if (!tournament) return;
    const action = userNextAction(tournament) ?? spectatorNextMatch(tournament);
    if (!action) return;
    const home = tournament.teams.find(t => t.id === action.homeTeamId);
    const away = tournament.teams.find(t => t.id === action.awayTeamId);
    if (!home || !away) return;
    const speed = (matchDuration * 1000) / 90;
    const initialMatch: MatchState = {
      homeTeam: home,
      awayTeam: away,
      homeScore: 0, awayScore: 0, minute: 0, isFinished: false,
      events: [{ minute: 0, type: 'commentary', description: '¡Empieza el partido!' }],
      matchSpeed: speed,
      homeSentOff: [], awaySentOff: [], homeYellows: [], awayYellows: [],
      homePossession: 0, awayPossession: 0,
      homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0,
      homeFouls: 0, awayFouls: 0,
      homeBoost: 1 + ((0.05 + Math.random() * 0.15) * engineSettings.homeAdvantageMult),
      homeStamina: Object.fromEntries(home.players.map(p => [p.id, p.stamina ?? 99])),
      awayStamina: Object.fromEntries(away.players.map(p => [p.id, p.stamina ?? 99])),
      homeSubsUsed: 0, awaySubsUsed: 0,
      homeInjuredInMatch: [], awayInjuredInMatch: [],
      homeStartingLineup: [...home.lineup], awayStartingLineup: [...away.lineup],
      stoppageTime1: 0, stoppageTime2: 0,
      attendance: computeAttendance(home, away),
    };
    setTournamentMatchCtx(action);
    setHtPaused(false);
    setShowSubPanel(false);
    if (matchDuration === 0) {
      let m = initialMatch;
      while (!m.isFinished) m = simulateMinute(m, tournament.userTeamId ?? '');
      finalizeMatch(m);
      return;
    }
    setMatch(initialMatch);
    setShowPreview(false);
    setIsPlaying(true);
  };

  const finalizeMatch = (finalMatch: MatchState) => {
    // Tournament context: skip league writebacks. Update the tie with the
    // score, decide a winner (PK shootout when level), then auto-sim the
    // remaining ties of the round via advanceRound.
    if (tournamentMatchCtx && tournament) {
      const hs = finalMatch.homeScore;
      const as = finalMatch.awayScore;
      const prevStageIdx = tournament.currentStageIdx;
      setTournament(prev => {
        if (!prev) return prev;
        const updated = tournamentMatchCtx.type === 'liga'
          ? recordUserLigaMatch(prev, tournamentMatchCtx.groupId, tournamentMatchCtx.matchIdx, hs, as)
          : recordUserKoLeg(prev, tournamentMatchCtx.tieId, tournamentMatchCtx.legIdx, hs, as);
        // Show the stage recap modal only when the stage actually closed,
        // not after every single match.
        if (updated.currentStageIdx !== prev.currentStageIdx || updated.champion) {
          setTournamentRoundRecap(prevStageIdx);
        }
        return updated;
      });
      setTournamentMatchCtx(null);
      setMatch(null);
      setIsPlaying(false);
      setHtPaused(false);
      setShowSubPanel(false);
      return;
    }

    const tvBonus = computeTvBonus(league.stats, finalMatch.homeTeam.id, finalMatch.awayTeam.id);
    let newLeague = writebackMatchStamina(
      league,
      finalMatch.homeTeam.id,
      finalMatch.awayTeam.id,
      finalMatch.homeStamina,
      finalMatch.awayStamina,
      finalMatch.homeInjuredInMatch,
      finalMatch.awayInjuredInMatch,
    );
    newLeague = updateLeagueStats(
      newLeague,
      finalMatch.homeTeam.id,
      finalMatch.awayTeam.id,
      finalMatch.homeScore,
      finalMatch.awayScore,
      finalMatch.events,
      finalMatch.homeStartingLineup,
      finalMatch.awayStartingLineup,
      finalMatch.stoppageTime1 ?? 0,
      finalMatch.stoppageTime2 ?? 0,
    );
    newLeague = applyTvBonus(newLeague, league.userTeamId, tvBonus);
    // Florentinometro + reputation: context-aware match delta
    if (newLeague.gameMode === 'promanager' && !newLeague.boardFired) {
      const userIsHome = finalMatch.homeTeam.id === newLeague.userTeamId;
      const userTeamObj = userIsHome ? finalMatch.homeTeam : finalMatch.awayTeam;
      const oppTeamObj  = userIsHome ? finalMatch.awayTeam : finalMatch.homeTeam;
      const userGoals = userIsHome ? finalMatch.homeScore : finalMatch.awayScore;
      const oppGoals  = userIsHome ? finalMatch.awayScore : finalMatch.homeScore;
      const isWin = userGoals > oppGoals;
      const isDraw = userGoals === oppGoals;
      const userAvgMedia = userTeamObj.players.length > 0
        ? userTeamObj.players.reduce((s, p) => s + p.media, 0) / userTeamObj.players.length : 50;
      const oppAvgMedia = oppTeamObj.players.length > 0
        ? oppTeamObj.players.reduce((s, p) => s + p.media, 0) / oppTeamObj.players.length : 50;
      const yellowCards = finalMatch.events.filter(e => e.type === 'yellow' && e.teamId === newLeague.userTeamId).length;
      const redCards = finalMatch.events.filter(e => e.type === 'red' && e.teamId === newLeague.userTeamId).length;

      const meterDelta = computeMatchMeterDelta({ userGoals, oppGoals, isHome: userIsHome, userAvgMedia, oppAvgMedia, yellowCards, redCards });
      const repDelta = computeMatchReputationDelta({ userGoals, oppGoals, isHome: userIsHome, userAvgMedia, oppAvgMedia });
      const newMeter = applyMeterDelta(newLeague.florentinometro ?? 5, meterDelta);
      const newRep = Math.max(0, Math.min(100, (newLeague.managerReputation ?? 50) + repDelta));
      newLeague = {
        ...newLeague,
        florentinometro: newMeter,
        florentinometroPeak: Math.max(newLeague.florentinometroPeak ?? 5, newMeter),
        florentinometroMin: Math.min(newLeague.florentinometroMin ?? 5, newMeter),
        managerReputation: newRep,
        managerWins: (newLeague.managerWins ?? 0) + (isWin ? 1 : 0),
        managerDraws: (newLeague.managerDraws ?? 0) + (isDraw ? 1 : 0),
        managerLosses: (newLeague.managerLosses ?? 0) + (!isWin && !isDraw ? 1 : 0),
      };
    }
    newLeague = simulateOtherMatches(newLeague, league.userTeamId);
    advanceAfterJornada(newLeague);
  };

  const handleMatchEnd = () => {
    if (match) finalizeMatch(match);
  };

  const handleByeRound = () => {
    const newLeague = simulateOtherMatches(league, league.userTeamId);
    advanceAfterJornada(newLeague);
  };

  const applySeasonReputationDelta = (prev: LeagueState, fired: boolean): number => {
    const userTeam = prev.teams.find(t => t.id === prev.userTeamId);
    const currentSquadValue = userTeam
      ? userTeam.budget + userTeam.players.reduce((s, p) => s + computePrice(p, prev.year), 0)
      : 0;
    const initialSquadValue = prev.managerInitialSquadValue ?? currentSquadValue;
    const squadValueChangePct = initialSquadValue > 0 ? (currentSquadValue - initialSquadValue) / initialSquadValue : 0;
    const sortedStats = Object.values(prev.stats).sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    const userRank = sortedStats.findIndex(s => s.teamId === prev.userTeamId) + 1;
    const totalTeams = sortedStats.length;
    const objective = prev.boardObjective ?? 'avoid_relegation';
    const objectiveMet = isObjectiveMet(objective, userRank, totalTeams);
    const delta = computeSeasonReputationDelta({ objective, objectiveMet, fired, squadValueChangePct });
    return Math.max(0, Math.min(100, (prev.managerReputation ?? 50) + delta));
  };

  const applySeasonMeterDelta = (prev: LeagueState): number => {
    if (prev.boardFired) return prev.florentinometro ?? 5;
    const sortedStats = Object.values(prev.stats).sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    const userRank = sortedStats.findIndex(s => s.teamId === prev.userTeamId) + 1;
    const totalTeams = sortedStats.length;
    const objective = prev.boardObjective ?? 'avoid_relegation';
    const objectiveMet = isObjectiveMet(objective, userRank, totalTeams);
    return applyMeterDelta(prev.florentinometro ?? 5, computeSeasonMeterDelta(objectiveMet));
  };

  const handleAdvanceSameTeam = () => {
    setLeague(prev => {
      if (prev.gameMode === 'promanager') {
        const fired = prev.boardFired ?? false;
        const newMeter = applySeasonMeterDelta(prev);
        const prevWithMeter = { ...prev, florentinometro: newMeter };
        const newRep = applySeasonReputationDelta(prevWithMeter, fired);
        const prevWithAll = { ...prevWithMeter, managerReputation: newRep };
        const record = buildSeasonCareerRecord(prevWithAll, fired);
        const next = advanceSeason({ ...prevWithAll, managerCareer: [...(prev.managerCareer ?? []), record] });
        const userTeam = next.teams.find(t => t.id === prev.userTeamId);
        const objective = userTeam ? computeBoardObjective(userTeam, next.teams) : 'avoid_relegation' as const;
        const initialSquadValue = userTeam
          ? userTeam.budget + userTeam.players.reduce((s, p) => s + computePrice(p, next.year), 0)
          : 0;
        return { ...next, boardObjective: objective, managerReputation: newRep, managerInitialSquadValue: initialSquadValue };
      }
      return advanceSeason(prev);
    });
    setView('LEAGUE');
  };

  const handleAdvanceChangeTeam = () => {
    setLeague(prev => {
      if (prev.gameMode === 'promanager') {
        const fired = prev.boardFired ?? false;
        const newMeter = applySeasonMeterDelta(prev);
        const prevWithMeter = { ...prev, florentinometro: newMeter };
        const newRep = applySeasonReputationDelta(prevWithMeter, fired);
        const prevWithAll = { ...prevWithMeter, managerReputation: newRep };
        const record = buildSeasonCareerRecord(prevWithAll, fired);
        const advanced = advanceSeason({ ...prevWithAll, managerCareer: [...(prev.managerCareer ?? []), record] });
        setSelectedYear(advanced.year);
        return { ...advanced, userTeamId: '', isStarted: false, managerReputation: newRep };
      }
      const advanced = advanceSeason(prev);
      setSelectedYear(advanced.year);
      return { ...advanced, userTeamId: '', isStarted: false };
    });
    setView('LEAGUE');
  };

  const handleProManagerPickTeam = (teamId: string) => {
    setLeague(prev => {
      const allMatchesPlayed = prev.schedule.every(j => j.matches.every(m => m.played));
      const record = buildSeasonCareerRecord(prev, prev.boardFired ?? false);
      const updatedCareer = [...(prev.managerCareer ?? []), record];

      if (allMatchesPlayed) {
        // True season end — advance to next year
        const next = advanceSeason({ ...prev, managerCareer: updatedCareer });
        const team = next.teams.find(t => t.id === teamId);
        const objective = team ? computeBoardObjective(team, next.teams) : 'avoid_relegation' as const;
        const initialSquadValue = team
          ? team.budget + team.players.reduce((s, p) => s + computePrice(p, next.year), 0)
          : 0;
        return {
          ...next,
          userTeamId: teamId,
          isStarted: true,
          gameMode: 'promanager' as const,
          managerName: prev.managerName ?? '',
          boardObjective: objective,
          florentinometro: 5,
          florentinometroPeak: 5,
          florentinometroMin: 5,
          seasonTransferSpent: 0,
          seasonTransferEarned: 0,
          managerStartJornada: 1,
          managerWins: 0,
          managerDraws: 0,
          managerLosses: 0,
          managerReputation: prev.managerReputation ?? 50,
          managerInitialSquadValue: initialSquadValue,
        };
      } else {
        // Mid-season fire — continue current season with new team
        const team = prev.teams.find(t => t.id === teamId);
        const objective = team ? computeBoardObjective(team, prev.teams) : 'avoid_relegation' as const;
        const initialSquadValue = team
          ? team.budget + team.players.reduce((s, p) => s + computePrice(p, prev.year), 0)
          : 0;
        return {
          ...prev,
          userTeamId: teamId,
          boardFired: false,
          boardWarnings: 0,
          seasonFinished: false,
          boardObjective: objective,
          florentinometro: 5,
          florentinometroPeak: 5,
          florentinometroMin: 5,
          managerCareer: updatedCareer,
          managerStartJornada: prev.currentJornada,
          managerWins: 0,
          managerDraws: 0,
          managerLosses: 0,
          managerReputation: prev.managerReputation ?? 50,
          managerInitialSquadValue: initialSquadValue,
        };
      }
    });
    setView('LEAGUE');
  };

  const handleProManagerRetire = () => {
    setLeague(prev => {
      const record = buildSeasonCareerRecord(prev, prev.boardFired ?? false);
      return {
        ...prev,
        managerCareer: [...(prev.managerCareer ?? []), record],
        isStarted: false,
        userTeamId: '',
      };
    });
    setView('MANAGER_CAREER');
  };

  const handleRenameManager = (name: string) => {
    setLeague(prev => ({ ...prev, managerName: name.trim() || prev.managerName }));
  };

  const handleImportCareer = (data: { managerName?: string; managerCareer?: ManagerSeasonRecord[]; managerReputation?: number }) => {
    setLeague(prev => ({
      ...prev,
      ...(data.managerName ? { managerName: data.managerName } : {}),
      ...(data.managerCareer ? { managerCareer: data.managerCareer } : {}),
      ...(data.managerReputation !== undefined ? { managerReputation: data.managerReputation } : {}),
    }));
  };

  const handleResetGame = () => {
    localStorage.removeItem('openfutbol_league');
    localStorage.removeItem('openfutbol_welcomed');
    window.location.reload();
  };

  const handleFantasyDraftComplete = (teamPicks: Record<string, import('./types/game.d.ts').Player[]>) => {
    const config = fantasyConfig!;
    const allPool = getFantasyPool(fantasyYear);
    const dbTeamIds = new Set(getTeamTemplatesForYear(fantasyYear).map(t => t.id));
    const teams = config.teamIds.map(id => {
      const picks = teamPicks[id] ?? [];
      const editorTeam = league.teams.find(t => t.id === id && !dbTeamIds.has(id));
      return buildFantasyTeam(id, fantasyYear, picks, editorTeam);
    });
    let started = { ...getFantasyLeagueState(fantasyYear, teams, allPool), userTeamId: config.userTeamId, isStarted: true };
    for (let i = 0; i < 4; i++) started = autoListAiPlayers(started);
    started = repickAiFormations(started);
    setLeague(started);
    setShowFantasyFlow(false);
    setFantasyConfig(null);
    setFantasyYear(0);
    setView('LEAGUE');
  };

  // Resolve the "active user team id" for the match loop — tournament context
  // wins when present, otherwise the league user. Tournaments allow spectator
  // mode, so this is nullable; downstream consumers coalesce to '' when an
  // empty string suffices (no team highlighted, no AI bias).
  const activeUserTeamId: string | null = tournamentMatchCtx && tournament ? tournament.userTeamId : league.userTeamId;
  const activeUserTeamIdSafe = activeUserTeamId ?? '';

  useEffect(() => {
    let interval: number;
    if (isPlaying && match && !match.isFinished && !isCelebrating) {
      interval = window.setInterval(() => {
        setMatch(prev => prev ? simulateMinute(prev, activeUserTeamIdSafe) : null);
      }, match.matchSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, match, isCelebrating, activeUserTeamId]);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [match?.events]);

  // Ambiance: loops in the background while a live match is in progress.
  // Volume scales with the home stadium capacity (bigger venue → louder crowd).
  // When the match ends we fade out instead of cutting; when the user leaves
  // the match (match becomes null) we stop immediately.
  useEffect(() => {
    if (match && !match.isFinished) {
      if (!muted) startAmbiance(match.homeTeam?.stadiumCapacity);
    } else if (match && match.isFinished) {
      fadeOutAmbiance(2.5);
    } else {
      stopAmbiance();
    }
  }, [match?.isFinished, !!match, match?.homeTeam?.stadiumCapacity, muted]);

  // React to mute toggle without restarting ambiance.
  useEffect(() => {
    if (muted) { stopAmbiance(); }
    else if (match && !match.isFinished) { startAmbiance(match.homeTeam?.stadiumCapacity); }
    setAmbianceMuted(muted);
  }, [muted]);

  // Watch match events for new goals, missed chances, fouls / cards, halftime
  // and full-time so we can fire the right sound effect.
  // - Home-team goals get the crowd celebration (pauses the tick loop)
  // - Away-team goals only get the basic goal sound
  // - Cards (yellow/red) trigger a foul whistle
  // - Halftime fires the whistle once when htPaused flips true
  // - Full-time fires the end whistle and the ambiance fade-out runs in parallel
  const lastGoalCountRef = useRef<number>(0);
  const lastShotCountRef = useRef<number>(0);
  const lastCardCountRef = useRef<number>(0);
  const lastPenaltyCountRef = useRef<number>(0);
  const lastHtPausedRef = useRef<boolean>(false);
  const lastFinishedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!match) {
      lastGoalCountRef.current = 0;
      lastShotCountRef.current = 0;
      lastCardCountRef.current = 0;
      lastPenaltyCountRef.current = 0;
      lastHtPausedRef.current = false;
      lastFinishedRef.current = false;
      return;
    }
    const events = match.events;
    const goals = events.filter(e => e.type === 'goal');
    const shots = events.filter(e => e.type === 'shot');
    const cards = events.filter(e => e.type === 'yellow' || e.type === 'red');
    const penalties = events.filter(e => e.type === 'penalty');

    // Penalty pause: whistle now, then 1.5s of dramatic silence before the
    // next tick (which resolves the kick). Reuses the same celebration flag
    // so the match loop stays frozen during the wait.
    if (penalties.length > lastPenaltyCountRef.current) {
      lastPenaltyCountRef.current = penalties.length;
      setIsCelebrating(true);
      playWhistle();
      const t = setTimeout(() => setIsCelebrating(false), 1500);
      // Best-effort cleanup if the match is torn down mid-pause.
      return () => clearTimeout(t);
    }

    if (goals.length > lastGoalCountRef.current) {
      const newest = goals[goals.length - 1];
      lastGoalCountRef.current = goals.length;
      // Always pause the tick loop until the goal sound has been heard. Home
      // team gets the full crowd celebration; away team only gets the basic
      // signal but the clock still freezes for the duration of that signal.
      setIsCelebrating(true);
      const goalSequence = newest.teamId === match.homeTeam.id
        ? playGoalWithCelebration()
        : playGoalSignal();
      goalSequence.finally(() => setIsCelebrating(false));
    }

    if (shots.length > lastShotCountRef.current) {
      lastShotCountRef.current = shots.length;
      playMissed();
    }

    if (cards.length > lastCardCountRef.current) {
      lastCardCountRef.current = cards.length;
      playWhistle();
    }

    if (htPaused && !lastHtPausedRef.current) {
      playWhistle();
    }
    lastHtPausedRef.current = htPaused;

    if (match.isFinished && !lastFinishedRef.current) {
      playWhistleEnd();
    }
    lastFinishedRef.current = match.isFinished;
  }, [match?.events.length, match, htPaused]);

  // Auto-pause at halftime for user subs
  useEffect(() => {
    if (match && match.minute >= 45 + (match.stoppageTime1 ?? 0) && match.minute < 90 && isPlaying && !htPaused && matchDuration > 0) {
      setIsPlaying(false);
      setHtPaused(true);
      setShowSubPanel(true);
      setMatch(prev => prev ? applyAiHtSubs(prev, activeUserTeamIdSafe) : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.minute]);

  const applyAiHtSubs = (m: MatchState, userTeamId: string): MatchState => {
    let next = m;
    for (const isHome of [true, false] as const) {
      const team = isHome ? next.homeTeam : next.awayTeam;
      if (team.id === userTeamId) continue;
      const subsUsed = isHome ? next.homeSubsUsed : next.awaySubsUsed;
      const sentOff = isHome ? next.homeSentOff : next.awaySentOff;
      const injured = isHome ? next.homeInjuredInMatch : next.awayInjuredInMatch;
      const stamMap = isHome ? next.homeStamina : next.awayStamina;
      const ownScore = isHome ? next.homeScore : next.awayScore;
      const oppScore = isHome ? next.awayScore : next.homeScore;
      const scoreDiff = ownScore - oppScore;

      // Threshold scales with match state:
      // - Losing or drawing → only sub really exhausted players (<60 stam) and don't bench stars
      // - Winning by 1 → mild rotation (<70 stam)
      // - Winning by 2+ → comfortable lead, rest stars more aggressively (<80 stam)
      // - Behind by 3+ → emergency, push fresh legs even at <85 stam (try to chase the game)
      const stamThreshold =
        scoreDiff >= 2 ? 80 :
        scoreDiff >= 1 ? 70 :
        scoreDiff <= -3 ? 85 :
        60;
      // When winning comfortably, allow swapping in slightly weaker subs to rest stars.
      // When losing, refuse to swap in significantly weaker players.
      const mediaTolerance =
        scoreDiff >= 2 ? 12 :
        scoreDiff >= 1 ? 8 :
        scoreDiff <= -3 ? 10 :
        5;

      const inLineup = new Set(team.lineup);
      const starters = team.lineup
        .filter(pid => !sentOff.includes(pid) && !injured.includes(pid))
        .map(pid => {
          const p = team.players.find(x => x.id === pid);
          return { pid, stam: stamMap[pid] ?? 99, media: p?.media ?? 0 };
        })
        .filter(s => s.stam < stamThreshold)
        .sort((a, b) => a.stam - b.stam);

      const bench = team.players
        .filter(p => !inLineup.has(p.id) && !injured.includes(p.id) && !sentOff.includes(p.id) && (p.injuryWeeksRemaining ?? 0) === 0 && p.suspensionMatches === 0)
        .map(p => ({ p, stam: stamMap[p.id] ?? (p.stamina ?? 99) }))
        .filter(b => b.stam > 85)
        .sort((a, b) => b.p.media - a.p.media);

      const toMake = Math.min(3 - subsUsed, starters.length, bench.length);
      let newLineup = [...team.lineup];
      let newSubsUsed = subsUsed;
      const newStamMap = { ...stamMap };

      for (let i = 0; i < toMake; i++) {
        // Refuse to sub a clearly better starter for a weaker bench player —
        // unless the team is comfortably winning and the swap rests a star.
        if (bench[i].p.media < starters[i].media - mediaTolerance) continue;
        // Never bench a star (CA-equivalent media ≥ 80) unless they're truly gassed (<50 stam).
        if (starters[i].media >= 80 && starters[i].stam >= 50) continue;

        newLineup = newLineup.map(id => id === starters[i].pid ? bench[i].p.id : id);
        newStamMap[bench[i].p.id] = bench[i].stam;
        newSubsUsed++;
      }

      const newTeam = { ...team, lineup: newLineup };
      if (isHome) {
        next = { ...next, homeTeam: newTeam, homeStamina: newStamMap, homeSubsUsed: newSubsUsed };
      } else {
        next = { ...next, awayTeam: newTeam, awayStamina: newStamMap, awaySubsUsed: newSubsUsed };
      }
    }
    return next;
  };

  // Commit a batch of staged substitutions from the in-game AlignmentView.
  // stagedLineup is the new final lineup; subPairs are the (out, in) pairs
  // that count as subs (position swaps and net-zero shuffles are excluded).
  const commitUserSubs = (stagedLineup: string[], subPairs: { outId: string; inId: string }[]) => {
    if (!match) return;
    const isUserHome = match.homeTeam.id === activeUserTeamId;
    const team = isUserHome ? match.homeTeam : match.awayTeam;
    const subsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
    if (subPairs.length === 0 && stagedLineup.join(',') === team.lineup.join(',')) return;

    const stamMap = isUserHome ? { ...match.homeStamina } : { ...match.awayStamina };
    const newEvents: MatchEvent[] = [];
    for (const { outId, inId } of subPairs) {
      const pIn = team.players.find(p => p.id === inId);
      const pOut = outId ? team.players.find(p => p.id === outId) : undefined;
      if (!pIn) continue;
      stamMap[pIn.id] = pIn.stamina ?? 99;
      newEvents.push({
        minute: match.minute,
        type: 'sub',
        description: pOut
          ? `Cambio: entra ${pIn.fullName}, sale ${pOut.fullName}.`
          : `Entra ${pIn.fullName}.`,
        teamId: team.id,
        playerId: inId,
        playerOffId: outId || undefined,
      });
    }
    const newSubsUsed = subsUsed + subPairs.length;
    if (newSubsUsed > 3) return; // hard guard

    const newTeam = { ...team, lineup: stagedLineup };
    if (isUserHome) {
      setMatch(prev => prev ? {
        ...prev,
        homeTeam: newTeam,
        homeStamina: stamMap,
        homeSubsUsed: newSubsUsed,
        events: [...prev.events, ...newEvents],
      } : null);
    } else {
      setMatch(prev => prev ? {
        ...prev,
        awayTeam: newTeam,
        awayStamina: stamMap,
        awaySubsUsed: newSubsUsed,
        events: [...prev.events, ...newEvents],
      } : null);
    }
  };

  const renderMainContent = () => {
    if (packLoading) {
      return (
        <div className="w-full max-w-sm flex flex-col items-center gap-3 animate-in fade-in duration-300">
          <div className="text-vga-cyan text-[10px] uppercase tracking-widest cool:text-rc-accent">CARGANDO...</div>
        </div>
      );
    }

    if (view === 'PACK_LOADER') {
      return <PackLoaderView onBack={() => setView('BACKUP')} />;
    }

    if (view === 'PACK_EDITOR') {
      return <PackEditorView onBack={() => setView('LEAGUE')} />;
    }

    // Tournament flow: a live tournament always takes priority over league
    // setup/menu views. Setup view only when explicitly opened.
    if (tournament && !match) {
      const userTournamentTeam = tournament.userTeamId ? tournament.teams.find(t => t.id === tournament.userTeamId) : null;
      const updateTournamentUserTeam = (patch: Partial<Team>) => {
        setTournament(prev => prev ? {
          ...prev,
          teams: prev.teams.map(t => t.id === prev.userTeamId ? { ...t, ...patch } : t),
        } : prev);
      };
      if (tournamentSubView === 'ALIGNMENT' && userTournamentTeam) {
        return (
          <AlignmentView
            team={userTournamentTeam}
            onUpdate={(patch) => updateTournamentUserTeam(patch)}
            onToggleDiscipline={() => updateTournamentUserTeam({ tacticalDiscipline: !(userTournamentTeam.tacticalDiscipline ?? true) })}
            onBack={() => setTournamentSubView(null)}
          />
        );
      }
      if (tournamentSubView === 'SQUAD') {
        // Default to user's own team; if the user clicked a row in the bracket
        // we show that team instead (read-only either way).
        const teamToShow = tournamentViewingTeamId
          ? tournament.teams.find(t => t.id === tournamentViewingTeamId)
          : userTournamentTeam;
        if (teamToShow) {
          return (
            <SquadViewCompact
              team={teamToShow}
              seasonYear={new Date().getFullYear()}
              readOnly
              onToggleForSale={() => { /* no transfers in tournaments (v1) */ }}
              onBack={() => { setTournamentSubView(null); setTournamentViewingTeamId(null); }}
            />
          );
        }
      }
      if (tournamentSubView === 'STATS') {
        return (
          <div className="w-full max-w-5xl flex flex-col gap-2 animate-in fade-in duration-300">
            <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
              <h2 className="text-vga-yellow text-xs uppercase font-bold">Estadísticas del torneo</h2>
              <button onClick={() => setTournamentSubView(null)} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
                Volver
              </button>
            </div>
            <div className="bg-vga-black border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <SeasonStatsTable
                teams={tournament.teams}
                seasonYear={new Date().getFullYear()}
              />
            </div>
          </div>
        );
      }
      // Pre-match preview: lets the user check lineups, auto-fix XI, pick
      // match duration, then kicks off the live match. Spectator path goes
      // through the same preview but with the lineup controls hidden.
      if (tournamentPendingAction) {
        const home = tournament.teams.find(t => t.id === tournamentPendingAction.homeTeamId);
        const away = tournament.teams.find(t => t.id === tournamentPendingAction.awayTeamId);
        if (home && away) {
          const stage = tournament.stages[tournament.currentStageIdx];
          const ctxLabel = tournamentPendingAction.type === 'liga'
            ? `Jornada ${tournamentPendingAction.jornada} · ${stage.name}`
            : `${tournamentPendingAction.legIdx === 0 ? 'Ida' : tournamentPendingAction.legIdx === 1 ? 'Vuelta' : `Partido ${tournamentPendingAction.legIdx + 1}`} · ${stage.name}`;
          return (
            <TournamentMatchPreview
              contextLabel={ctxLabel}
              homeTeam={home}
              awayTeam={away}
              userTeamId={tournament.userTeamId}
              matchDuration={matchDuration}
              onChangeDuration={setMatchDuration}
              onAutoFixUserXI={userTournamentTeam ? () => {
                const { lineup } = pickBestXI(userTournamentTeam.players, userTournamentTeam.formation, new Set(), userTournamentTeam.tacticalDiscipline ?? true);
                updateTournamentUserTeam({ lineup });
              } : undefined}
              onAdjustLineup={userTournamentTeam ? () => setTournamentSubView('ALIGNMENT') : undefined}
              onPlay={() => {
                setTournamentPendingAction(null);
                startTournamentMatch();
              }}
              onBack={() => setTournamentPendingAction(null)}
            />
          );
        }
      }
      return (
        <BracketView
          state={tournament}
          onAdvanceStage={() => {
            const playedStageIdx = tournament.currentStageIdx;
            setTournament(prev => prev ? advanceCurrentStage(prev) : null);
            setTournamentRoundRecap(playedStageIdx);
          }}
          onPlayUserMatch={() => {
            const action = userNextAction(tournament);
            if (action) setTournamentPendingAction(action);
          }}
          onPlaySpectatorMatch={() => {
            const action = spectatorNextMatch(tournament);
            if (action) setTournamentPendingAction(action);
          }}
          onOpenAlignment={() => setTournamentSubView('ALIGNMENT')}
          onOpenSquad={() => { setTournamentViewingTeamId(null); setTournamentSubView('SQUAD'); }}
          onOpenStats={() => setTournamentSubView('STATS')}
          onTeamClick={(teamId) => { setTournamentViewingTeamId(teamId); setTournamentSubView('SQUAD'); }}
          onExit={() => {
            setTournament(null); setShowTournamentFlow(false);
            setTournamentRoundRecap(null); setTournamentSubView(null);
            setTournamentPendingAction(null); setTournamentViewingTeamId(null);
          }}
        />
      );
    }
    if (showTournamentFlow) {
      return (
        <TournamentSetupView
          onBack={() => setShowTournamentFlow(false)}
          onConfirm={(name, clubIds, userClubId, stages, transfersEnabled) => {
            if (!pack) return;
            const teams = clubIds
              .map(id => pack.clubs.find(c => c.id === id))
              .filter((c): c is NonNullable<typeof c> => Boolean(c))
              .map(c => buildTeamFromPackClub(c, pack, new Date().getFullYear()));
            if (teams.length !== clubIds.length) return;
            try {
              setTournament(createTournament(name, teams, userClubId, stages, transfersEnabled));
              setShowTournamentFlow(false);
            } catch (e) {
              setMessage({ title: 'Configuración inválida', body: (e as Error).message, tone: 'warning' });
            }
          }}
        />
      );
    }

    if (showInstructions) {
      return <InstructionsView onBack={() => { setShowInstructions(false); setInstructionsScroll(undefined); }} onColaborar={() => { setShowInstructions(false); setShowColaborar(true); }} scrollTo={instructionsScroll} />;
    }

    if (showColaborar) {
      return <ColaborarView onBack={() => setShowColaborar(false)} />;
    }

    if (view === 'EDITOR') {
      return (
        <EditorView
          league={league}
          onUpdateLeague={updater => setLeague(updater)}
          onBack={() => {
            if (returnToFantasy) { setReturnToFantasy(false); setView('LEAGUE'); }
            else setView('LEAGUE');
          }}
        />
      );
    }

    if (view === 'BACKUP' && !league.isStarted) {
      return (
        <BackupView
          league={league}
          onRestore={(newState) => { setLeague(newState); setView('LEAGUE'); }}
          onReset={() => { setLeague(getInitialLeagueState()); setView('LEAGUE'); }}
          onBack={() => setView('LEAGUE')}
          onOpenPack={() => setView('PACK_LOADER')}
        />
      );
    }

    if (showFantasyFlow && !fantasyConfig) {
      return (
        <FantasySetupView
          availableYears={getAvailableYears()}
          existingTeams={league.teams}
          onConfirm={(year, teamIds, userTeamId, cap) => {
            setFantasyYear(year);
            setFantasyConfig({ teamIds, userTeamId, cap });
          }}
          onBack={() => setShowFantasyFlow(false)}
          onOpenEditor={() => { setReturnToFantasy(true); setView('EDITOR'); }}
        />
      );
    }

    if (showFantasyFlow && fantasyConfig) {
      const dbTemplateIds = new Set(getTeamTemplatesForYear(fantasyYear).map(t => t.id));
      const allTeamsForDraft: Team[] = [
        ...getTeamTemplatesForYear(fantasyYear).map(tmpl => ({
          id: tmpl.id, name: tmpl.name, colors: tmpl.colors,
          year: fantasyYear, manager: '', stadiumName: '', stadiumCapacity: 0,
          ticketPrice: 0, budget: 0, players: [], lineup: [],
          formation: '4-4-2' as FormationId, tacticalDiscipline: false,
        })),
        ...league.teams.filter(t => !dbTemplateIds.has(t.id)),
      ];
      return (
        <FantasyDraftView
          year={fantasyYear}
          teamIds={fantasyConfig.teamIds}
          userTeamId={fantasyConfig.userTeamId}
          cap={fantasyConfig.cap}
          allTeams={allTeamsForDraft}
          pool={getFantasyPool(fantasyYear)}
          onComplete={handleFantasyDraftComplete}
          onBack={() => setFantasyConfig(null)}
        />
      );
    }

    if (view === 'MANAGER_CAREER') {
      const sortedForLive = Object.values(league.stats).sort((a, b) =>
        b.points !== a.points ? b.points - a.points : (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
      );
      const livePos = sortedForLive.findIndex(s => s.teamId === league.userTeamId) + 1;
      const liveTeam = league.teams.find(t => t.id === league.userTeamId);
      const liveSnap = league.isStarted && league.gameMode === 'promanager' && liveTeam ? {
        year: league.year,
        teamName: liveTeam.name,
        teamId: liveTeam.id,
        finalPosition: livePos || 1,
        totalTeams: sortedForLive.length,
        objective: league.boardObjective ?? 'avoid_relegation' as const,
        wins: league.managerWins ?? 0,
        draws: league.managerDraws ?? 0,
        losses: league.managerLosses ?? 0,
        florentinometro: league.florentinometro ?? 5,
      } : undefined;
      return (
        <ManagerCareerView
          managerName={league.managerName ?? ''}
          career={league.managerCareer ?? []}
          managerReputation={league.managerReputation}
          liveSnap={liveSnap}
          onRename={handleRenameManager}
          onBack={() => setView(league.isStarted ? 'LEAGUE' : 'LEAGUE')}
        />
      );
    }

    if (showProManagerFlow) {
      const PACK_YEAR = new Date().getFullYear();
      const proYearStats = pack
        ? [{ year: PACK_YEAR, teams: pack.clubs.length, leagues: pack.leagues.length, players: pack.players.length }]
        : getAvailableYearsWithStats();

      // After year is picked, route through the same team-selection view used by Liga
      // mode. Once teams are confirmed, ProManagerSetupView renders the offers screen.
      if (selectedYear && !leagueSetupDone) {
        return (
          <LeagueSetupView
            year={selectedYear}
            existingTeams={league.teams}
            onConfirm={handleLeagueSetupConfirm}
            onBack={() => handleProManagerSelectYear(0)}
          />
        );
      }

      return (
        <ProManagerSetupView
          teams={league.teams}
          managerName={league.managerName ?? ''}
          managerCareer={league.managerCareer ?? []}
          managerReputation={league.managerReputation ?? 50}
          yearStats={proYearStats}
          selectedYear={selectedYear}
          onSelectYear={handleProManagerSelectYear}
          onSelectTeam={handleSelectTeamProManager}
          onImport={handleImportCareer}
          onBack={() => { setShowProManagerFlow(false); setSelectedYear(null); setLeagueSetupDone(false); }}
        />
      );
    }

    if (!league.isStarted) {
      const fantasyAvailable = getAvailableYears().length > 0;
      if (!showPlayFlow) {
        return (
          <div className="of-home" aria-label="Menú principal OpenFutbol">
            <div className="of-home-crt" aria-hidden="true" />
            <div className="of-home-stadium" aria-hidden="true" />

            <div className="of-home-grid">
              <button onClick={() => setShowPlayFlow(true)} className="of-mode of-mode-pink" title="Modo Liga">
                <span className="of-mode-corner of-mode-corner-tl" />
                <span className="of-mode-corner of-mode-corner-tr" />
                <span className="of-mode-corner of-mode-corner-bl" />
                <span className="of-mode-corner of-mode-corner-br" />
                <div className="of-mode-body">
                  <img className="of-mode-icon of-mode-icon-img" src="/img/play.png" alt="" />
                  <div className="of-mode-text">
                    <div className="of-mode-title">{t('btn.play')}</div>
                    <div className="of-mode-desc">Elige un año y un club, gestiona la plantilla y compite jornada a jornada en una liga completa.</div>
                  </div>
                </div>
                <div className="of-mode-cta">ENTRAR →</div>
              </button>

              <button onClick={() => setShowProManagerFlow(true)} className="of-mode of-mode-cyan" title="Carrera de entrenador">
                <span className="of-mode-corner of-mode-corner-tl" />
                <span className="of-mode-corner of-mode-corner-tr" />
                <span className="of-mode-corner of-mode-corner-bl" />
                <span className="of-mode-corner of-mode-corner-br" />
                <div className="of-mode-body">
                  <img className="of-mode-icon of-mode-icon-img" src="/img/promanager.png" alt="" />
                  <div className="of-mode-text">
                    <div className="of-mode-title">{t('btn.proManager')}</div>
                    <div className="of-mode-desc">Carrera de entrenador: ofertas, objetivos y reputación. Si no cumples, te despiden a mitad de temporada.</div>
                  </div>
                </div>
                <div className="of-mode-cta">ENTRAR →</div>
              </button>

              <button onClick={() => setShowTournamentFlow(true)} className="of-mode of-mode-yellow" title="Crear torneo">
                <span className="of-mode-corner of-mode-corner-tl" />
                <span className="of-mode-corner of-mode-corner-tr" />
                <span className="of-mode-corner of-mode-corner-bl" />
                <span className="of-mode-corner of-mode-corner-br" />
                <div className="of-mode-body">
                  <img className="of-mode-icon of-mode-icon-img" src="/img/tournament.png" alt="" />
                  <div className="of-mode-text">
                    <div className="of-mode-title">TORNEO</div>
                    <div className="of-mode-desc">Diseña una competición a tu medida: liga corta, grupos o eliminatoria directa con los equipos que elijas.</div>
                  </div>
                </div>
                <div className="of-mode-cta">ENTRAR →</div>
              </button>
            </div>

            {(fantasyAvailable || (league.managerCareer?.length ?? 0) > 0) && (
              <div className={`of-home-grid of-home-grid-2 ${fantasyAvailable && (league.managerCareer?.length ?? 0) > 0 ? 'two' : 'one'}`}>
                {fantasyAvailable && (
                  <button onClick={() => setShowFantasyFlow(true)} className="of-mode of-mode-sm of-mode-yellow" title="Modo Fantasy">
                    <span className="of-mode-corner of-mode-corner-tl" /><span className="of-mode-corner of-mode-corner-tr" /><span className="of-mode-corner of-mode-corner-bl" /><span className="of-mode-corner of-mode-corner-br" />
                    <div className="of-mode-body">
                      <div className="of-mode-text">
                        <div className="of-mode-title">{t('btn.fantasy')}</div>
                        <div className="of-mode-desc">Draft de jugadores reales con presupuesto fijo — monta el mejor once posible y juega la liga.</div>
                      </div>
                    </div>
                  </button>
                )}
                {(league.managerCareer?.length ?? 0) > 0 && (
                  <button onClick={() => setView('MANAGER_CAREER')} className="of-mode of-mode-sm of-mode-pink" title="Histórico del entrenador">
                    <span className="of-mode-corner of-mode-corner-tl" /><span className="of-mode-corner of-mode-corner-tr" /><span className="of-mode-corner of-mode-corner-bl" /><span className="of-mode-corner of-mode-corner-br" />
                    <div className="of-mode-body">
                      <div className="of-mode-text">
                        <div className="of-mode-title">{t('btn.managerCareer')}</div>
                        <div className="of-mode-desc">Continúa con tu entrenador: clubes, títulos, reputación y récords acumulados.</div>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}

            <div className="of-status">
              <div className="of-status-label">ESTADO ACTUAL</div>
              <div className="of-status-cells">
                <div className="of-status-cell">
                  <svg viewBox="0 0 64 64" className="of-status-ico" aria-hidden="true"><circle cx="32" cy="22" r="10" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M14 54c2-10 10-14 18-14s16 4 18 14" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
                  <div className="of-status-text"><div className="of-status-key">Modo actual</div><div className="of-status-val">{pack ? 'Pack cargado' : 'No iniciado'}</div></div>
                </div>
                <div className="of-status-cell">
                  <svg viewBox="0 0 64 64" className="of-status-ico" aria-hidden="true"><rect x="8" y="20" width="48" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M20 20 V44 M44 20 V44" stroke="currentColor" strokeWidth="3"/></svg>
                  <div className="of-status-text"><div className="of-status-key">Equipos</div><div className="of-status-val">{pack ? pack.clubs.length.toLocaleString('es-ES') : '—'}</div></div>
                </div>
                <div className="of-status-cell">
                  <svg viewBox="0 0 64 64" className="of-status-ico" aria-hidden="true"><circle cx="22" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="3"/><circle cx="42" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M10 50c2-8 8-12 16-12 4 0 8 1 12 4M54 50c-2-8-8-12-16-12" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
                  <div className="of-status-text"><div className="of-status-key">Jugadores</div><div className="of-status-val">{pack ? pack.players.length.toLocaleString('es-ES') : '—'}</div></div>
                </div>
                <div className="of-status-cell">
                  <svg viewBox="0 0 64 64" className="of-status-ico" aria-hidden="true"><polygon points="32,8 38,24 56,24 42,34 48,52 32,42 16,52 22,34 8,24 26,24" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
                  <div className="of-status-text"><div className="of-status-key">Competiciones</div><div className="of-status-val">{pack ? pack.leagues.length : '—'}</div></div>
                </div>
                <div className="of-status-cell">
                  <svg viewBox="0 0 64 64" className="of-status-ico" aria-hidden="true"><path d="M8 50 L24 34 L34 44 L56 18" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M44 18 H56 V30" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
                  <div className="of-status-text"><div className="of-status-key">Última partida</div><div className="of-status-val">-- / -- / ----</div></div>
                </div>
              </div>
            </div>

            <div className="of-tools">
              <div className="of-tools-label">HERRAMIENTAS</div>
              <div className="of-tools-grid">
                <button onClick={() => setShowInstructions(true)} className="of-tool of-tool-pink" title="Cómo se juega y novedades de la versión">
                  <svg viewBox="0 0 64 64" className="of-tool-ico" aria-hidden="true"><path d="M10 14h20v36H10zM34 14h20v36H34z" fill="none" stroke="currentColor" strokeWidth="4"/></svg>
                  <span>{t('nav.helpChangelog')}</span>
                </button>
                <button onClick={() => setView('EDITOR')} className="of-tool of-tool-cyan" title="Editores: equipos, jugadores y packs">
                  <svg viewBox="0 0 64 64" className="of-tool-ico" aria-hidden="true"><path d="M16 48l8-2 24-24-6-6-24 24z" fill="none" stroke="currentColor" strokeWidth="4"/></svg>
                  <span>{t('nav.editor')}</span>
                </button>
                <button onClick={() => setView('BACKUP')} className="of-tool of-tool-pink" title="Idioma, sonido, packs y copias de seguridad">
                  <svg viewBox="0 0 64 64" className="of-tool-ico" aria-hidden="true"><circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" strokeWidth="4"/><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3"/></svg>
                  <span>{t('btn.settings')}</span>
                </button>
                <button onClick={() => setShowColaborar(true)} className="of-tool of-tool-red" title="Cómo colaborar con el proyecto">
                  <svg viewBox="0 0 64 64" className="of-tool-ico" aria-hidden="true"><circle cx="20" cy="24" r="7" fill="none" stroke="currentColor" strokeWidth="3"/><circle cx="44" cy="24" r="7" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M8 50c2-8 8-12 14-12M56 50c-2-8-8-12-14-12" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
                  <span>{t('nav.collaborate')}</span>
                </button>
              </div>
            </div>

            <div className="of-footer">
              <span className="of-footer-line" />
              <div className="of-footer-mid">
                <span>2026 OPENFUTBOL</span>
                <span className="of-footer-dot">·</span>
                <button onClick={() => setShowDisclaimer(true)} className="of-footer-link">DISCLAIMER</button>
                <span className="of-footer-dot">·</span>
                <a href="https://github.com/x1010x/openfutbol-public" target="_blank" rel="noreferrer" className="of-footer-link">GITHUB ↗</a>
              </div>
              <span className="of-footer-line" />
            </div>
          </div>
        );
      }

      // Single-screen team picker for PLAY mode. Teams + lookups are memoized
      // at App level (see top of component) so we don't rebuild on every render.
      return (
        <TeamPicker
          title={`PLAY · ${pickerYear}/${(pickerYear + 1).toString().slice(-2)}`}
          year={pickerYear}
          teams={pickerSummaries}
          mode="play"
          minTeams={4}
          maxTeams={24}
          allowSpectate={false}
          buildTeam={buildPickerTeam}
          availableYears={PICKER_YEARS}
          onYearChange={setPickerYear}
          onBack={() => setShowPlayFlow(false)}
          onConfirm={({ teamIds, userTeamId, spectate }) => {
            handleSelectYear(pickerYear);
            handleLeagueSetupConfirm(teamIds, [], [], pickerYear);
            const startingTeam = userTeamId ?? (spectate ? teamIds[0] : null);
            if (startingTeam) setTimeout(() => handleSelectTeam(startingTeam), 0);
          }}
        />
      );
    }

    const userTeam = league.teams.find(t => t.id === league.userTeamId)!;

    if (view === 'END_OF_SEASON') {
      if (league.gameMode === 'promanager') {
        const wasFiredMid = !!league.boardFired;
        return (
          <div className="w-full flex flex-col gap-4">
            {wasFiredMid && (
              <div className="bg-vga-light-red border-4 border-vga-bright-white p-3 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <div className="text-vga-bright-white text-[10px] uppercase tracking-widest font-bold">Despedido en la jornada {league.currentJornada}</div>
                <div className="text-vga-yellow text-[8px] uppercase mt-1">Esto es el balance de tu paso por el club.</div>
              </div>
            )}
            <EndOfSeasonView
              league={league}
              hideActions
              onCellClick={(teamId, stat) => setDrillDown({ teamId, stat })}
              onTeamClick={(teamId) => { setViewingTeamId(teamId); setView('SQUAD'); }}
              onPlayerClick={(playerId) => showPlayerDetail(playerId)}
            />
            <div className="border-t-4 border-vga-yellow pt-2">
              <div className="text-vga-yellow text-[10px] uppercase tracking-widest font-bold mb-2 text-center">
                {wasFiredMid ? 'Próximo destino' : 'Pro Manager · Final de temporada'}
              </div>
              <ProManagerEndView
                teams={league.teams}
                stats={league.stats}
                userTeamId={league.userTeamId}
                managerName={league.managerName ?? ''}
                florentinometro={league.florentinometro ?? 5}
                boardObjective={league.boardObjective ?? 'avoid_relegation'}
                managerReputation={league.managerReputation ?? 50}
                year={league.year}
                firedByTeamIds={league.firedByTeamIds}
                onPickTeam={handleProManagerPickTeam}
                onRetire={handleProManagerRetire}
              />
            </div>
          </div>
        );
      }
      return (
        <EndOfSeasonView
          league={league}
          onContinueSameTeam={handleAdvanceSameTeam}
          onAdvanceAndChangeTeam={handleAdvanceChangeTeam}
          onResetGame={handleResetGame}
          onCellClick={(teamId, stat) => setDrillDown({ teamId, stat })}
          onTeamClick={(teamId) => { setViewingTeamId(teamId); setView('SQUAD'); }}
          onPlayerClick={(playerId) => showPlayerDetail(playerId)}
        />
      );
    }

    if (view === 'JORNADA_RESULTS') {
      const playedJornada = league.schedule.find(j => j.number === league.lastPlayedJornada) ?? null;
      return (
        <JornadaResultsView
          jornada={playedJornada}
          teams={league.teams}
          userTeamId={league.userTeamId}
          onContinue={() => setView(league.seasonFinished ? 'END_OF_SEASON' : 'LEAGUE')}
        />
      );
    }

    if (view === 'SQUAD') {
      const viewedTeam = (viewingTeamId && league.teams.find(t => t.id === viewingTeamId)) || userTeam;
      const isOpponent = viewedTeam.id !== userTeam.id;
      if (squadCompact) {
        return (
          <SquadViewCompact
            team={viewedTeam}
            seasonYear={league.year}
            currentJornada={league.currentJornada}
            onToggleForSale={handleToggleForSale}
            onPlayerClick={showPlayerDetail}
            onBack={() => { setViewingTeamId(null); setView('LEAGUE'); }}
            readOnly={isOpponent}
            incomingOffers={league.incomingOffers}
            teams={league.teams}
            userTeam={userTeam}
            windowOpen={windowOpen}
            blockedSignings={league.blockedSignings}
            onAcceptIncomingOffer={isOpponent ? undefined : handleAcceptIncomingOffer}
            onRejectIncomingOffer={isOpponent ? undefined : handleRejectIncomingOffer}
            onCounterIncomingOffer={isOpponent ? undefined : handleCounterIncomingOffer}
            onOffer={isOpponent ? (pid, amount) => handleOfferForPlayer(pid, viewedTeam.id, amount) : undefined}
            onPayClausula={isOpponent ? (pid) => handleClausula(pid, viewedTeam.id) : undefined}
            onSwitchClassic={toggleSquadCompact}
          />
        );
      }
      return (
        <SquadView
          team={viewedTeam}
          seasonYear={league.year}
          currentJornada={league.currentJornada}
          onToggleForSale={handleToggleForSale}
          onPlayerClick={showPlayerDetail}
          onBack={() => { setViewingTeamId(null); setView('LEAGUE'); }}
          readOnly={isOpponent}
          incomingOffers={isOpponent ? undefined : league.incomingOffers}
          teams={isOpponent ? undefined : league.teams}
          onAcceptIncomingOffer={isOpponent ? undefined : handleAcceptIncomingOffer}
          onRejectIncomingOffer={isOpponent ? undefined : handleRejectIncomingOffer}
          onCounterIncomingOffer={isOpponent ? undefined : handleCounterIncomingOffer}
          onSwitchCompact={toggleSquadCompact}
        />
      );
    }

    if (view === 'PLAYER_DETAIL' && selectedPlayerId) {
      let player = null;
      let teamName: string | null = null;
      for (const t of league.teams) {
        const found = t.players.find(p => p.id === selectedPlayerId);
        if (found) { player = found; teamName = t.name; break; }
      }
      if (!player) {
        const fa = league.freeAgents.find(p => p.id === selectedPlayerId);
        if (fa) { player = fa; teamName = null; }
      }
      if (player) {
        const dbId = extractDbId(player.id);
        const history = league.playerHistory[dbId] ?? [];
        return (
          <PlayerDetailView
            player={player}
            teamName={teamName}
            history={history}
            seasonYear={league.year}
            onBack={() => { setSelectedPlayerId(null); setView(previousView); }}
          />
        );
      }
      // Fallback: player vanished (sold mid-view), return.
      setSelectedPlayerId(null);
      setView(previousView);
      return null;
    }

    if (view === 'ALIGNMENT') {
      return (
        <AlignmentView
          team={userTeam}
          onUpdate={handleUpdateAlignment}
          onBack={() => setView('LEAGUE')}
          onToggleDiscipline={() => setLeague(prev => ({
            ...prev,
            teams: prev.teams.map(t => t.id === prev.userTeamId
              ? { ...t, tacticalDiscipline: !(t.tacticalDiscipline ?? true) }
              : t
            ),
          }))}
        />
      );
    }

    if (view === 'RESULTS') {
      return (
        <ResultsView
          schedule={league.schedule}
          teams={league.teams}
          currentJornada={league.currentJornada}
          userTeamId={league.userTeamId}
          onBack={() => setView('LEAGUE')}
        />
      );
    }

    if (view === 'STATS') {
      return (
        <StatsView
          teams={league.teams}
          onPlayerClick={showPlayerDetail}
          onBack={() => setView('LEAGUE')}
        />
      );
    }

    if (view === 'FINANCES') {
      return (
        <FinancesView
          team={userTeam}
          finances={league.finances[league.userTeamId] ?? { seasonIncome: 0, seasonSalaries: 0 }}
          rivalTeams={league.teams.filter(t => t.id !== league.userTeamId)}
          seasonYear={league.year}
          transferLog={league.transferLog}
          onUpdateTicketPrice={handleUpdateTicketPrice}
          onBack={() => setView('LEAGUE')}
        />
      );
    }

    if (view === 'TRANSFERS') {
      return (
        <TransfersView
          userTeam={userTeam}
          rivalTeams={league.teams.filter(t => t.id !== league.userTeamId)}
          freeAgents={league.freeAgents}
          seasonYear={league.year}
          currentJornada={league.currentJornada}
          transferLog={league.transferLog}
          onOffer={handleOfferForPlayer}
          onOfferFreeAgent={handleOfferForFreeAgent}
          onClausula={handleClausula}
          onPlayerClick={showPlayerDetail}
          blockedSignings={league.blockedSignings}
          windowOpen={windowOpen}
          windowJornadasLeft={winLeft}
          jornadasUntilOpen={winUntil}
          onBack={() => setView('LEAGUE')}
        />
      );
    }

    if (view === 'BACKUP') {
      return (
        <BackupView
          league={league}
          onRestore={(newState) => {
            setLeague(newState);
            setView('LEAGUE');
          }}
          onReset={() => {
            setLeague(getInitialLeagueState());
            setView('LEAGUE');
          }}
          onBack={() => setView('LEAGUE')}
          onOpenPack={() => setView('PACK_LOADER')}
        />
      );
    }

    if (view === 'EQUIPO') {
      return (
        <EquipoView
          team={userTeam}
          league={league}
          onPlayerClick={showPlayerDetail}
          onBack={() => setView('LEAGUE')}
        />
      );
    }

    const homeTeam = league.teams.find(t => t.id === userMatch?.homeId);
    const awayTeam = league.teams.find(t => t.id === userMatch?.awayId);
    const currentView = view as View;

    const navBtn = (
      label: string,
      target: View | 'INSTRUCTIONS',
      opts: { isActive?: boolean; alert?: 'red' | 'yellow'; badge?: string | number; onClick?: () => void } = {},
    ) => {
      const { isActive, alert, badge, onClick } = opts;
      const stateClass = isActive
        ? 'bg-vga-yellow text-vga-black border-vga-bright-white cool:bg-rc-primary cool:text-rc-bg cool:border-rc-primary'
        : alert === 'red'
        ? 'bg-vga-blue text-vga-bright-white border-vga-red animate-pulse cool:bg-rc-panel cool:border-vga-red'
        : alert === 'yellow'
        ? 'bg-vga-blue text-vga-bright-white border-vga-yellow animate-pulse cool:bg-rc-panel cool:border-vga-yellow'
        : 'bg-vga-blue text-vga-white border-vga-gray cool:bg-rc-panel cool:text-rc-accent cool:border-rc-border';
      return (
        <button
          onClick={onClick ?? (() => target === 'INSTRUCTIONS' ? setShowInstructions(true) : setView(target))}
          className={`flex-1 py-2 px-2 text-[8px] border-2 relative text-center min-w-[70px] ${stateClass}`}
        >
          {label}
          {badge != null && (
            <span className="absolute -top-1 -right-1 bg-vga-red text-vga-bright-white text-[7px] px-1 border border-vga-bright-white">
              {badge}
            </span>
          )}
        </button>
      );
    };

    const missing = userTeam.lineup.length < 11;
    const offers = league.incomingOffers.filter(o => {
      const bidder = league.teams.find(t => t.id === o.fromTeamId);
      return bidder && bidder.budget >= o.amount;
    }).length;

    return (
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <nav className="flex flex-wrap gap-2 rc-nav-tabs">
          {navBtn(t('nav.league'),    'LEAGUE',    { isActive: currentView === 'LEAGUE' })}
          {navBtn(t('nav.squad'),     'SQUAD',     {
            isActive: currentView === 'SQUAD' && !viewingTeamId,
            onClick: () => { setViewingTeamId(null); setView('SQUAD'); },
            alert: offers > 0 && !(currentView === 'SQUAD' && !viewingTeamId) ? 'yellow' : undefined,
            badge: offers > 0 && !(currentView === 'SQUAD' && !viewingTeamId) ? `!${offers}` : undefined,
          })}
          {navBtn(t('nav.alignment'), 'ALIGNMENT', {
            isActive: currentView === 'ALIGNMENT',
            alert: missing && currentView !== 'ALIGNMENT' ? 'red' : undefined,
            badge: missing && currentView !== 'ALIGNMENT' ? 11 - userTeam.lineup.length : undefined,
          })}
          {navBtn(t('nav.results'),   'RESULTS',   { isActive: currentView === 'RESULTS' })}
          {navBtn(t('nav.stats'),     'STATS',     { isActive: currentView === 'STATS' })}
          {navBtn(t('nav.finances'),  'FINANCES',  { isActive: currentView === 'FINANCES' })}
          {navBtn(t('nav.transfers'), 'TRANSFERS', {
            isActive: currentView === 'TRANSFERS',
            alert: windowOpen && winLeft <= 3 && currentView !== 'TRANSFERS' ? 'yellow' : undefined,
            badge: windowOpen ? (winLeft <= 3 ? winLeft : undefined) : undefined,
          })}
          {navBtn(t('nav.team'),      'EQUIPO',    { isActive: currentView === 'EQUIPO' })}
          {navBtn(t('nav.editor'),    'EDITOR',    { isActive: currentView === 'EDITOR' })}
          {navBtn(t('nav.backup'),    'BACKUP',    { isActive: currentView === 'BACKUP' })}
          {league.gameMode === 'promanager' && navBtn(t('nav.managerCareer'), 'MANAGER_CAREER', { isActive: currentView === 'MANAGER_CAREER' })}
          {navBtn(t('nav.help'), 'INSTRUCTIONS')}
        </nav>
        <div className="flex flex-col gap-6 min-w-0">

        <LeagueTable
          stats={league.stats}
          schedule={league.schedule}
          userTeamId={league.userTeamId}
          teams={league.teams}
          onCellClick={(teamId, stat) => setDrillDown({ teamId, stat })}
          onTeamClick={(teamId) => { setViewingTeamId(teamId); setView('SQUAD'); }}
        />

        <div className="border-4 border-vga-blue p-4 bg-vga-gray text-vga-black">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-vga-blue text-[10px] font-bold uppercase">
              {t('label.jornada')} {league.currentJornada}
              <span className="ml-2 text-vga-black text-[8px] font-normal normal-case">{formatJornadaDate(league.year, league.currentJornada)}</span>
            </h2>
            <span className="text-[7px] bg-vga-black text-vga-bright-white px-2 py-1">{userMatch ? t('misc.nextMatch') : t('misc.halftime')}</span>
          </div>

          {userMatch ? (
            <>
              {!showPreview ? (
                <>
                  <div className="flex justify-between items-center mb-4 bg-vga-black p-3 border border-vga-white">
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <TeamCrest colors={homeTeam?.colors} size="xl" title={homeTeam?.name} teamId={homeTeam?.id} />
                      <span className="text-[10px] text-vga-light-red text-center leading-tight truncate w-full">{homeTeam?.name}</span>
                    </div>
                    <span className="text-[12px] text-vga-white mx-3 font-pixel shrink-0">VS</span>
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <TeamCrest colors={awayTeam?.colors} size="xl" title={awayTeam?.name} teamId={awayTeam?.id} />
                      <span className="text-[10px] text-vga-light-cyan text-center leading-tight truncate w-full">{awayTeam?.name}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold shadow-sm rc-btn-primary"
                  >
                    {t('btn.playMatch')}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    {[homeTeam, awayTeam].map((team, i) => {
                      if (!team) return null;
                      const isUser = team.id === league.userTeamId;
                      return (
                        <div key={team.id} className="flex-1 min-w-0">
                          <div className="text-center mb-1">
                            <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
                            <div className={`text-[8px] font-bold text-center leading-tight ${i === 0 ? 'text-vga-light-red' : 'text-vga-light-cyan'}`}>{team.name}</div>
                            <div className="text-[7px] text-vga-cyan">{team.formation} · MED {Math.floor(calculateTeamStrength(team) / 2)}</div>
                          </div>
                          <PitchDiagram
                            team={team}
                            selectedSlot={isUser && previewSwapSlot !== null ? previewSwapSlot : null}
                            onSlotClick={() => {}}
                            onCircleClick={isUser
                              ? (idx) => setPreviewSwapSlot(prev => prev === idx ? null : idx)
                              : (idx) => { const pid = team.lineup[idx]; if (pid) showPlayerDetail(pid); }}
                            onNameClick={(pid) => showPlayerDetail(pid)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* Pre-match swap modal */}
                  {previewSwapSlot !== null && (() => {
                    const userTeam = league.teams.find(t => t.id === league.userTeamId)!;
                    const slotPlayerId = userTeam.lineup[previewSwapSlot];
                    const inLineup = new Set(userTeam.lineup.filter(Boolean));
                    const slotPos = FORMATIONS[userTeam.formation]?.[previewSwapSlot] ?? 'MED';
                    const currentPlayer = slotPlayerId ? userTeam.players.find(p => p.id === slotPlayerId) ?? null : null;
                    const candidates = userTeam.players
                      .filter(p => !inLineup.has(p.id) && (p.injuryWeeksRemaining ?? 0) === 0 && p.suspensionMatches === 0)
                      .sort((a, b) => b.media - a.media);
                    return (
                      <SwapModal
                        slotPos={slotPos}
                        currentPlayer={currentPlayer}
                        candidates={candidates}
                        inLineup={inLineup}
                        onSelect={(pid) => {
                          setLeague(prev => ({
                            ...prev,
                            teams: prev.teams.map(t => {
                              if (t.id !== prev.userTeamId) return t;
                              const newLineup = [...t.lineup];
                              newLineup[previewSwapSlot!] = pid;
                              return { ...t, lineup: newLineup };
                            }),
                          }));
                          setPreviewSwapSlot(null);
                        }}
                        onClose={() => setPreviewSwapSlot(null)}
                      />
                    );
                  })()}
                  {homeTeam && awayTeam && (() => {
                    const bonus = computeTvBonus(league.stats, homeTeam.id, awayTeam.id);
                    return bonus > 0 ? (
                      <div className="bg-vga-black border border-vga-yellow px-2 py-1 mb-2 text-[7px] text-center">
                        <span className="text-vga-yellow font-bold">TV</span>
                        <span className="text-vga-bright-white ml-1">{t('misc.tvBonus')}</span>
                        <span className="text-vga-light-green font-bold ml-1">{formatEuros(bonus)}</span>
                      </div>
                    ) : null;
                  })()}
                  <button
                    onClick={() => {
                      const { lineup } = pickBestXI(userTeam.players, userTeam.formation, new Set(), userTeam.tacticalDiscipline ?? true);
                      setLeague(prev => ({
                        ...prev,
                        teams: prev.teams.map(t => t.id === userTeam.id ? { ...t, lineup } : t),
                      }));
                      setPreviewSwapSlot(null);
                    }}
                    className="w-full text-[8px] font-bold text-vga-black bg-vga-yellow border border-vga-bright-white py-1 mb-1 hover:bg-vga-bright-white uppercase tracking-wider"
                  >
                    ★ Auto-Fix XI ({userTeam.formation})
                  </button>
                  <button
                    onClick={() => setView('ALIGNMENT')}
                    className="w-full text-[7px] text-vga-cyan border border-vga-cyan py-1 mb-2 hover:bg-vga-cyan hover:text-vga-black"
                  >
                    {t('btn.adjustLineup')}
                  </button>
                  <div className="mb-3">
                    <label className="text-[8px] block mb-1 font-bold text-vga-blue">{t('misc.durationSecs')}</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { sec: 0,   label: 'INSTANTE' },
                        { sec: 30,  label: 'RÁPIDO' },
                        { sec: 60,  label: 'NORMAL' },
                        { sec: 120, label: 'LARGO' },
                      ].map(({ sec, label }) => (
                        <button
                          key={sec}
                          onClick={() => setMatchDuration(sec)}
                          className={`text-[8px] py-1.5 border font-bold uppercase ${matchDuration === sec ? 'bg-vga-blue text-vga-bright-white border-vga-bright-white' : 'bg-vga-black text-vga-bright-white border-vga-gray hover:border-vga-light-green'}`}
                        >
                          {label}
                          <div className="text-[6px] text-vga-cyan font-normal">{sec === 0 ? '—' : `${sec}s`}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(false)}
                      className="bg-vga-gray text-vga-black py-2 px-3 border border-vga-black text-[8px] hover:bg-vga-white"
                    >
                      {t('btn.back')}
                    </button>
                    <button
                      onClick={startNextMatch}
                      className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold rc-btn-primary"
                    >
                      {t('btn.playMatch')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="bg-vga-black p-3 border border-vga-white mb-4 text-center">
                <span className="text-[9px] text-vga-yellow">{t('misc.restDay')}</span>
              </div>
              <button
                onClick={handleByeRound}
                className="w-full bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold shadow-sm"
              >
                {t('btn.nextRound')}
              </button>
            </>
          )}
        </div>

        </div>
      </div>
    );
  };

  const isHomeMenu = !league.isStarted && !showPlayFlow && !showProManagerFlow && !showTournamentFlow && !showFantasyFlow
    && view !== 'MANAGER_CAREER' && view !== 'EDITOR' && view !== 'BACKUP' && view !== 'PACK_LOADER' && view !== 'PACK_EDITOR'
    && !showInstructions && !showColaborar;

  return (
    <PlayerTooltipProvider
      year={league?.year ?? selectedYear ?? new Date().getFullYear()}
      teams={tournament?.teams ?? league?.teams ?? []}
    >
    <div className="min-h-screen bg-vga-black cool:bg-rc-bg overflow-x-hidden of-bg">
      {showDisclaimer && <DisclaimerView onDismiss={dismissDisclaimer} />}

      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-vga-yellow text-vga-black flex items-center justify-between px-4 py-1.5 text-[8px] font-bold uppercase border-b-2 border-vga-black">
          <span>{t('misc.updateAvailable')}</span>
          <button
            onClick={() => { localStorage.setItem('openfutbol_show_changelog', '1'); window.location.reload(); }}
            className="ml-4 bg-vga-black text-vga-yellow px-2 py-0.5 border border-vga-black hover:bg-vga-blue shrink-0"
          >
            {t('btn.reload')}
          </button>
        </div>
      )}

      {dbWipeMsg && !dbWipeDismissed && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-6">
          <div className="bg-vga-black border-4 border-vga-light-red max-w-md w-full p-6 font-mono flex flex-col gap-4">
            <div className="text-vga-light-red text-sm font-bold uppercase tracking-widest">
              {t('misc.savedIncompatible')}
            </div>
            <div className="text-vga-bright-white text-base leading-relaxed">
              {dbWipeMsg}
            </div>
            <div className="text-vga-gray text-[9px]">
              {t('misc.wipeNote')}
            </div>
            <button
              onClick={() => setDbWipeDismissed(true)}
              className="bg-vga-light-red text-vga-black font-bold py-2 px-4 text-sm border-2 border-vga-black hover:bg-vga-bright-white mt-2"
            >
              {t('btn.wipeAck')}
            </button>
          </div>
        </div>
      )}
      <div id="rc-screen">
      <div className="w-full max-w-[1600px] mx-auto px-2 mb-3">
        <AppHeader
          hasNewVersion={hasNewVersion}
          onOpenChangelog={() => { setInstructionsScroll('changelog'); setShowInstructions(true); setHasNewVersion(false); }}
          onOpenSettings={() => setView('BACKUP')}
        />
      </div>

      {!isHomeMenu && (
      <div className="w-full max-w-4xl">
        <StatusBar
          league={league}
          windowOpen={windowOpen}
          windowJornadasLeft={winLeft}
          jornadasUntilOpen={winUntil}
          onBoardAlert={lastBoardAlert ? () => setBoardAlert(lastBoardAlert) : undefined}
          onCareer={league.gameMode === 'promanager' && (league.managerCareer?.length ?? 0) > 0 ? () => setView('MANAGER_CAREER') : undefined}
        />
      </div>
      )}

      {!match ? renderMainContent() : (() => {
        const userBudget = league.teams.find(tm => tm.id === league.userTeamId)?.budget ?? 0;
        return (
          <div className="w-full flex flex-col gap-2">
            <MatchScreen
              match={match}
              userTeamId={activeUserTeamIdSafe}
              year={tournamentMatchCtx && tournament ? new Date().getFullYear() : league.year}
              currentJornada={tournamentMatchCtx ? 0 : league.currentJornada}
              budget={userBudget}
              isPlaying={isPlaying}
              showSubPanel={showSubPanel}
              htPaused={htPaused}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onShowSubs={() => { setIsPlaying(false); setPreselectedSubPlayerId(null); setShowSubPanel(true); }}
              onPlayerClick={(pid) => { setIsPlaying(false); setPreselectedSubPlayerId(pid); setShowSubPanel(true); }}
              onContinue={handleMatchEnd}
              stats={league.stats}
              schedule={league.schedule}
            />


            {showSubPanel && !match.isFinished && (() => {
              const isUserHome = match.homeTeam.id === activeUserTeamId;
              const userTeamInMatch = isUserHome ? match.homeTeam : match.awayTeam;
              const subsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
              const stamMap = isUserHome ? match.homeStamina : match.awayStamina;
              const sentOff = isUserHome ? match.homeSentOff : match.awaySentOff;
              const injuredIds = isUserHome ? match.homeInjuredInMatch : match.awayInjuredInMatch;

              // Patch team players with live stamina so PitchDiagram shows real values
              const liveTeam = {
                ...userTeamInMatch,
                players: userTeamInMatch.players.map(p => ({ ...p, stamina: stamMap[p.id] ?? p.stamina ?? 99 })),
              };

              return (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 8 }}>
                  <AlignmentView
                    team={liveTeam}
                    onUpdate={(patch) => {
                      setMatch(prev => {
                        if (!prev) return null;
                        const isHome = prev.homeTeam.id === activeUserTeamId;
                        const updated = { ...userTeamInMatch, ...patch };
                        return isHome ? { ...prev, homeTeam: updated } : { ...prev, awayTeam: updated };
                      });
                    }}
                    onBack={() => { setShowSubPanel(false); setPreselectedSubPlayerId(null); setIsPlaying(true); }}
                    onToggleDiscipline={() => {
                      setMatch(prev => {
                        if (!prev) return null;
                        const isHome = prev.homeTeam.id === activeUserTeamId;
                        const updated = { ...userTeamInMatch, tacticalDiscipline: !(userTeamInMatch.tacticalDiscipline ?? true) };
                        return isHome ? { ...prev, homeTeam: updated } : { ...prev, awayTeam: updated };
                      });
                    }}
                    ingame={{
                      subsUsed,
                      maxSubs: 3,
                      injuredIds,
                      sentOff,
                      subbedOffIds: match.events
                        .filter(e => e.type === 'sub' && e.teamId === userTeamInMatch.id && e.playerOffId)
                        .map(e => e.playerOffId as string),
                      htPaused,
                      onCommit: (stagedLineup, subPairs) => {
                        commitUserSubs(stagedLineup, subPairs);
                        setShowSubPanel(false);
                        setPreselectedSubPlayerId(null);
                        setIsPlaying(true);
                      },
                      initialSelectedPlayerId: preselectedSubPlayerId,
                    }}
                  />
                </div>
              );
            })()}

            {/* Stats and lineups now live inside MatchScreen */}
          </div>
        );
      })()}

      </div>{/* #rc-screen */}

      {drillDown && (
        <StatDrillDown
          teamId={drillDown.teamId}
          stat={drillDown.stat}
          teams={league.teams}
          schedule={league.schedule}
          onClose={() => setDrillDown(null)}
        />
      )}

      {message && (
        <MessageModal
          title={message.title}
          tone={message.tone ?? 'info'}
          onClose={() => setMessage(null)}
        >
          {message.body}
        </MessageModal>
      )}

      {boardAlert && (
        <BoardAlertModal
          title={boardAlert.title}
          body={boardAlert.body}
          tone={boardAlert.tone}
          onClose={() => setBoardAlert(null)}
        />
      )}
      {showProManagerTutorial && (
        <ProManagerTutorialModal
          managerName={league.managerName ?? ''}
          onClose={() => setShowProManagerTutorial(false)}
        />
      )}

      {tournament && tournamentRoundRecap !== null && (
        <TournamentRoundResultsModal
          state={tournament}
          justPlayedStageIdx={tournamentRoundRecap}
          onClose={() => setTournamentRoundRecap(null)}
        />
      )}

      {saleNegotiation && (
        <PlayerNegotiationModal
          player={saleNegotiation.player}
          buyerTeam={saleNegotiation.buyer}
          sellerTeam={saleNegotiation.seller}
          feePaid={saleNegotiation.offer.amount}
          seasonYear={league.year}
          mode="user-selling"
          onAccept={(salary, years) => {
            commitIncomingOfferAccept(saleNegotiation.offer, salary, years);
            setSaleNegotiation(null);
          }}
          onReject={() => {
            // Player refused; withdraw the offer so it doesn't sit forever.
            const offerId = saleNegotiation.offer.id;
            setLeague(prev => ({ ...prev, incomingOffers: prev.incomingOffers.filter(o => o.id !== offerId) }));
            setSaleNegotiation(null);
          }}
          onClose={() => setSaleNegotiation(null)}
        />
      )}

      {outgoingNegotiation && (
        <PlayerNegotiationModal
          player={outgoingNegotiation.player}
          buyerTeam={outgoingNegotiation.buyer}
          sellerTeam={outgoingNegotiation.seller}
          feePaid={outgoingNegotiation.amount}
          seasonYear={league.year}
          mode="user-buying"
          onAccept={(salary, years) => {
            commitOutgoingOfferAccept(
              outgoingNegotiation.player,
              outgoingNegotiation.fromTeamId,
              outgoingNegotiation.amount,
              outgoingNegotiation.offeredPlayerIds,
              salary,
              years,
            );
            setOutgoingNegotiation(null);
            setMessage({
              title: 'Fichaje cerrado',
              body: `${outgoingNegotiation.player.name} firma por ${outgoingNegotiation.buyer.name}.`,
              tone: 'info',
            });
          }}
          onReject={() => {
            setOutgoingNegotiation(null);
            setMessage({
              title: 'Negociación fallida',
              body: `${outgoingNegotiation.player.name} no aceptó tus condiciones. La operación se cae.`,
              tone: 'warning',
            });
          }}
          onClose={() => setOutgoingNegotiation(null)}
        />
      )}

      {freeAgentNegotiation && (() => {
        const fakeSeller: Team = {
          id: 'free_agent',
          name: 'Agente libre',
          colors: ['#333333', '#ffffff'],
          year: league.year,
          stadiumCapacity: 0,
          ticketPrice: 0,
          budget: 0,
          players: [],
          lineup: [],
          formation: '4-4-2',
          tacticalDiscipline: false,
        };
        return (
          <PlayerNegotiationModal
            player={freeAgentNegotiation.player}
            buyerTeam={freeAgentNegotiation.buyer}
            sellerTeam={fakeSeller}
            feePaid={0}
            seasonYear={league.year}
            mode="user-buying"
            onAccept={(salary, years) => {
              commitFreeAgentSigning(freeAgentNegotiation.player, salary, years);
              const p = freeAgentNegotiation.player;
              setFreeAgentNegotiation(null);
              setMessage({
                title: 'Fichaje cerrado',
                body: `${p.name} llega libre a tu club.`,
                tone: 'info',
              });
            }}
            onReject={() => {
              const p = freeAgentNegotiation.player;
              setFreeAgentNegotiation(null);
              setMessage({
                title: 'Negociación fallida',
                body: `${p.name} no aceptó las condiciones que le ofreciste.`,
                tone: 'warning',
              });
            }}
            onClose={() => setFreeAgentNegotiation(null)}
          />
        );
      })()}

      {clausulaNegotiation && (
        <PlayerNegotiationModal
          player={clausulaNegotiation.player}
          buyerTeam={clausulaNegotiation.buyer}
          sellerTeam={clausulaNegotiation.seller}
          feePaid={clausulaNegotiation.cost}
          seasonYear={league.year}
          mode="user-buying"
          onAccept={(salary, years) => {
            commitClausula(clausulaNegotiation.player, clausulaNegotiation.fromTeamId, clausulaNegotiation.cost, salary, years);
            setClausulaNegotiation(null);
            setMessage({
              title: 'Fichaje cerrado',
              body: `${clausulaNegotiation.player.name} firma por ${clausulaNegotiation.buyer.name}. ${formatEuros(clausulaNegotiation.cost)} pagados.`,
              tone: 'info',
            });
          }}
          onReject={() => {
            setClausulaNegotiation(null);
            setMessage({
              title: 'Negociación fallida',
              body: `${clausulaNegotiation.player.name} no aceptó tus condiciones. La cláusula no se ejecuta.`,
              tone: 'warning',
            });
          }}
          onClose={() => setClausulaNegotiation(null)}
        />
      )}
    </div>
    </PlayerTooltipProvider>
  );
}

export default App;

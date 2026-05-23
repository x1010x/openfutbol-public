import { useState, useEffect, useRef } from 'react';

import { getAvailableYears, getAvailableYearsWithStats, getTeamColorsForYear, migrateTeam, buildFreeAgentFromDB, buildTeamFromSeason, getTeamTemplatesForYear, getFantasyPool, buildFantasyTeam } from './data/mockTeams';
import type { FormationId, MatchEvent, MatchState, Position, Team } from './types/game.d.ts';
import { applyMoodToTeam } from './engine/playerMood';
import { simulateMinute, calculateTeamStrength } from './engine/simEngine';
import { FORMATIONS, ALL_FORMATIONS, liveMed, pickBestXI, reslotLineup } from './engine/formations';
import { getInitialLeagueState, getFantasyLeagueState, updateLeagueStats, deductWeeklySalaries, generateIncomingOffers, autoListAiPlayers, simulateAiMarketSignings, advanceSeason, simulateAiTrades, simulateAiFreeAgentSignings, appendTransfer, decrementSuspensions, signingBlockKey, squadNeeds, groupFor, repickAiFormations, writebackMatchStamina, decayTeamStaminaAfterMatch, decrementInjuries, applyStaminaRecovery, computeTvBonus, applyTvBonus } from './store/leagueStore';
import type { TransferRecord } from './store/leagueStore';
import type { LeagueState } from './store/leagueStore';
import { LeagueTable } from './components/LeagueTable';
import { StatusBar } from './components/StatusBar';
import { SquadView } from './components/SquadView';
import { TeamSelection } from './components/TeamSelection';
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
import { EquipoView } from './components/EquipoView';
import { TeamCrest } from './components/TeamCrest';
import { PitchDiagram } from './components/PitchDiagram';
import { StatDrillDown } from './components/StatDrillDown';
import { MessageModal } from './components/MessageModal';
import { DisclaimerView } from './components/DisclaimerView';
import { SwapModal } from './components/SwapModal';
import { FantasySetupView } from './components/FantasySetupView';
import { FantasyDraftView } from './components/FantasyDraftView';
import type { StatKey } from './components/StatDrillDown';
import { extractDbId } from './data/mockTeams';
import { computePrice, evaluateOffer, formatEuros } from './data/economy';
import { PlayerTooltipProvider } from './contexts/PlayerTooltipContext';
import { PlayerName } from './components/PlayerName';
import { formatJornadaDate } from './engine/calendar';
import type { OfferResult } from './data/economy';

type View = 'LEAGUE' | 'SQUAD' | 'ALIGNMENT' | 'RESULTS' | 'STATS' | 'FINANCES' | 'TRANSFERS' | 'JORNADA_RESULTS' | 'END_OF_SEASON' | 'PLAYER_DETAIL' | 'BACKUP' | 'EDITOR' | 'EQUIPO';

function App() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [league, setLeague] = useState<LeagueState>(() => {
    const saved = localStorage.getItem('openfutbol_league');
    if (saved) {
      const parsed = JSON.parse(saved);
      const firstPlayer = parsed.teams?.[0]?.players?.[0];
      const hasOldStats = firstPlayer?.stats?.velocidad !== undefined;
      const needsReset = parsed.isStarted === undefined ||
                         !parsed.schedule ||
                         !parsed.year ||
                         !parsed.teams[0]?.lineup ||
                         parsed.teams[0]?.players?.length < 9 ||
                         parsed.teams[0]?.players?.[0]?.id?.includes('_p') ||
                         hasOldStats ||
                         firstPlayer?.birthYear === undefined ||
                         !parsed.finances ||
                         !Array.isArray(parsed.incomingOffers) ||
                         !Array.isArray(parsed.freeAgents) ||
                         !Array.isArray(parsed.finances[Object.keys(parsed.finances)[0]]?.weeks) ||
                         typeof parsed.lastPlayedJornada !== 'number';

      if (needsReset) {
        localStorage.setItem('openfutbol_db_wiped', '1');
        return getInitialLeagueState();
      }
      const colorsByTeamId = getTeamColorsForYear(parsed.year);
      const hydratedTeams = parsed.teams.map((t: Team) => migrateTeam({
        ...t,
        colors: t.colors ?? colorsByTeamId.get(t.id),
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [showColaborar, setShowColaborar] = useState(false);
  const [instructionsScroll, setInstructionsScroll] = useState<'changelog' | 'engine' | undefined>(undefined);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [drillDown, setDrillDown] = useState<{ teamId: string; stat: StatKey } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<View>('LEAGUE');
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ title: string; body: string; tone?: 'info' | 'danger' | 'warning' } | null>(null);
  const [htPaused, setHtPaused] = useState(false);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [previewSwapSlot, setPreviewSwapSlot] = useState<number | null>(null);
  const [showFantasyFlow, setShowFantasyFlow] = useState(false);
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

  const DB_WIPE_JOKES = [
    'Tu guardado era de una version anterior. Lo hemos eliminado con mucho respeto y poca ceremonia. Moment of silence.',
    'La base de datos ha sufrido un accidente laboral. Nadie ha resultado herido... excepto tu temporada.',
    'Hemos encontrado datos incompatibles con esta version. Los hemos reciclado. El medioambiente lo agradece.',
    'Tu guardado era tan antiguo que ya no reconociamos los datos. Como un contrato de Ronaldo en el Madrid, habia que cancelarlo.',
    'Error de compatibilidad detectado. Tu temporada anterior ha pasado a mejor vida. Descanse en paz, campeon.',
    'Guardado corrompido. O eso, o alguien metio la mano en la base de datos. Sospechamos de Florentino.',
  ];
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

  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem('openfutbol_muted') === '1');
  const toggleMute = () => setMuted(m => { localStorage.setItem('openfutbol_muted', m ? '0' : '1'); return !m; });

  const [theme, setThemeState] = useState<'retrocutre' | 'retrocool'>(() =>
    (localStorage.getItem('openfutbol_theme') as 'retrocutre' | 'retrocool') ?? 'retrocool'
  );
  const setTheme = (t: 'retrocutre' | 'retrocool') => {
    localStorage.setItem('openfutbol_theme', t);
    setThemeState(t);
  };
  useEffect(() => {
    if (theme === 'retrocool') {
      document.body.dataset.theme = 'retrocool';
    } else {
      delete document.body.dataset.theme;
    }
  }, [theme]);


  const showPlayerDetail = (playerId: string) => {
    if (view !== 'PLAYER_DETAIL') setPreviousView(view);
    setSelectedPlayerId(playerId);
    setView('PLAYER_DETAIL');
  };
  const eventLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('openfutbol_league', JSON.stringify(league));
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

  const handleLeagueSetupConfirm = (selectedTeamIds: string[], extraRawPlayers: import('./types/game.d.ts').RawPlayerDB[], importedRawTeams: import('./types/game.d.ts').RawTeamDB[]) => {
    const selectedSet = new Set(selectedTeamIds);
    const importedTeams = importedRawTeams
      .filter(rt => selectedSet.has(rt.id))
      .flatMap(rt => {
        const season = rt.seasons.find(s => s.year === selectedYear!) ?? rt.seasons[0];
        if (!season) return [];
        return [buildTeamFromSeason({ id: rt.id, name: rt.name, ...season })];
      });
    const dbTeamIds = new Set(getTeamTemplatesForYear(selectedYear!).map(t => t.id));
    const importedRawIds = new Set(importedRawTeams.map(rt => rt.id));
    const editorTeams = league.teams.filter(t => !dbTeamIds.has(t.id) && !importedRawIds.has(t.id));
    const extraTeams = [...importedTeams, ...editorTeams];
    const extraFreeAgents = extraRawPlayers
      .map(p => buildFreeAgentFromDB(p, selectedYear!))
      .filter((p): p is import('./types/game.d.ts').Player => p !== null);
    setLeague(getInitialLeagueState(selectedYear!, selectedTeamIds, extraFreeAgents, extraTeams));
    setLeagueSetupDone(true);
  };

  const handleSelectTeam = (teamId: string) => {
    setLeague(prev => {
      let next: LeagueState = { ...prev, userTeamId: teamId, isStarted: true };
      for (let i = 0; i < 4; i++) {
        next = autoListAiPlayers(next);
      }
      return next;
    });
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

  const handleOfferForFreeAgent = (playerId: string, amount: number): OfferResult => {
    const player = league.freeAgents.find(p => p.id === playerId);
    const buyer = league.teams.find(t => t.id === league.userTeamId);
    if (!player || !buyer) {
      return { accepted: false, message: 'Operación inválida.' };
    }
    const blockKey = signingBlockKey(null, playerId);
    if (league.blockedSignings.includes(blockKey)) {
      return { accepted: false, message: 'No se admiten más ofertas por este jugador esta temporada.' };
    }
    if (buyer.budget < amount) {
      return { accepted: false, message: 'No tienes presupuesto suficiente.' };
    }
    const price = computePrice(player, league.year);
    const result = evaluateOffer(price, amount);
    if (!result.accepted) {
      if (result.blocked) {
        setLeague(prev => ({ ...prev, blockedSignings: [...prev.blockedSignings, blockKey] }));
      }
      return result;
    }

    setLeague(prev => {
      const userTeam = prev.teams.find(t => t.id === prev.userTeamId);
      const entry: TransferRecord = {
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada,
        year: prev.year,
        playerName: player.name,
        playerPosition: player.position,
        fromTeamName: null,
        toTeamName: userTeam?.name ?? '',
        amount,
      };
      return {
        ...prev,
        teams: prev.teams.map(t =>
          t.id === prev.userTeamId
            ? { ...t, players: [...t.players, player], budget: t.budget - amount }
            : t
        ),
        freeAgents: prev.freeAgents.filter(p => p.id !== playerId),
        transferLog: appendTransfer(prev.transferLog, entry),
      };
    });
    return result;
  };

  const handleOfferForPlayer = (
    playerId: string,
    fromTeamId: string,
    amount: number,
    offeredPlayerIds: string[] = [],
  ): OfferResult => {
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

    setLeague(prev => {
      const buyerTeam = prev.teams.find(t => t.id === prev.userTeamId);
      const tradeId = offeredPlayers.length > 0
        ? `usr_trade_${prev.currentJornada}_${playerId}_${Date.now()}`
        : undefined;
      const records: TransferRecord[] = [];
      records.push({
        id: `tx_${prev.currentJornada}_${player.id}_${Date.now()}`,
        jornada: prev.currentJornada,
        year: prev.year,
        playerName: player.name,
        playerPosition: player.position,
        fromTeamName: seller.name,
        toTeamName: buyerTeam?.name ?? '',
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
          fromTeamName: buyerTeam?.name ?? '',
          toTeamName: seller.name,
          amount: 0,
          tradeId,
        });
      });

      const offeredIdSet = new Set(offeredPlayerIds);
      return {
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id === fromTeamId) {
            return {
              ...t,
              players: t.players
                .filter(p => p.id !== playerId)
                .concat(offeredPlayers.map(p => ({ ...p, forSale: false }))),
              lineup: t.lineup.filter(id => id !== playerId),
              budget: t.budget + amount,
            };
          }
          if (t.id === prev.userTeamId) {
            return {
              ...t,
              players: t.players
                .filter(p => !offeredIdSet.has(p.id))
                .concat({ ...player, forSale: false }),
              lineup: t.lineup.filter(id => !offeredIdSet.has(id)),
              budget: t.budget - amount,
            };
          }
          return t;
        }),
        transferLog: records.reduce((log, rec) => appendTransfer(log, rec), prev.transferLog),
      };
    });
    return result;
  };

  const handleClausula = (playerId: string, fromTeamId: string): OfferResult => {
    const seller = league.teams.find(t => t.id === fromTeamId);
    const player = seller?.players.find(p => p.id === playerId);
    const buyer = league.teams.find(t => t.id === league.userTeamId);
    if (!seller || !player || !buyer) return { accepted: false, message: 'Operación inválida.' };
    const price = computePrice(player, league.year);
    const clausulaCost = price * 2;
    if (buyer.budget < clausulaCost) return { accepted: false, message: 'No tienes presupuesto suficiente para la cláusula.' };

    setLeague(prev => {
      const entry: TransferRecord = {
        id: `clausula_${prev.currentJornada}_${playerId}_${Date.now()}`,
        jornada: prev.currentJornada, year: prev.year,
        playerName: player.name, playerPosition: player.position,
        fromTeamName: seller.name, toTeamName: buyer.name,
        amount: clausulaCost,
      };
      return {
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id === fromTeamId) return { ...t, players: t.players.filter(p => p.id !== playerId), lineup: t.lineup.filter(id => id !== playerId) };
          if (t.id === prev.userTeamId) return { ...t, players: [...t.players, { ...player, forSale: false }], budget: t.budget - clausulaCost };
          return t;
        }),
        transferLog: appendTransfer(prev.transferLog, entry),
      };
    });
    return { accepted: true, message: `Cláusula ejecutada. ${formatEuros(clausulaCost)} pagados a TEBAS.` };
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
    // Pre-validamos contra el estado actual para poder explicar el motivo si falla.
    const offer = league.incomingOffers.find(o => o.id === offerId);
    if (!offer) {
      setMessage({ title: 'Oferta no encontrada', body: 'Esta oferta ya no existe. Puede que la temporada haya avanzado.', tone: 'warning' });
      return;
    }
    const userTeam = league.teams.find(t => t.id === league.userTeamId);
    const buyer = league.teams.find(t => t.id === offer.fromTeamId);
    const player = userTeam?.players.find(p => p.id === offer.playerId);
    if (!userTeam || !buyer || !player) {
      setMessage({ title: 'Oferta inválida', body: 'No se ha podido localizar al jugador o al club ofertante.', tone: 'danger' });
      return;
    }
    if (buyer.budget < offer.amount) {
      setLeague(prev => ({
        ...prev,
        incomingOffers: prev.incomingOffers.filter(o => o.id !== offerId),
      }));
      setMessage({ title: 'Oferta retirada', body: `${buyer.name} ya no puede afrontar ${offer.amount.toLocaleString()}€ por ${player.name}. La oferta se ha retirado.`, tone: 'warning' });
      return;
    }
    const offeredIds = offer.offeredPlayerIds ?? [];
    const offeredPlayers = offeredIds
      .map(id => buyer.players.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (offeredPlayers.length !== offeredIds.length) {
      setMessage({ title: 'Jugador no disponible', body: `Algún jugador del intercambio ya no está en la plantilla de ${buyer.name}.`, tone: 'warning' });
      return;
    }
    const userFinalSize = userTeam.players.length - 1 + offeredPlayers.length;
    const buyerFinalSize = buyer.players.length - offeredPlayers.length + 1;
    if (userFinalSize < 11) {
      setMessage({ title: 'Plantilla mínima 11', body: `Si aceptas, tu plantilla quedaría en ${userFinalSize} jugadores. Necesitas al menos 11.`, tone: 'warning' });
      return;
    }
    if (buyerFinalSize < 11) {
      setMessage({ title: 'Plantilla rival insuficiente', body: `${buyer.name} quedaría con ${buyerFinalSize} jugadores tras el trato.`, tone: 'warning' });
      return;
    }
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
            return {
              ...t,
              players: t.players
                .filter(p => !offeredIdSet.has(p.id))
                .concat({ ...player, forSale: false }),
              lineup: t.lineup.filter(id => !offeredIdSet.has(id)),
              budget: t.budget - offer.amount,
            };
          }
          return t;
        }),
        incomingOffers: prev.incomingOffers.filter(o => o.playerId !== offer.playerId),
        transferLog: records.reduce((log, rec) => appendTransfer(log, rec), prev.transferLog),
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
      setMessage({ title: 'Jugador no disponible', body: 'Alguno de los jugadores pedidos ya no está en la plantilla rival.', tone: 'warning' });
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
      setMessage({ title: `${buyer.name} rechaza`, body: result.message, tone: 'warning' });
      return;
    }

    // Accepted — execute with the counter terms
    const userFinalSize = userTeam.players.length - 1 + requestedPlayers.length;
    const buyerFinalSize = buyer.players.length - requestedPlayers.length + 1;
    if (userFinalSize < 11) {
      setMessage({ title: 'Plantilla mínima 11', body: `Tu plantilla quedaría en ${userFinalSize} jugadores tras el trato.`, tone: 'warning' });
      return;
    }
    if (buyerFinalSize < 11) {
      setMessage({ title: 'Plantilla rival insuficiente', body: `${buyer.name} quedaría con ${buyerFinalSize} jugadores.`, tone: 'warning' });
      return;
    }
    if (buyer.budget < requestedCash) {
      setMessage({ title: 'Presupuesto insuficiente', body: `${buyer.name} no puede afrontar ${formatEuros(requestedCash)} en efectivo.`, tone: 'warning' });
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
      };
    });
    setMessage({ title: '¡Trato cerrado!', body: `${buyer.name} acepta la contraoferta. ${player.name} fichado.${requestedPlayers.length > 0 ? ` Recibes: ${requestedPlayers.map(p => p.name).join(', ')}.` : ''}`, tone: 'info' });
  };

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
      alert('No puedes jugar sin un portero en la alineación.');
      return;
    }
    const injuredInLineup = userTeam.players.filter(p => userTeam.lineup.includes(p.id) && (p.injuryWeeksRemaining ?? 0) > 0);
    if (injuredInLineup.length > 0) {
      alert(`Hay jugadores lesionados en la alineación: ${injuredInLineup.map(p => p.name).join(', ')}`);
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
      homeBoost: 1.05 + Math.random() * 0.15,
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
    };

    setHtPaused(false);
    setShowSubPanel(false);
    setSubOut(null);

    if (matchDuration === 0) {
      let m = initialMatch;
      while (!m.isFinished) m = simulateMinute(m);
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
      const homeBoost = 1.05 + Math.random() * 0.15;
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
    newLeague = autoListAiPlayers(newLeague);
    newLeague = simulateAiMarketSignings(newLeague);
    newLeague = simulateAiTrades(newLeague);
    newLeague = simulateAiFreeAgentSignings(newLeague);
    newLeague = repickAiFormations(newLeague);
    newLeague = generateIncomingOffers(newLeague);
    const allMatchesPlayed = newLeague.schedule.every(j => j.matches.every(m => m.played));
    if (allMatchesPlayed) {
      newLeague.seasonFinished = true;
    } else if (newLeague.currentJornada < newLeague.schedule.length) {
      newLeague.currentJornada++;
    }
    newLeague.lastPlayedJornada = playedJornada;
    setLeague(newLeague);
    setMatch(null);
    setIsPlaying(false);
    setView('JORNADA_RESULTS');
  };

  const finalizeMatch = (finalMatch: MatchState) => {
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
    );
    newLeague = applyTvBonus(newLeague, league.userTeamId, tvBonus);
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

  const handleAdvanceSameTeam = () => {
    setLeague(prev => advanceSeason(prev));
    setView('LEAGUE');
  };

  const handleAdvanceChangeTeam = () => {
    setLeague(prev => {
      const advanced = advanceSeason(prev);
      setSelectedYear(advanced.year);
      return { ...advanced, userTeamId: '', isStarted: false };
    });
    setView('LEAGUE');
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

  useEffect(() => {
    let interval: number;
    if (isPlaying && match && !match.isFinished) {
      interval = window.setInterval(() => {
        setMatch(prev => prev ? simulateMinute(prev) : null);
      }, match.matchSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, match]);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [match?.events]);

  // Auto-pause at halftime for user subs
  useEffect(() => {
    if (match && match.minute >= 45 + (match.stoppageTime1 ?? 0) && match.minute < 90 && isPlaying && !htPaused && matchDuration > 0) {
      setIsPlaying(false);
      setHtPaused(true);
      setShowSubPanel(true);
      setSubOut(null);
      setSubTab('campo');
      setMatch(prev => prev ? applyAiHtSubs(prev, league.userTeamId) : null);
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

      const inLineup = new Set(team.lineup);
      const starters = team.lineup
        .filter(pid => !sentOff.includes(pid) && !injured.includes(pid))
        .map(pid => ({ pid, stam: stamMap[pid] ?? 99 }))
        .sort((a, b) => a.stam - b.stam);
      const bench = team.players
        .filter(p => !inLineup.has(p.id) && !injured.includes(p.id) && !sentOff.includes(p.id) && (p.injuryWeeksRemaining ?? 0) === 0 && p.suspensionMatches === 0)
        .map(p => ({ p, stam: stamMap[p.id] ?? (p.stamina ?? 99) }))
        .sort((a, b) => b.stam - a.stam);

      const toMake = Math.min(3 - subsUsed, starters.length, bench.length);
      let newLineup = [...team.lineup];
      let newSubsUsed = subsUsed;
      const newStamMap = { ...stamMap };

      for (let i = 0; i < toMake; i++) {
        if (bench[i].stam <= starters[i].stam + 10) continue;
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

  const performUserSub = (playerOutId: string, playerInId: string) => {
    if (!match) return;
    const isUserHome = match.homeTeam.id === league.userTeamId;
    const team = isUserHome ? match.homeTeam : match.awayTeam;
    const subsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
    if (subsUsed >= 3) return;

    const playerOut = team.players.find(p => p.id === playerOutId);
    const playerIn = team.players.find(p => p.id === playerInId);
    if (!playerOut || !playerIn) return;

    const newLineup = team.lineup.map(id => id === playerOutId ? playerInId : id);
    const newTeam = { ...team, lineup: newLineup };
    const stamMap = isUserHome ? { ...match.homeStamina } : { ...match.awayStamina };
    stamMap[playerInId] = playerIn.stamina ?? 99;

    const subEvent: MatchEvent = {
      minute: match.minute,
      type: 'sub',
      description: `Cambio: entra ${playerIn.fullName}, sale ${playerOut.fullName}.`,
      teamId: team.id,
      playerId: playerInId,
      playerOffId: playerOutId,
    };

    if (isUserHome) {
      setMatch(prev => prev ? {
        ...prev,
        homeTeam: newTeam,
        homeStamina: stamMap,
        homeSubsUsed: subsUsed + 1,
        events: [...prev.events, subEvent],
      } : null);
    } else {
      setMatch(prev => prev ? {
        ...prev,
        awayTeam: newTeam,
        awayStamina: stamMap,
        awaySubsUsed: subsUsed + 1,
        events: [...prev.events, subEvent],
      } : null);
    }
    const newSubsUsed = subsUsed + 1;
    if (newSubsUsed >= 3) {
      setShowSubPanel(false);
      setSubOut(null);
      setIsPlaying(true);
    } else {
      setSubOut(null);
      setSubTab('campo');
    }
  };

  const renderMainContent = () => {
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

    if (!league.isStarted) {
      const availableYears = getAvailableYears();

      if (!showPlayFlow) {
        return (
          <div className="w-full max-w-sm flex flex-col gap-3 animate-in fade-in duration-300 rc-menu">
            <div className="bg-vga-blue border-4 border-vga-white p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-2 rc-menu-title">
              <div className="text-vga-yellow text-xl font-bold tracking-widest mb-1 cool:text-rc-primary">OPENFUTBOL</div>
              <div className="text-vga-cyan text-[8px] tracking-widest cool:text-rc-accent">FÚTBOL DE GESTIÓN</div>
            </div>
            <button
              onClick={() => setShowPlayFlow(true)}
              className="w-full bg-vga-green text-vga-bright-white py-4 text-sm border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90 rc-btn-play"
            >
              JUGAR
            </button>
            <button
              onClick={() => setShowFantasyFlow(true)}
              className="w-full bg-vga-yellow text-vga-black py-4 text-sm border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90 rc-btn-fantasy"
            >
              FANTASY
            </button>
            <button
              onClick={() => setShowInstructions(true)}
              className="w-full bg-vga-blue text-vga-bright-white py-3 text-[10px] border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90"
            >
              AYUDA / NOVEDADES
            </button>
            <button
              onClick={() => setView('EDITOR')}
              className="w-full bg-vga-magenta text-vga-bright-white py-3 text-[10px] border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90"
            >
              EDITOR
            </button>
            <button
              onClick={() => setView('BACKUP')}
              className="w-full bg-vga-gray text-vga-black py-3 text-[10px] border-2 border-vga-black font-bold uppercase tracking-widest hover:bg-vga-bright-white"
            >
              AJUSTES
            </button>
            <button
              onClick={() => setShowColaborar(true)}
              className="w-full bg-vga-black text-vga-cyan py-3 text-[10px] border-2 border-vga-cyan font-bold uppercase tracking-widest hover:bg-vga-cyan hover:text-vga-black"
            >
              COLABORAR
            </button>
          </div>
        );
      }

      if (selectedYear && !leagueSetupDone) {
        return (
          <LeagueSetupView
            year={selectedYear}
            existingTeams={league.teams}
            onConfirm={handleLeagueSetupConfirm}
            onBack={() => handleSelectYear(0)}
          />
        );
      }

      return (
        <TeamSelection
          teams={league.teams}
          selectedYear={selectedYear}
          availableYears={availableYears}
          yearStats={getAvailableYearsWithStats()}
          onSelectYear={handleSelectYear}
          onSelect={handleSelectTeam}
          onBack={() => setShowPlayFlow(false)}
        />
      );
    }

    const userTeam = league.teams.find(t => t.id === league.userTeamId)!;

    if (view === 'END_OF_SEASON') {
      return (
        <EndOfSeasonView
          teams={league.teams}
          stats={league.stats}
          userTeamId={league.userTeamId}
          onContinueSameTeam={handleAdvanceSameTeam}
          onAdvanceAndChangeTeam={handleAdvanceChangeTeam}
          onResetGame={handleResetGame}
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
          {navBtn('LIGA',       'LEAGUE',    { isActive: currentView === 'LEAGUE' })}
          {navBtn('PLANTILLA',  'SQUAD',     {
            isActive: currentView === 'SQUAD' && !viewingTeamId,
            onClick: () => { setViewingTeamId(null); setView('SQUAD'); },
            alert: offers > 0 && !(currentView === 'SQUAD' && !viewingTeamId) ? 'yellow' : undefined,
            badge: offers > 0 && !(currentView === 'SQUAD' && !viewingTeamId) ? `!${offers}` : undefined,
          })}
          {navBtn('ALINEACIÓN', 'ALIGNMENT', {
            isActive: currentView === 'ALIGNMENT',
            alert: missing && currentView !== 'ALIGNMENT' ? 'red' : undefined,
            badge: missing && currentView !== 'ALIGNMENT' ? 11 - userTeam.lineup.length : undefined,
          })}
          {navBtn('RESULTADOS', 'RESULTS',   { isActive: currentView === 'RESULTS' })}
          {navBtn('STATS',      'STATS',     { isActive: currentView === 'STATS' })}
          {navBtn('FINANZAS',   'FINANCES',  { isActive: currentView === 'FINANCES' })}
          {navBtn('FICHAJES',   'TRANSFERS', { isActive: currentView === 'TRANSFERS' })}
          {navBtn('EQUIPO',     'EQUIPO',    { isActive: currentView === 'EQUIPO' })}
          {navBtn('EDITAR',     'EDITOR',    { isActive: currentView === 'EDITOR' })}
          {navBtn('SISTEMA',    'BACKUP',    { isActive: currentView === 'BACKUP' })}
          {navBtn('AYUDA', 'INSTRUCTIONS')}
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
              Jornada {league.currentJornada}
              <span className="ml-2 text-vga-black text-[8px] font-normal normal-case">{formatJornadaDate(league.year, league.currentJornada)}</span>
            </h2>
            <span className="text-[7px] bg-vga-black text-vga-bright-white px-2 py-1">{userMatch ? 'PRÓXIMO PARTIDO' : 'DESCANSO'}</span>
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
                    JUGAR PARTIDO
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
                            <div className="text-[7px] text-vga-cyan">{team.formation} · {calculateTeamStrength(team).toFixed(0)}</div>
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
                        <span className="text-vga-bright-white ml-1">BONUS POR ESTE PARTIDO:</span>
                        <span className="text-vga-light-green font-bold ml-1">{formatEuros(bonus)}</span>
                      </div>
                    ) : null;
                  })()}
                  <button
                    onClick={() => setView('ALIGNMENT')}
                    className="w-full text-[7px] text-vga-cyan border border-vga-cyan py-1 mb-2 hover:bg-vga-cyan hover:text-vga-black"
                  >
                    Ajustar alineacion
                  </button>
                  <div className="mb-3">
                    <label className="text-[8px] block mb-1 font-bold text-vga-blue">DURACIÓN (SEG):</label>
                    <div className="grid grid-cols-7 gap-1">
                      {[0, 10, 20, 30, 40, 50, 60].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setMatchDuration(sec)}
                          className={`text-[7px] py-1 border font-bold ${matchDuration === sec ? 'bg-vga-blue text-vga-bright-white border-vga-bright-white' : 'bg-vga-black text-vga-bright-white border-vga-gray hover:border-vga-light-green'}`}
                        >
                          {sec === 0 ? 'INST.' : sec}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPreview(false)}
                      className="bg-vga-gray text-vga-black py-2 px-3 border border-vga-black text-[8px] hover:bg-vga-white"
                    >
                      VOLVER
                    </button>
                    <button
                      onClick={startNextMatch}
                      className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold rc-btn-primary"
                    >
                      JUGAR PARTIDO
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="bg-vga-black p-3 border border-vga-white mb-4 text-center">
                <span className="text-[9px] text-vga-yellow">Tu equipo descansa esta jornada</span>
              </div>
              <button
                onClick={handleByeRound}
                className="w-full bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold shadow-sm"
              >
                SIGUIENTE JORNADA
              </button>
            </>
          )}
        </div>

        </div>
      </div>
    );
  };

  return (
    <PlayerTooltipProvider year={league?.year ?? selectedYear ?? new Date().getFullYear()}>
    <div className="min-h-screen bg-vga-black cool:bg-rc-bg">
      {showDisclaimer && <DisclaimerView onDismiss={dismissDisclaimer} />}

      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-vga-yellow text-vga-black flex items-center justify-between px-4 py-1.5 text-[8px] font-bold uppercase border-b-2 border-vga-black">
          <span>Hay una actualizacion disponible. La tuya huele a polvo.</span>
          <button
            onClick={() => { localStorage.setItem('openfutbol_show_changelog', '1'); window.location.reload(); }}
            className="ml-4 bg-vga-black text-vga-yellow px-2 py-0.5 border border-vga-black hover:bg-vga-blue shrink-0"
          >
            RECARGAR
          </button>
        </div>
      )}

      {dbWipeMsg && !dbWipeDismissed && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-6">
          <div className="bg-vga-black border-4 border-vga-light-red max-w-md w-full p-6 font-mono flex flex-col gap-4">
            <div className="text-vga-light-red text-sm font-bold uppercase tracking-widest">
              GUARDADO INCOMPATIBLE
            </div>
            <div className="text-vga-bright-white text-base leading-relaxed">
              {dbWipeMsg}
            </div>
            <div className="text-vga-gray text-[9px]">
              (Esto pasa cuando actualizamos cosas importantes. No es culpa tuya. Bueno, un poco si.)
            </div>
            <button
              onClick={() => setDbWipeDismissed(true)}
              className="bg-vga-light-red text-vga-black font-bold py-2 px-4 text-sm border-2 border-vga-black hover:bg-vga-bright-white mt-2"
            >
              VALE, LO PILLO
            </button>
          </div>
        </div>
      )}
      <div id="rc-screen">
      <header className="mb-3 text-center w-full max-w-4xl">
        <div className="bg-vga-blue border-4 border-vga-white p-2 vga-panel cool:bg-rc-panel cool:border-rc-primary">
          <h1 className="text-vga-yellow text-2xl tracking-widest font-bold keep-pixel cool:text-rc-primary">OPENFUTBOL</h1>
          <div className="flex justify-between items-center mt-1 px-2">
            <button
              type="button"
              onClick={() => { setInstructionsScroll('changelog'); setShowInstructions(true); setHasNewVersion(false); }}
              className="text-vga-cyan text-[8px] hover:text-vga-yellow underline decoration-dotted underline-offset-2 cool:text-rc-accent cool:hover:text-rc-primary flex items-center gap-1"
              title="Ver cambios recientes"
            >
              OPENFUTBOL v1.1.0-{__BUILD_TIMESTAMP__}
              {hasNewVersion && (
                <span className="bg-vga-red text-vga-bright-white text-[7px] px-1 font-bold animate-pulse">
                  NUEVO
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? 'Activar sonido' : 'Silenciar'}
              className={`text-[7px] font-bold px-1.5 py-0.5 border ${muted ? 'border-vga-gray text-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white' : theme === 'retrocool' ? 'border-rc-accent text-rc-accent hover:text-white hover:border-white' : 'border-vga-light-green text-vga-light-green hover:border-vga-bright-white hover:text-vga-bright-white'}`}
            >
              {muted ? 'SFX:OFF' : 'SFX:ON'}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'retrocool' ? 'retrocutre' : 'retrocool')}
              title="Cambiar tema visual"
              className={`text-[7px] font-bold px-1.5 py-0.5 border ${theme === 'retrocool' ? 'border-rc-hot text-rc-hot hover:text-white hover:border-white' : 'border-vga-gray text-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
            >
              {theme === 'retrocool' ? 'RETROCOOL' : 'RETROCUTRE'}
            </button>
            <span className="text-vga-bright-white text-[8px] uppercase cool:text-rc-accent">
              {league.isStarted ? league.teams.find(t => t.id === league.userTeamId)?.name : 'ESPERANDO SELECCIÓN'}
            </span>
          </div>
        </div>
      </header>

      <div className="w-full max-w-4xl">
        <StatusBar league={league} />
      </div>

      {!match ? renderMainContent() : (() => {
        const homeMED = Math.floor(calculateTeamStrength(match.homeTeam, match.homeSentOff, match.homeStamina));
        const awayMED = Math.floor(calculateTeamStrength(match.awayTeam, match.awaySentOff, match.awayStamina));

        const teamSummary = (team: typeof match.homeTeam, colorClass: string) => {
          const goals = match.events.filter(e => e.type === 'goal' && e.teamId === team.id);
          const yellows = match.events.filter(e => e.type === 'yellow' && e.teamId === team.id);
          const reds = match.events.filter(e => e.type === 'red' && e.teamId === team.id);
          const findP = (id?: string) => team.players.find(p => p.id === id);
          return (
            <div className="bg-vga-black border-2 border-vga-gray p-2 text-[8px]">
              <div className={`${colorClass} font-bold mb-1 border-b border-vga-gray pb-1 truncate`}>{team.name}</div>
              {goals.length === 0 && yellows.length === 0 && reds.length === 0 && (
                <div className="text-vga-gray text-[7px]">Sin incidencias</div>
              )}
              {goals.length > 0 && (
                <div className="mb-1">
                  <div className="text-vga-yellow text-[7px] uppercase mb-0.5">Goles</div>
                  {goals.map((g, i) => {
                    const scorer = findP(g.playerId);
                    const asst = findP(g.assistantId);
                    return (
                      <div key={`g${i}`} className="text-vga-bright-white">
                        {g.minute}' {scorer ? <PlayerName player={scorer} /> : '—'}{asst ? <> (asist. <PlayerName player={asst} />)</> : ''}
                      </div>
                    );
                  })}
                </div>
              )}
              {(yellows.length > 0 || reds.length > 0) && (
                <div>
                  <div className="text-vga-yellow text-[7px] uppercase mb-0.5">Tarjetas</div>
                  {yellows.map((c, i) => (
                    <div key={`y${i}`} className="flex items-center gap-1 text-vga-bright-white">
                      <div className="w-1.5 h-2.5 bg-vga-yellow border border-black flex-shrink-0"></div>
                      <span>{c.minute}' {(() => { const pl = findP(c.playerId); return pl ? <PlayerName player={pl} /> : '—'; })()}</span>
                    </div>
                  ))}
                  {reds.map((c, i) => (
                    <div key={`r${i}`} className="flex items-center gap-1 text-vga-bright-white">
                      <div className="w-1.5 h-2.5 bg-vga-red border border-black flex-shrink-0"></div>
                      <span>{c.minute}' {(() => { const pl = findP(c.playerId); return pl ? <PlayerName player={pl} /> : '—'; })()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        };

        const totalPossForBar = match.homePossession + match.awayPossession;
        const homePossPct = totalPossForBar === 0 ? 50 : Math.round((match.homePossession / totalPossForBar) * 100);
        const awayPossPct = 100 - homePossPct;

        return (
          <div className="w-full max-w-4xl border-4 border-vga-white bg-vga-blue p-4 vga-panel">
            <div className="bg-vga-black border-2 border-vga-gray vga-panel-inset p-4 mb-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center gap-3 justify-end min-w-0">
                  <div className="text-right min-w-0">
                    <p className="text-vga-light-red text-[8px] mb-1 truncate uppercase">{match.homeTeam.name}</p>
                    <p className="text-vga-cyan text-[7px]">MED {homeMED}</p>
                  </div>
                  <TeamCrest colors={match.homeTeam.colors} size="xl" title={match.homeTeam.name} teamId={match.homeTeam.id} />
                </div>
                <div className="text-center px-2">
                  <p className="text-3xl text-vga-bright-white tracking-wider">
                    <span className="text-vga-light-red">{match.homeScore}</span>
                    <span className="text-vga-gray mx-2">:</span>
                    <span className="text-vga-light-cyan">{match.awayScore}</span>
                  </p>
                  <p className="text-vga-yellow text-[8px] mt-1">{match.minute}'</p>
                </div>
                <div className="flex items-center gap-3 justify-start min-w-0">
                  <TeamCrest colors={match.awayTeam.colors} size="xl" title={match.awayTeam.name} teamId={match.awayTeam.id} />
                  <div className="text-left min-w-0">
                    <p className="text-vga-light-cyan text-[8px] mb-1 truncate uppercase">{match.awayTeam.name}</p>
                    <p className="text-vga-cyan text-[7px]">MED {awayMED}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex h-3 border border-vga-gray vga-panel-inset">
                  <div className="bg-vga-light-red h-full" style={{ width: `${homePossPct}%` }} />
                  <div className="bg-vga-light-cyan h-full" style={{ width: `${awayPossPct}%` }} />
                </div>
                <div className="flex justify-between text-[7px] mt-0.5">
                  <span className="text-vga-light-red">{homePossPct}%</span>
                  <span className="text-vga-cyan uppercase">Posesión</span>
                  <span className="text-vga-light-cyan">{awayPossPct}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {teamSummary(match.homeTeam, 'text-vga-light-red')}
              {teamSummary(match.awayTeam, 'text-vga-light-cyan')}
            </div>

            <div ref={eventLogRef} className="bg-vga-black h-48 overflow-y-auto p-3 border-2 border-vga-gray font-mono text-[10px] leading-relaxed">
              {match.events.map((event, i) => (
                <div key={i} className={`mb-2 ${event.type === 'goal' ? 'text-vga-light-green animate-pulse' : 'text-vga-white'}`}>
                  <span className="text-vga-yellow mr-2">[{event.minute}']</span>
                  {event.description}
                </div>
              ))}
            </div>

            {!match.isFinished && (() => {
              const isUserHome = match.homeTeam.id === league.userTeamId;
              const userSubsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
              const canSub = userSubsUsed < 3;
              return (
                <div className="mt-3 flex gap-2">
                  {canSub && (
                    <button
                      onClick={() => { setIsPlaying(false); setShowSubPanel(true); setSubOut(null); setSubTab('campo'); }}
                      className="flex-1 bg-vga-yellow text-vga-black py-1 px-2 text-[8px] border border-vga-black hover:bg-vga-bright-white font-bold uppercase"
                    >
                      CAMBIOS ({userSubsUsed}/3)
                    </button>
                  )}
                  {!isPlaying && !showSubPanel && (
                    <button
                      onClick={() => setIsPlaying(true)}
                      className="flex-1 bg-vga-green text-vga-bright-white py-1 px-2 text-[8px] border border-vga-black hover:bg-vga-light-green font-bold uppercase"
                    >
                      REANUDAR
                    </button>
                  )}
                  {isPlaying && (
                    <button
                      onClick={() => setIsPlaying(false)}
                      className="bg-vga-gray text-vga-black py-1 px-2 text-[8px] border border-vga-black hover:bg-vga-white font-bold uppercase"
                    >
                      PAUSA
                    </button>
                  )}
                </div>
              );
            })()}

            {match.isFinished && (
              <button
                onClick={handleMatchEnd}
                className="mt-4 w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black text-xs"
              >
                CONTINUAR
              </button>
            )}

            {showSubPanel && !match.isFinished && (() => {
              const isUserHome = match.homeTeam.id === league.userTeamId;
              const userTeamInMatch = isUserHome ? match.homeTeam : match.awayTeam;
              const subsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
              const stamMap = isUserHome ? match.homeStamina : match.awayStamina;
              const sentOff = isUserHome ? match.homeSentOff : match.awaySentOff;
              const injuredIds = isUserHome ? match.homeInjuredInMatch : match.awayInjuredInMatch;

              const inLineup = new Set(userTeamInMatch.lineup);
              const subOutIdx = subOut ? userTeamInMatch.lineup.indexOf(subOut) : -1;
              const subOutSlotPos: Position | null = subOutIdx >= 0
                ? (FORMATIONS[userTeamInMatch.formation]?.[subOutIdx] ?? null)
                : null;
              const POS_ORDER: Record<string, number> = { DEL: 0, AML: 1, AMR: 1, MED: 2, DEF: 3, POR: 4 };
              const benchPlayers = userTeamInMatch.players
                .filter(p => !inLineup.has(p.id) && !injuredIds.includes(p.id) && !sentOff.includes(p.id) && (p.injuryWeeksRemaining ?? 0) === 0 && p.suspensionMatches === 0)
                .sort((a, b) => {
                  if (subOutSlotPos) {
                    const aFits = a.allowedPositions.includes(subOutSlotPos);
                    const bFits = b.allowedPositions.includes(subOutSlotPos);
                    if (aFits !== bFits) return aFits ? -1 : 1;
                  }
                  const aPosOrd = POS_ORDER[a.position] ?? 5;
                  const bPosOrd = POS_ORDER[b.position] ?? 5;
                  if (aPosOrd !== bPosOrd) return aPosOrd - bPosOrd;
                  return b.media - a.media;
                });

              // Patch team players with live stamina so PitchDiagram shows real values
              const liveTeam = {
                ...userTeamInMatch,
                players: userTeamInMatch.players.map(p => ({ ...p, stamina: stamMap[p.id] ?? p.stamina ?? 99 })),
              };

              const subOutSlotIdx = subOut ? liveTeam.lineup.indexOf(subOut) : null;

              const handlePitchClick = (idx: number) => {
                const pid = liveTeam.lineup[idx];
                if (!pid || sentOff.includes(pid) || injuredIds.includes(pid) || subsUsed >= 3) return;
                setSubOut(prev => prev === pid ? null : pid);
              };

              const StaminaBar = ({ value }: { value: number }) => {
                const pct = Math.round(Math.max(0, Math.min(100, value)));
                const col = pct >= 60 ? 'bg-vga-light-green' : pct >= 30 ? 'bg-vga-yellow' : 'bg-vga-light-red';
                return (
                  <div className="flex items-center gap-1">
                    <div className="w-10 h-1.5 bg-vga-black border border-vga-gray">
                      <div className={`h-full ${col}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[6px] text-vga-gray font-mono">{pct}</span>
                  </div>
                );
              };

              const liveMED = Math.floor(calculateTeamStrength(liveTeam, sentOff, stamMap));

              return (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
                  <div className="bg-vga-gray border-4 border-vga-yellow p-2 max-w-sm w-full max-h-[95vh] flex flex-col gap-2 min-h-0">
                    <div className="bg-vga-yellow text-vga-black text-[10px] p-2 flex justify-between items-center uppercase font-bold shrink-0">
                      <span>CAMBIOS — {subsUsed}/3</span>
                      <span className="flex items-center gap-2">
                        {htPaused && <span className="text-[8px] font-normal">DESCANSO</span>}
                        <span className="text-[8px] font-normal">MED <span className="font-bold">{liveMED}</span></span>
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
                      {/* Formation / AutoFix / Discipline controls */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {ALL_FORMATIONS.map(f => (
                          <button key={f}
                            onClick={() => {
                              const newLineup = reslotLineup(userTeamInMatch, userTeamInMatch.lineup.filter(Boolean), f);
                              setMatch(prev => {
                                if (!prev) return null;
                                const isHome = prev.homeTeam.id === league.userTeamId;
                                const updated = { ...userTeamInMatch, formation: f, lineup: newLineup };
                                return isHome ? { ...prev, homeTeam: updated } : { ...prev, awayTeam: updated };
                              });
                            }}
                            className={`px-1.5 py-0.5 text-[6px] border font-bold ${f === userTeamInMatch.formation ? 'bg-vga-yellow text-vga-black border-vga-black' : 'bg-vga-black text-vga-yellow border-vga-yellow hover:bg-vga-yellow/20'}`}
                          >{f}</button>
                        ))}
                        <button
                          onClick={() => {
                            const excl = new Set([...sentOff, ...injuredIds]);
                            const { lineup } = pickBestXI(userTeamInMatch.players, userTeamInMatch.formation, excl, userTeamInMatch.tacticalDiscipline ?? true);
                            setMatch(prev => {
                              if (!prev) return null;
                              const isHome = prev.homeTeam.id === league.userTeamId;
                              const updated = { ...userTeamInMatch, lineup };
                              return isHome ? { ...prev, homeTeam: updated } : { ...prev, awayTeam: updated };
                            });
                          }}
                          className="px-1.5 py-0.5 text-[6px] border border-vga-green bg-vga-black text-vga-light-green hover:bg-vga-green/20 font-bold ml-auto"
                        >AUTO-11</button>
                        <button
                          onClick={() => {
                            setMatch(prev => {
                              if (!prev) return null;
                              const isHome = prev.homeTeam.id === league.userTeamId;
                              const updated = { ...userTeamInMatch, tacticalDiscipline: !(userTeamInMatch.tacticalDiscipline ?? true) };
                              return isHome ? { ...prev, homeTeam: updated } : { ...prev, awayTeam: updated };
                            });
                          }}
                          className={`px-1.5 py-0.5 text-[6px] border font-bold ${(userTeamInMatch.tacticalDiscipline ?? true) ? 'bg-vga-cyan text-vga-black border-vga-black' : 'bg-vga-magenta text-vga-bright-white border-vga-black'}`}
                        >{(userTeamInMatch.tacticalDiscipline ?? true) ? 'TAC:POS' : 'TAC:LIB'}</button>
                      </div>
                      <PitchDiagram
                        team={liveTeam}
                        selectedSlot={subOutSlotIdx ?? null}
                        onSlotClick={handlePitchClick}
                      />
                      <div className="text-[7px] text-center font-bold uppercase py-0.5 border border-vga-yellow text-vga-yellow">
                        CLIC EN UN TITULAR PARA SUSTITUIR
                      </div>
                    </div>

                    {subOut && (
                      <SwapModal
                        slotPos={subOutSlotPos ?? 'MED'}
                        currentPlayer={liveTeam.players.find(p => p.id === subOut) ?? null}
                        candidates={liveTeam.players.filter(p => !inLineup.has(p.id) && !injuredIds.includes(p.id) && !sentOff.includes(p.id) && (p.injuryWeeksRemaining ?? 0) === 0 && p.suspensionMatches === 0)}
                        inLineup={inLineup}
                        onSelect={(pid) => { performUserSub(subOut!, pid); setSubOut(null); }}
                        onClose={() => setSubOut(null)}
                      />
                    )}

                    <button
                      onClick={() => { setShowSubPanel(false); setSubOut(null); setIsPlaying(true); }}
                      className="bg-vga-blue text-vga-bright-white py-1 px-2 text-[8px] border border-vga-black hover:bg-vga-light-blue font-bold uppercase shrink-0"
                    >
                      CONTINUAR
                    </button>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const rows: [string, string | number, string | number][] = [
                ['Tiros', match.homeShots, match.awayShots],
                ['A puerta', match.homeShotsOnTarget, match.awayShotsOnTarget],
                ['Faltas', match.homeFouls, match.awayFouls],
              ];
              return (
                <div className="mt-4 bg-vga-black border-2 border-vga-gray p-2 text-[8px]">
                  <div className="text-[7px] text-vga-yellow uppercase mb-1 text-center border-b border-vga-gray pb-1">
                    Estadísticas
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 font-mono">
                    {rows.map(([label, h, a]) => (
                      <div key={label} className="contents">
                        <div className="text-vga-light-red text-right">{h}</div>
                        <div className="text-vga-gray text-center text-[7px] uppercase">{label}</div>
                        <div className="text-vga-light-cyan">{a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Alineaciones eliminadas */}
          </div>
        );
      })()}

      <footer className="mt-auto pt-8 text-vga-gray text-[8px] flex flex-col items-center gap-1 uppercase">
        <p>2026 OPENFUTBOL</p>
        <button
          onClick={() => setShowDisclaimer(true)}
          className="text-vga-gray hover:text-vga-bright-white underline decoration-dotted underline-offset-2 mt-1"
        >
          DISCLAIMER
        </button>
        <p className="text-[6px] text-vga-gray/60 text-center max-w-md mt-1 normal-case leading-relaxed">
          Proyecto de fans. Sin afiliación, patrocinio ni aval de ningún club, liga o asociación.
          Todos los derechos de nombres de equipos, jugadores y competiciones pertenecen a sus respectivos dueños.
          Solo usamos nombres como referencia y por temas recreativos. No es un servicio de apuestas.
        </p>
      </footer>
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
    </div>
    </PlayerTooltipProvider>
  );
}

export default App;

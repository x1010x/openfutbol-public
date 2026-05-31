import { useEffect, useMemo, useState } from 'react';
import type { Player, Position, Team } from '../types/game.d.ts';
import type { IncomingOffer } from '../store/leagueStore';
import { computePrice, formatEuros } from '../data/economy';
import { NegotiationModal } from './NegotiationModal';
import { moodStateOf } from '../engine/playerMood';
import { CountryBadge } from './CountryBadge';
import { TeamCrest } from './TeamCrest';
import { PlayerPhoto } from './PlayerPhoto';

interface Props {
  team: Team;
  seasonYear: number;
  currentJornada?: number;
  onToggleForSale: (playerId: string) => void;
  onPlayerClick?: (playerId: string) => void;
  onBack: () => void;
  readOnly?: boolean;
  incomingOffers?: IncomingOffer[];
  teams?: Team[];
  userTeam?: Team;
  windowOpen?: boolean;
  blockedSignings?: string[];
  onAcceptIncomingOffer?: (offerId: string) => void;
  onRejectIncomingOffer?: (offerId: string) => void;
  onCounterIncomingOffer?: (offerId: string, requestedCash: number, requestedPlayerIds: string[]) => void;
  onOffer?: (playerId: string, amount: number) => import('../data/economy').OfferResult;
  onPayClausula?: (playerId: string) => import('../data/economy').OfferResult;
  onSwitchClassic?: () => void;
}

type FilterKey = 'ALL' | 'POR' | 'DEF' | 'MED' | 'EXT' | 'DEL';
type SortKey = 'pos' | 'ovr' | 'age' | 'value' | 'salary' | 'name' | 'goals' | 'assists' | 'minutes' | 'apps';

const FILTERS: { key: FilterKey; label: string; positions: Position[] }[] = [
  { key: 'ALL', label: 'TODO', positions: [] },
  { key: 'POR', label: 'POR',  positions: ['POR'] },
  { key: 'DEF', label: 'DEF',  positions: ['DEF'] },
  { key: 'MED', label: 'MED',  positions: ['MED'] },
  { key: 'EXT', label: 'EXT',  positions: ['AML', 'AMR'] },
  { key: 'DEL', label: 'DEL',  positions: ['DEL'] },
];

const POS_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, AML: 3, AMR: 4, DEL: 5 };
const POS_COLOR: Record<Position, string> = {
  POR: 'text-vga-yellow',
  DEF: 'text-vga-light-cyan',
  MED: 'text-vga-light-green',
  AML: 'text-vga-light-magenta',
  AMR: 'text-vga-light-magenta',
  DEL: 'text-vga-light-red',
};

const MOOD_FACE: Record<number, string> = { 0: ':(', 1: ':/', 2: ':|', 3: ':)', 4: ':D' };
const MOOD_COLOR: Record<number, string> = {
  0: 'text-vga-light-red', 1: 'text-vga-light-red', 2: 'text-vga-yellow',
  3: 'text-vga-light-green', 4: 'text-vga-light-green',
};

const ageFromBirthYear = (birthYear: number | undefined, seasonYear: number): number =>
  birthYear ? Math.max(0, seasonYear - birthYear) : 0;

const ovrOf = (p: Player): number => Math.round(p.current_ability ? p.current_ability / 2 : p.media);

const formIndicator = (stamina: number): { glyph: string; color: string } => {
  if (stamina >= 80) return { glyph: '▲▲', color: 'text-vga-light-green' };
  if (stamina >= 60) return { glyph: '▲',  color: 'text-vga-light-green' };
  if (stamina >= 40) return { glyph: '►',  color: 'text-vga-yellow' };
  return { glyph: '▼', color: 'text-vga-light-red' };
};

const statusOf = (p: Player, inLineup: boolean, listed: boolean): { label: string; color: string } => {
  if ((p.injuryWeeksRemaining ?? 0) > 0) return { label: 'LESIONADO',  color: 'text-vga-light-red' };
  if (p.suspensionMatches > 0)           return { label: 'SUSPENDIDO', color: 'text-vga-light-magenta' };
  if (listed)                            return { label: 'EN MERCADO', color: 'text-vga-yellow' };
  if (inLineup)                          return { label: 'TITULAR',    color: 'text-vga-light-green' };
  return                                        { label: 'ROTACIÓN',   color: 'text-vga-gray' };
};

const initialsOf = (name: string | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Stable hash → hue so each player has a consistent "portrait" color.
const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
};

export const SquadViewCompact = ({
  team,
  seasonYear,
  currentJornada,
  onToggleForSale,
  onPlayerClick,
  onBack,
  readOnly = false,
  incomingOffers,
  teams,
  userTeam,
  windowOpen = false,
  blockedSignings = [],
  onAcceptIncomingOffer,
  onRejectIncomingOffer,
  onCounterIncomingOffer,
  onOffer,
  onPayClausula,
  onSwitchClassic,
}: Props) => {
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('pos');
  const [selectedId, setSelectedId] = useState<string | null>(team.players[0]?.id ?? null);

  const lineupSet = useMemo(() => new Set(team.lineup), [team.lineup]);
  const listedCount = team.players.filter(p => p.forSale).length;
  const offerCountByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of incomingOffers ?? []) {
      const buyer = teams?.find(t => t.id === o.fromTeamId);
      if (!buyer || buyer.budget < o.amount) continue;
      map.set(o.playerId, (map.get(o.playerId) ?? 0) + 1);
    }
    return map;
  }, [incomingOffers, teams, team.id]);
  const totalActiveOffers = useMemo(() => {
    let total = 0;
    for (const n of offerCountByPlayer.values()) total += n;
    return total;
  }, [offerCountByPlayer]);

  const filtered = useMemo(() => {
    const activeFilter = FILTERS.find(f => f.key === filter)!;
    const needle = search.trim().toLowerCase();
    let rows = team.players.slice();
    if (activeFilter.positions.length > 0) {
      rows = rows.filter(p => activeFilter.positions.includes(p.position));
    }
    if (needle) {
      rows = rows.filter(p => (p.name ?? '').toLowerCase().includes(needle));
    }
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'ovr':    return ovrOf(b) - ovrOf(a);
        case 'age':    return ageFromBirthYear(a.birthYear, seasonYear) - ageFromBirthYear(b.birthYear, seasonYear);
        case 'value':  return computePrice(b, seasonYear) - computePrice(a, seasonYear);
        case 'salary': return (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0);
        case 'apps':   return b.seasonStats.appearances - a.seasonStats.appearances;
        case 'goals':  return b.seasonStats.goals - a.seasonStats.goals;
        case 'assists':return b.seasonStats.assists - a.seasonStats.assists;
        case 'minutes':return b.seasonStats.minutes - a.seasonStats.minutes;
        case 'name':   return (a.name ?? '').localeCompare(b.name ?? '');
        case 'pos':
        default: {
          const ap = POS_ORDER[a.position] ?? 99;
          const bp = POS_ORDER[b.position] ?? 99;
          if (ap !== bp) return ap - bp;
          return ovrOf(b) - ovrOf(a);
        }
      }
    });
    return rows;
  }, [team.players, filter, search, sortKey, seasonYear]);

  const selected = team.players.find(p => p.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="w-full flex flex-col gap-2" style={{ maxWidth: 1800, marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Top HUD */}
      <div className="flex items-center justify-between border border-vga-blue bg-vga-black px-3 py-1 text-[8px] uppercase">
        <div className="flex items-center gap-3 text-vga-cyan">
          <span className="text-vga-yellow">[*]</span>
          <span className="text-vga-bright-white truncate max-w-[22ch]">{team.name}</span>
          <span className="text-vga-magenta">|</span>
          <span>Liga {seasonYear}/{(seasonYear + 1) % 100}</span>
          {currentJornada != null && <>
            <span className="text-vga-magenta">|</span>
            <span>Jornada {currentJornada}</span>
          </>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-vga-cyan">CAJA</span>
          <span className="text-vga-yellow font-bold">{formatEuros(team.budget)} €</span>
          <button
            onClick={onSwitchClassic}
            className="text-[7px] px-2 py-0.5 border border-vga-gray text-vga-gray hover:text-vga-yellow hover:border-vga-yellow uppercase"
            title="Vista clásica"
          >
            Clásica
          </button>
          <button
            onClick={onBack}
            className="text-[8px] px-3 py-0.5 bg-vga-red text-vga-bright-white border border-vga-bright-white hover:bg-vga-light-red uppercase font-bold tracking-wider"
          >
            Volver
          </button>
        </div>
      </div>

      {/* Header strip: team summary */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center border border-vga-blue bg-vga-black px-3 py-2">
        <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
        <div className="min-w-0">
          <div className="text-vga-magenta text-[8px] uppercase tracking-widest">Plantilla</div>
          <div className="text-vga-bright-white text-sm uppercase font-bold tracking-wide truncate">{team.name}</div>
        </div>
        <Stat label="Presupuesto" value={formatEuros(team.budget)} color="text-vga-light-green" />
        <Stat label="Jugadores"   value={String(team.players.length)} color="text-vga-light-cyan" />
        <Stat label="En mercado"  value={String(listedCount)} color={listedCount > 0 ? 'text-vga-yellow' : 'text-vga-gray'} />
        <Stat label="Ofertas"     value={String(totalActiveOffers)} color={totalActiveOffers > 0 ? 'text-vga-magenta' : 'text-vga-gray'} />
      </div>

      {/* Filter tabs + search + sort */}
      <div className="flex flex-wrap items-center gap-2 border border-vga-blue bg-vga-black px-3 py-2 text-[8px]">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2 py-1 border ${filter === f.key
                ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
                : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'} uppercase font-bold tracking-wide`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar jugador..."
          className="flex-1 min-w-[140px] bg-vga-black border border-vga-blue text-vga-bright-white px-2 py-1 text-[8px] outline-none focus:border-vga-yellow font-mono"
        />
        <label className="text-vga-gray uppercase">Ordenar</label>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="bg-vga-black border border-vga-blue text-vga-cyan px-2 py-1 text-[8px] uppercase"
        >
          <option value="pos">Posición</option>
          <option value="ovr">OVR</option>
          <option value="age">Edad</option>
          <option value="apps">PG</option>
          <option value="goals">Goles</option>
          <option value="assists">Asistencias</option>
          <option value="minutes">Minutos</option>
          <option value="value">Valor</option>
          <option value="salary">Sueldo</option>
          <option value="name">Nombre</option>
        </select>
      </div>

      {/* Main 2-column: table + inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2 items-stretch">
        {/* Compact table */}
        <div className="border border-vga-blue bg-vga-black flex flex-col min-h-0">
          <div className="grid grid-cols-[1.8rem_1.5rem_minmax(7rem,1.5fr)_2.4rem_2rem_2.4rem_2.4rem_1.8rem_2rem_1.8rem_1.8rem_2.8rem_minmax(5rem,1fr)] gap-x-3 px-3 py-1.5 border-b border-vga-blue text-[7px] uppercase tracking-widest text-vga-magenta">
            <span>#</span>
            <span />
            <span>Jugador</span>
            <span>Pos</span>
            <span className="text-right">Edad</span>
            <span className="text-right">Ovr</span>
            <span className="text-center">Forma</span>
            <span className="text-center">Mor</span>
            <span className="text-right">PG</span>
            <span className="text-right">G</span>
            <span className="text-right">A</span>
            <span className="text-right">Min</span>
            <span className="text-right">Estado</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filtered.length === 0 && (
              <div className="text-vga-gray text-[8px] italic px-3 py-4 text-center">Sin jugadores.</div>
            )}
            {filtered.map(p => {
              const inLineup = lineupSet.has(p.id);
              const ovr = ovrOf(p);
              const age = ageFromBirthYear(p.birthYear, seasonYear);
              const form = formIndicator(p.stamina ?? 99);
              const mood = moodStateOf(p, inLineup);
              const apps = p.seasonStats.appearances;
              const goals = p.seasonStats.goals;
              const assists = p.seasonStats.assists;
              const minutes = p.seasonStats.minutes;
              const status = statusOf(p, inLineup, !!p.forSale);
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  onDoubleClick={() => onPlayerClick?.(p.id)}
                  className={`w-full grid grid-cols-[1.8rem_1.5rem_minmax(7rem,1.5fr)_2.4rem_2rem_2.4rem_2.4rem_1.8rem_2rem_1.8rem_1.8rem_2.8rem_minmax(5rem,1fr)] gap-x-3 px-3 py-1 text-[8px] items-center text-left border-b border-vga-blue/40 last:border-b-0 ${
                    isSelected ? 'bg-vga-blue/30 border-l-2 border-l-vga-yellow' : 'hover:bg-vga-blue/20'
                  }`}
                >
                  <span className="text-vga-yellow font-mono">{p.number ?? '-'}</span>
                  <span>{p.country_code ? <CountryBadge code={p.country_code} size="sm" flagOnly /> : null}</span>
                  <span className="text-vga-bright-white uppercase truncate flex items-center gap-1">
                    <span className="truncate">{p.name ?? '—'}</span>
                    {offerCountByPlayer.has(p.id) && (
                      <span
                        className="text-[7px] px-1 border border-vga-magenta text-vga-magenta font-bold tracking-wider shrink-0 animate-pulse"
                        title={`${offerCountByPlayer.get(p.id)} oferta(s) entrante(s)`}
                      >
                        OFERTA{offerCountByPlayer.get(p.id)! > 1 ? `×${offerCountByPlayer.get(p.id)}` : ''}
                      </span>
                    )}
                  </span>
                  <span className={`${POS_COLOR[p.position] ?? 'text-vga-white'} font-bold uppercase`}>{p.position}</span>
                  <span className="text-right text-vga-gray font-mono">{age}</span>
                  <span className={`text-right font-bold font-mono ${ovr >= 85 ? 'text-vga-light-green' : ovr >= 75 ? 'text-vga-yellow' : 'text-vga-gray'}`}>{ovr}</span>
                  <span className={`text-center font-mono ${form.color}`}>{form.glyph}</span>
                  <span className={`text-center font-mono ${MOOD_COLOR[mood]}`}>{MOOD_FACE[mood]}</span>
                  <span className={`text-right font-mono tabular-nums ${apps > 0 ? 'text-vga-bright-white' : 'text-vga-gray'}`}>{apps}</span>
                  <span className={`text-right font-mono tabular-nums ${goals > 0 ? 'text-vga-light-green' : 'text-vga-gray'}`}>{goals}</span>
                  <span className={`text-right font-mono tabular-nums ${assists > 0 ? 'text-vga-light-cyan' : 'text-vga-gray'}`}>{assists}</span>
                  <span className={`text-right font-mono tabular-nums ${minutes > 0 ? 'text-vga-bright-white' : 'text-vga-gray'}`}>{minutes}</span>
                  <span className={`text-right uppercase ${status.color}`}>{status.label}</span>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-1.5 border-t border-vga-blue text-[7px] uppercase text-vga-gray tracking-wide">
            {filtered.length} jugadores
          </div>
        </div>

        {/* Inspector */}
        <div className="border border-vga-blue bg-vga-black flex flex-col">
          {selected ? <Inspector
            player={selected}
            team={team}
            seasonYear={seasonYear}
            currentJornada={currentJornada}
            inLineup={lineupSet.has(selected.id)}
            readOnly={readOnly}
            onToggleForSale={onToggleForSale}
            onPlayerClick={onPlayerClick}
            incomingOffers={incomingOffers?.filter(o => o.playerId === selected.id && !!teams?.find(t => t.id === o.fromTeamId && t.budget >= o.amount))}
            allTeams={teams}
            userTeam={userTeam}
            windowOpen={windowOpen}
            isBlocked={blockedSignings.some(k => k.endsWith(`:${selected.id}`))}
            onAcceptIncomingOffer={onAcceptIncomingOffer}
            onRejectIncomingOffer={onRejectIncomingOffer}
            onCounterIncomingOffer={onCounterIncomingOffer}
            onOffer={onOffer ? (amount) => onOffer(selected.id, amount) : undefined}
            onPayClausula={onPayClausula ? () => onPayClausula(selected.id) : undefined}
          /> : (
            <div className="p-4 text-[8px] text-vga-gray italic">Selecciona un jugador.</div>
          )}
        </div>
      </div>

    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="text-center px-3">
    <div className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-[11px] font-bold font-mono`}>{value}</div>
  </div>
);

const Inspector = ({
  player, team, seasonYear, currentJornada, inLineup, readOnly, onToggleForSale, onPlayerClick,
  incomingOffers, allTeams, userTeam, windowOpen = false, isBlocked = false,
  onAcceptIncomingOffer, onRejectIncomingOffer, onCounterIncomingOffer, onOffer, onPayClausula,
}: {
  player: Player;
  team: Team;
  seasonYear: number;
  currentJornada?: number;
  inLineup: boolean;
  readOnly: boolean;
  onToggleForSale: (id: string) => void;
  onPlayerClick?: (id: string) => void;
  incomingOffers?: IncomingOffer[];
  allTeams?: Team[];
  userTeam?: Team;
  windowOpen?: boolean;
  isBlocked?: boolean;
  onAcceptIncomingOffer?: (offerId: string) => void;
  onRejectIncomingOffer?: (offerId: string) => void;
  onCounterIncomingOffer?: (offerId: string, requestedCash: number, requestedPlayerIds: string[]) => void;
  onOffer?: (amount: number) => import('../data/economy').OfferResult;
  onPayClausula?: () => import('../data/economy').OfferResult;
}) => {
  const ovr = ovrOf(player);
  const mood = moodStateOf(player, inLineup);
  const value = computePrice(player, seasonYear);
  const stam = player.stamina ?? 99;
  const ss = player.seasonStats;
  const posLabel: Record<string, string> = {
    POR: 'PORTERO', DEF: 'DEFENSA', MED: 'CENTROCAMPISTA',
    AML: 'EXTREMO IZQ.', AMR: 'EXTREMO DCHO.', DEL: 'DELANTERO',
  };
  const status = statusOf(player, inLineup, !!player.forSale);

  return (
    <>
      <div className="p-3 border-b border-vga-blue flex items-center gap-3">
        <TeamCrest colors={team.colors} size="md" teamId={team.id} title={team.name} />
        <div className="min-w-0 flex-1">
          <div className="text-vga-bright-white text-[11px] font-bold uppercase truncate">{player.name}</div>
          <div className={`text-[8px] uppercase ${POS_COLOR[player.position]}`}>{posLabel[player.position] ?? player.position}</div>
        </div>
        {player.country_code && <CountryBadge code={player.country_code} size="lg" flagOnly />}
      </div>

      <PortraitTile player={player} team={team} />

      <div className="p-3 border-b border-vga-blue">
        <BigStat label="OVR" value={String(ovr)} color={ovr >= 85 ? 'text-vga-light-green' : ovr >= 75 ? 'text-vga-yellow' : 'text-vga-cyan'} />
      </div>

      <div className="p-3 border-b border-vga-blue flex flex-col gap-1.5 text-[8px]">
        <Row label="Estado" value={status.label} color={status.color} />
        <Row label="Moral"  value={MOOD_FACE[mood]} color={MOOD_COLOR[mood]} />
        <div className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2">
          <span className="text-vga-gray uppercase">Energía</span>
          <div className="h-1.5 border border-vga-gray flex">
            <div className={`h-full ${stam >= 60 ? 'bg-vga-light-green' : stam >= 30 ? 'bg-vga-yellow' : 'bg-vga-light-red'}`} style={{ width: `${stam}%` }} />
          </div>
          <span className="text-vga-gray font-mono text-right">{Math.round(stam)}%</span>
        </div>
      </div>

      <div className="p-3 border-b border-vga-blue flex flex-col gap-1 text-[8px]">
        <Row label="Sueldo/sem" value={formatEuros(player.contract?.salary ?? 0)}      color="text-vga-gray" />
        <Row label="Sueldo/año" value={formatEuros((player.contract?.salary ?? 0) * 52)} color="text-vga-gray" />
        <Row label="Valor"      value={formatEuros(value)}                              color="text-vga-cyan" />
        {player.contract?.expiration && (
          <Row label="Contrato" value={player.contract.expiration} color="text-vga-gray" />
        )}
      </div>

      {ss && (
        <div className="p-3 border-b border-vga-blue text-[8px]">
          <div className="text-vga-magenta text-[7px] uppercase tracking-widest mb-1">Estadísticas</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <Row label="Partidos" value={String(ss.appearances ?? 0)} color="text-vga-bright-white" />
            <Row label="Goles"    value={String(ss.goals ?? 0)}       color="text-vga-light-green" />
            <Row label="Asist."   value={String(ss.assists ?? 0)}     color="text-vga-light-cyan" />
            <Row label="Amar."    value={String(ss.yellowCards ?? 0)} color="text-vga-yellow" />
            <Row label="Rojas"    value={String(ss.redCards ?? 0)}    color="text-vga-light-red" />
          </div>
        </div>
      )}

      <MarketSection
        player={player}
        team={team}
        seasonYear={seasonYear}
        currentJornada={currentJornada}
        readOnly={readOnly}
        incomingOffers={incomingOffers}
        allTeams={allTeams}
        userTeam={userTeam}
        windowOpen={windowOpen}
        isBlocked={isBlocked}
        onAcceptIncomingOffer={onAcceptIncomingOffer}
        onRejectIncomingOffer={onRejectIncomingOffer}
        onCounterIncomingOffer={onCounterIncomingOffer}
        onOffer={onOffer}
        onPayClausula={onPayClausula}
      />

      <div className="p-3 flex flex-col gap-2 mt-auto">
        {!readOnly && (
          <button
            onClick={() => onToggleForSale(player.id)}
            className={`text-[8px] py-1.5 px-2 border-2 uppercase font-bold tracking-wide ${
              player.forSale
                ? 'bg-vga-yellow text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
                : 'bg-vga-black text-vga-yellow border-vga-yellow hover:bg-vga-yellow/20'
            }`}
          >
            {player.forSale ? 'Retirar del mercado' : 'Poner en venta'}
          </button>
        )}
        <button
          onClick={() => onPlayerClick?.(player.id)}
          className="text-[8px] py-1.5 px-2 border-2 border-vga-bright-white bg-vga-blue text-vga-bright-white uppercase font-bold tracking-wide hover:bg-vga-light-blue"
        >
          Ver detalle
        </button>
      </div>
    </>
  );
};

const MarketSection = ({
  player, team, seasonYear, currentJornada, readOnly, incomingOffers = [], allTeams, userTeam,
  windowOpen, isBlocked, onAcceptIncomingOffer, onRejectIncomingOffer, onCounterIncomingOffer, onOffer, onPayClausula,
}: {
  player: Player;
  team: Team;
  seasonYear: number;
  currentJornada?: number;
  readOnly: boolean;
  incomingOffers?: IncomingOffer[];
  allTeams?: Team[];
  userTeam?: Team;
  windowOpen: boolean;
  isBlocked: boolean;
  onAcceptIncomingOffer?: (offerId: string) => void;
  onRejectIncomingOffer?: (offerId: string) => void;
  onCounterIncomingOffer?: (offerId: string, requestedCash: number, requestedPlayerIds: string[]) => void;
  onOffer?: (amount: number) => import('../data/economy').OfferResult;
  onPayClausula?: () => import('../data/economy').OfferResult;
}) => {
  const price = computePrice(player, seasonYear);
  const clausulaCost = price * 2;
  const [bid, setBid] = useState<number>(price);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterCash, setCounterCash] = useState<number>(0);
  const [counterPlayerIds, setCounterPlayerIds] = useState<Set<string>>(new Set());
  const teamById = (id: string) => allTeams?.find(t => t.id === id);
  const [reviewOfferId, setReviewOfferId] = useState<string | null>(null);
  const closeCounter = () => { setCounterOfferId(null); setCounterCash(0); setCounterPlayerIds(new Set()); };

  // Reset transient state when player changes
  useEffect(() => { setBid(price); setResult(null); setExpanded(false); closeCounter(); }, [player.id, price]);

  const isOwn = !readOnly;
  const showOffers = isOwn && incomingOffers.length > 0;
  const canOffer = !!onOffer && windowOpen && !isBlocked;
  const overBudget = userTeam ? bid > userTeam.budget : false;
  const canPayClausula = !!onPayClausula && windowOpen && (userTeam ? userTeam.budget >= clausulaCost : true);

  if (!showOffers && !onOffer && !onPayClausula) return null;

  const offerCount = incomingOffers.length;
  // Auto-expand when there's a fresh result message so the user sees feedback.
  const isOpen = expanded || !!result;

  return (
    <div className="border-t border-vga-blue">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest hover:bg-vga-blue/20"
      >
        <span className="flex items-center gap-2">
          <span>Mercado</span>
          {showOffers && (
            <span className="bg-vga-yellow text-vga-black px-1 text-[7px] font-bold">
              {offerCount} OFERTA{offerCount === 1 ? '' : 'S'}
            </span>
          )}
        </span>
        <span className="text-vga-cyan text-[8px]">{isOpen ? '▼' : '▶'}</span>
      </button>

      {!isOpen && null}

      {isOpen && showOffers && (
        <div className="p-3 flex flex-col gap-1.5 border-b border-vga-blue">
          <div className="text-vga-cyan text-[7px] uppercase tracking-widest">Ofertas recibidas</div>
          {incomingOffers.map(o => {
            const bidder = teamById(o.fromTeamId);
            const isCountering = counterOfferId === o.id;
            const counterStep = Math.max(100_000, Math.round(price * 0.05 / 100_000) * 100_000);
            const bidderBench = bidder
              ? bidder.players.filter(p => !bidder.lineup.includes(p.id)).sort((a, b) => b.media - a.media)
              : [];
            const counterPlayersValue = [...counterPlayerIds]
              .map(id => bidder?.players.find(p => p.id === id))
              .filter((p): p is Player => Boolean(p))
              .reduce((s, p) => s + computePrice(p, seasonYear), 0);
            const counterTotal = counterCash + counterPlayersValue;
            return (
              <div key={o.id} className="border border-vga-blue text-[7px]">
                <div className="grid grid-cols-[1fr_auto] items-center gap-1 px-2 py-1">
                  <div className="min-w-0">
                    <div className="text-vga-bright-white uppercase truncate">{bidder?.name ?? '—'}</div>
                    <div className="text-vga-light-green font-bold font-mono">{formatEuros(o.amount)}</div>
                  </div>
                  <button
                    onClick={() => setReviewOfferId(o.id)}
                    className="bg-vga-blue text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-bright-white hover:bg-vga-light-blue tracking-wider"
                  >
                    Ver oferta
                  </button>
                </div>
                {isCountering && bidder && (
                  <div className="border-t border-vga-yellow bg-vga-blue/20 p-2 flex flex-col gap-2">
                    <div className="text-[7px] text-vga-yellow font-bold uppercase">Pide a {bidder.name}</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[7px] text-vga-bright-white uppercase">Efectivo:</span>
                      <button onClick={() => setCounterCash(c => Math.max(0, c - counterStep))} className="bg-vga-gray text-vga-black px-1.5 border border-vga-black text-[8px]">−</button>
                      <span className="text-vga-yellow font-bold text-[9px] font-mono min-w-[80px] text-center">{formatEuros(counterCash)}</span>
                      <button onClick={() => setCounterCash(c => c + counterStep)} className="bg-vga-gray text-vga-black px-1.5 border border-vga-black text-[8px]">+</button>
                      <button onClick={() => setCounterCash(0)} className="text-[6px] text-vga-gray border border-vga-gray px-1">0</button>
                      <button onClick={() => setCounterCash(o.amount)} className="text-[6px] text-vga-gray border border-vga-gray px-1">BASE</button>
                    </div>
                    {bidderBench.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[7px] text-vga-bright-white uppercase">Jugadores (máx 2)</div>
                        <div className="max-h-28 overflow-y-auto flex flex-col gap-0.5">
                          {bidderBench.map(p => {
                            const sel = counterPlayerIds.has(p.id);
                            const pPrice = computePrice(p, seasonYear);
                            const canAdd = sel || counterPlayerIds.size < 2;
                            return (
                              <button
                                key={p.id}
                                disabled={!canAdd}
                                onClick={() => setCounterPlayerIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                                  return next;
                                })}
                                className={`flex items-center justify-between px-2 py-0.5 text-[7px] border ${sel ? 'bg-vga-yellow text-vga-black border-vga-black' : canAdd ? 'bg-vga-black text-vga-bright-white border-vga-gray hover:border-vga-yellow' : 'bg-vga-black text-vga-gray border-vga-gray opacity-40 cursor-default'}`}
                              >
                                <span className="truncate"><span className="font-bold mr-1">{p.position}</span>{p.name}</span>
                                <span className="text-vga-cyan ml-2 shrink-0">{p.media} · {formatEuros(pPrice)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[7px]">
                        <span className="text-vga-gray">Total: </span>
                        <span className="text-vga-yellow font-bold font-mono">{formatEuros(counterTotal)}</span>
                        <span className="text-vga-gray ml-1">({Math.round((counterTotal / price) * 100)}%)</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={closeCounter} className="bg-vga-gray text-vga-black px-2 py-1 text-[7px] uppercase border border-vga-black">Cancelar</button>
                        <button
                          onClick={() => { onCounterIncomingOffer!(o.id, counterCash, [...counterPlayerIds]); closeCounter(); }}
                          className="bg-vga-light-green text-vga-black px-2 py-1 text-[7px] uppercase font-bold border border-vga-bright-white hover:bg-vga-bright-white"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isOpen && (onOffer || onPayClausula) && (
        <div className="p-3 flex flex-col gap-2 text-[8px]">
          {!windowOpen && (
            <div className="text-vga-light-red text-[7px] uppercase tracking-wide">Ventana cerrada</div>
          )}
          {isBlocked && windowOpen && (
            <div className="text-vga-yellow text-[7px] uppercase tracking-wide">Bloqueado esta temporada</div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <div className="border border-vga-blue px-2 py-1">
              <div className="text-vga-gray text-[7px] uppercase">Valor</div>
              <div className="text-vga-light-green text-[9px] font-bold font-mono">{formatEuros(price)}</div>
            </div>
            <div className="border border-vga-blue px-2 py-1">
              <div className="text-vga-gray text-[7px] uppercase">Cláusula</div>
              <div className="text-vga-light-magenta text-[9px] font-bold font-mono">{formatEuros(clausulaCost)}</div>
            </div>
          </div>

          {onOffer && (
            <>
              <label className="text-vga-cyan text-[7px] uppercase tracking-widest">Tu oferta (€)</label>
              <input
                type="number"
                min={0}
                step={100000}
                value={bid}
                onChange={e => { setBid(parseInt(e.target.value, 10) || 0); setResult(null); }}
                className="bg-vga-black border border-vga-blue text-vga-bright-white px-2 py-1 text-[9px] font-mono outline-none focus:border-vga-yellow"
              />
              <div className="flex gap-1 flex-wrap">
                {[0.8, 1.0, 1.2, 1.5].map(mult => (
                  <button
                    key={mult}
                    onClick={() => { setBid(Math.round(price * mult)); setResult(null); }}
                    className="px-2 py-0.5 text-[7px] border border-vga-blue text-vga-cyan hover:border-vga-yellow hover:text-vga-yellow uppercase"
                  >
                    {Math.round(mult * 100)}%
                  </button>
                ))}
              </div>
              {overBudget && <div className="text-vga-light-red text-[7px] uppercase">Supera tu caja</div>}
              <button
                onClick={() => {
                  if (!onOffer) return;
                  const res = onOffer(bid);
                  setResult({ ok: res.accepted, msg: res.message ?? (res.accepted ? '¡Aceptada!' : 'Rechazada.') });
                }}
                disabled={!canOffer || overBudget}
                className={`text-[8px] py-1.5 border-2 uppercase font-bold tracking-wider ${
                  canOffer && !overBudget
                    ? 'bg-vga-yellow text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
                    : 'bg-vga-gray text-vga-black border-vga-gray cursor-not-allowed opacity-60'
                }`}
              >
                Enviar oferta
              </button>
            </>
          )}

          {onPayClausula && (
            <button
              onClick={() => {
                if (!onPayClausula) return;
                const res = onPayClausula();
                setResult({ ok: res.accepted, msg: res.message ?? (res.accepted ? 'Cláusula pagada.' : 'No se pudo pagar.') });
              }}
              disabled={!canPayClausula}
              className={`text-[8px] py-1.5 border-2 uppercase font-bold tracking-wider ${
                canPayClausula
                  ? 'bg-vga-light-magenta text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
                  : 'bg-vga-gray text-vga-black border-vga-gray cursor-not-allowed opacity-60'
              }`}
            >
              Pagar cláusula
            </button>
          )}

          {result && (
            <div className={`text-[7px] uppercase ${result.ok ? 'text-vga-light-green' : 'text-vga-light-red'}`}>
              {result.msg}
            </div>
          )}
        </div>
      )}
      {reviewOfferId && (() => {
        const o = incomingOffers.find(x => x.id === reviewOfferId);
        const buyer = o ? teamById(o.fromTeamId) : undefined;
        if (!o || !buyer) return null;
        return (
          <NegotiationModal
            player={player}
            sellerTeam={team}
            buyerTeam={buyer}
            offer={o}
            seasonYear={seasonYear}
            currentJornada={currentJornada}
            isOwnPlayer={isOwn}
            onAccept={() => onAcceptIncomingOffer?.(o.id)}
            onReject={() => onRejectIncomingOffer?.(o.id)}
            onCounter={onCounterIncomingOffer ? (cash, ids) => onCounterIncomingOffer(o.id, cash, ids) : undefined}
            onClose={() => setReviewOfferId(null)}
          />
        );
      })()}
    </div>
  );
};

// Real player photo when source_id is known and the CDN serves one;
// otherwise a pixel jersey + shirt number rendered with the team kit colors.
const PortraitTile = ({ player, team }: { player: Player; team: Team }) => (
  <div className="p-3 border-b border-vga-blue flex items-center gap-3">
    <div className="relative border-2 border-vga-blue overflow-hidden" style={{ width: 96, height: 96 }}>
      {player.source_id
        ? <PlayerPhoto sourceId={player.source_id} size="xl" className="w-full h-full" />
        : <JerseyArt player={player} team={team} />
      }
    </div>
    <div className="flex-1 min-w-0 text-[8px]">
      <div className="text-vga-gray uppercase tracking-widest">Dorsal</div>
      <div className="text-vga-bright-white text-3xl font-bold font-mono leading-tight">{player.number ?? '-'}</div>
    </div>
  </div>
);

const JerseyArt = ({ player, team }: { player: Player; team: Team }) => {
  const kit = team.colors?.[0] ?? '#333';
  const ink = team.colors?.[1] ?? '#fff';
  const hue = hueFromId(player.id);
  const tint = `hsl(${hue}, 60%, 18%)`;
  return (
    <div className="w-full h-full relative" style={{ background: tint, imageRendering: 'pixelated' }}>
      <div style={{ position: 'absolute', top: 18, left: 8,  width: 18, height: 18, background: kit, border: '2px solid #000' }} />
      <div style={{ position: 'absolute', top: 18, right: 8, width: 18, height: 18, background: kit, border: '2px solid #000' }} />
      <div style={{ position: 'absolute', top: 28, left: 22, right: 22, bottom: 10, background: kit, border: '2px solid #000' }} />
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: ink, fontWeight: 700, fontSize: 28, textShadow: '2px 2px 0 #000',
          fontFamily: 'monospace',
        }}
      >
        {player.number ?? '-'}
      </div>
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0,
          background: '#000', color: '#ffff55',
          fontSize: 8, padding: '1px 3px', border: '1px solid #aaaaaa',
          fontFamily: 'monospace', fontWeight: 700,
        }}
      >
        {initialsOf(player.name)}
      </div>
    </div>
  );
};

const BigStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="border border-vga-blue px-2 py-2 text-center">
    <div className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</div>
    <div className={`${color} text-2xl font-bold leading-tight font-mono`}>{value}</div>
  </div>
);

const Row = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex justify-between gap-2 text-[8px]">
    <span className="text-vga-gray uppercase">{label}</span>
    <span className={`${color} font-mono uppercase truncate`}>{value}</span>
  </div>
);

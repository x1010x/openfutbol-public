import { useState, useMemo } from 'react';
import type { Player, Position, Team } from '../types/game.d.ts';
import { PlayerName } from './PlayerName';
import type { TransferRecord } from '../store/leagueStore';
import { signingBlockKey } from '../store/leagueStore';
import { computePrice, formatEuros, offerStep, playerAge } from '../data/economy';
import type { OfferResult } from '../data/economy';
import { PlayerPhoto } from './PlayerPhoto';
import { MessageModal } from './MessageModal';
import { useT } from '../i18n';

interface Props {
  userTeam: Team;
  rivalTeams: Team[];
  freeAgents: Player[];
  seasonYear: number;
  currentJornada: number;
  transferLog: TransferRecord[];
  onOffer: (playerId: string, fromTeamId: string, amount: number, offeredPlayerIds: string[]) => OfferResult;
  onOfferFreeAgent: (playerId: string, amount: number) => OfferResult;
  onClausula: (playerId: string, fromTeamId: string) => OfferResult;
  onPlayerClick?: (playerId: string) => void;
  blockedSignings: string[];
  windowOpen: boolean;
  windowJornadasLeft: number;
  jornadasUntilOpen: number;
  onBack: () => void;
}

const BAND_SIZE = 5;
const BAND_THRESHOLDS = [170, 160, 150, 140, 130, 0]; // CA bands (last = catch-all)

const playerCa = (p: Player): number => p.current_ability ?? Math.round((p.media ?? 50) * 2);
// 0-100 OVR (Media scale) — derived from the 1-200 CA so it lines up with the rest of the UI.
const playerOvr = (p: Player): number => Math.round(playerCa(p) / 2);

// Deterministic shuffle so the same jornada always shows the same rotation.
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  let s = (seed * 2654435761) >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

interface MarketEntry {
  player: Player;
  teamName: string;
  teamId: string | null;
  isFreeAgent: boolean;
}

const POSITION_ORDER: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, AML: 3, AMR: 3, DEL: 4 };


const OfferModal = ({
  entry,
  seasonYear,
  userBudget,
  userPlayers,
  onCancel,
  onSubmit,
}: {
  entry: MarketEntry;
  seasonYear: number;
  userBudget: number;
  userPlayers: Player[];
  onCancel: () => void;
  onSubmit: (amount: number, offeredPlayerIds: string[]) => void;
}) => {
  const t = useT();
  const price = computePrice(entry.player, seasonYear);
  const [offer, setOffer] = useState<number>(price);
  const [selectedOffered, setSelectedOffered] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const step = offerStep(price);
  const adjust = (delta: number) => setOffer(prev => Math.max(0, prev + delta));

  const toggleOffered = (id: string) => {
    setSelectedOffered(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortedSquad = useMemo(
    () => [...userPlayers].sort((a, b) => {
      const pa = POSITION_ORDER[a.position] ?? 99;
      const pb = POSITION_ORDER[b.position] ?? 99;
      if (pa !== pb) return pa - pb;
      return playerCa(b) - playerCa(a);
    }),
    [userPlayers]
  );

  const offeredValue = sortedSquad
    .filter(p => selectedOffered.has(p.id))
    .reduce((s, p) => s + computePrice(p, seasonYear), 0);
  const totalValue = offer + offeredValue;
  const tooExpensive = offer > userBudget;
  // Net squad change: +1 (incoming) - N (outgoing). Need >= 11 to keep lineup viable.
  const wouldBeUnderMin = (userPlayers.length + 1 - selectedOffered.size) < 11;
  const canSwap = !entry.isFreeAgent;

  return (
    <div onClick={onCancel} className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={(e) => e.stopPropagation()} className="max-w-sm w-full border-4 border-vga-bright-white bg-vga-blue shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-y-auto">
        <div className="bg-vga-black px-3 py-2 text-center border-b-2 border-vga-bright-white">
          <div className="text-vga-yellow text-[10px] uppercase font-bold">{t('misc.offerFor')}</div>
          <div className="text-vga-bright-white text-[12px] mt-1">
            <span className="text-vga-yellow mr-2">{entry.player.position}</span><PlayerName player={entry.player} />
          </div>
          <div className="text-[8px] text-vga-cyan mt-1">{entry.isFreeAgent ? t('label.freeAgent') : entry.teamName} · {t('misc.totalValueOf', { amount: formatEuros(price) })}</div>
        </div>
        <div className="p-3 flex flex-col gap-3 text-vga-bright-white">
          <div className="text-[7px] text-vga-cyan uppercase text-center">{t('label.cash')}</div>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => adjust(-step)} className="bg-vga-red text-vga-bright-white px-3 py-1 border border-black text-[10px]">−</button>
            <span className="text-vga-yellow font-bold text-[14px] min-w-[140px] text-center">{formatEuros(offer)}</span>
            <button onClick={() => adjust(step)} className="bg-vga-green text-vga-bright-white px-3 py-1 border border-black text-[10px]">+</button>
          </div>
          <div className="flex justify-center gap-1 text-[7px]">
            <button onClick={() => setOffer(Math.round(price * 0.8 / 100_000) * 100_000)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">80%</button>
            <button onClick={() => setOffer(price)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">{t('btn.base')}</button>
            <button onClick={() => setOffer(Math.round(price * 1.5 / 100_000) * 100_000)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">+50%</button>
            <button onClick={() => setOffer(price * 2)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">{t('btn.double')}</button>
          </div>

          {canSwap && (
            <div className="border border-vga-magenta">
              <button
                onClick={() => setPickerOpen(o => !o)}
                className="w-full bg-vga-black text-vga-magenta px-2 py-1 text-[8px] uppercase font-bold flex justify-between items-center"
              >
                <span>{t('misc.includePlayers', { n: String(selectedOffered.size) })}</span>
                <span>{pickerOpen ? '−' : '+'}</span>
              </button>
              {pickerOpen && (
                <div className="bg-vga-black border-t border-vga-magenta p-2 max-h-44 overflow-y-auto flex flex-col gap-1">
                  {sortedSquad.length === 0 && (
                    <div className="text-[7px] text-vga-gray">{t('misc.squadEmpty')}</div>
                  )}
                  {sortedSquad.map(p => {
                    const checked = selectedOffered.has(p.id);
                    const pPrice = computePrice(p, seasonYear);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleOffered(p.id)}
                        className={`text-left px-2 py-1 text-[8px] border ${checked ? 'bg-vga-magenta text-vga-bright-white border-vga-bright-white' : 'bg-vga-blue text-vga-bright-white border-vga-gray'}`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="min-w-0 truncate">
                            <span className="text-vga-yellow font-bold mr-1">{p.position}</span>
                            <PlayerName player={p} />
                            <span className="text-vga-cyan ml-2 text-[7px]">CA {playerCa(p)} · {playerAge(p, seasonYear)}a</span>
                          </span>
                          <span className="text-vga-light-green text-[8px] shrink-0">{formatEuros(pPrice)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedOffered.size > 0 && (
                <div className="bg-vga-black border-t border-vga-magenta px-2 py-1 text-[7px] text-vga-light-cyan">
                  {t('misc.playersOffered', { amount: formatEuros(offeredValue) })}
                </div>
              )}
            </div>
          )}

          <div className="bg-vga-black border border-vga-yellow p-2 text-center">
            <div className="text-[7px] text-vga-yellow uppercase">{t('misc.total')}</div>
            <div className="text-vga-bright-white text-[14px] font-bold">{formatEuros(totalValue)}</div>
            <div className="text-[7px] text-vga-cyan mt-1">
              {t('misc.pctOfPlayerValue', { pct: String(Math.round((totalValue / Math.max(price, 1)) * 100)) })}
            </div>
          </div>

          <div className="text-[7px] text-vga-cyan text-center">
            {t('misc.offerHint')}
          </div>
        </div>
        <div className="bg-vga-black p-2 border-t-2 border-vga-bright-white flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-vga-red text-vga-bright-white py-2 text-[9px] border border-vga-bright-white">{t('btn.cancel')}</button>
          <button
            onClick={() => onSubmit(offer, [...selectedOffered])}
            disabled={tooExpensive || wouldBeUnderMin}
            className={`flex-1 py-2 text-[9px] border ${
              tooExpensive || wouldBeUnderMin
                ? 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed border-vga-black'
                : 'bg-vga-green text-vga-bright-white hover:bg-vga-light-green border-vga-bright-white'
            }`}
          >
            {tooExpensive ? t('misc.noBudget') : wouldBeUnderMin ? t('misc.shortSquad') : t('btn.sendOffer')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ClausulaModal = ({
  entry,
  seasonYear,
  userBudget,
  onConfirm,
  onCancel,
}: {
  entry: MarketEntry;
  seasonYear: number;
  userBudget: number;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const t = useT();
  const price = computePrice(entry.player, seasonYear);
  const clausulaCost = price * 2;
  const canAfford = userBudget >= clausulaCost;
  return (
    <div onClick={onCancel} className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={(e) => e.stopPropagation()} className="max-w-xs w-full border-4 border-vga-light-red bg-vga-blue shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="bg-vga-red px-3 py-2 text-center border-b-2 border-vga-bright-white">
          <div className="text-vga-bright-white text-[10px] uppercase font-bold">{t('misc.clausulazoFull')}</div>
          <div className="text-vga-bright-white text-[12px] mt-1">
            <span className="text-vga-yellow mr-2">{entry.player.position}</span><PlayerName player={entry.player} />
          </div>
          <div className="text-[8px] text-vga-bright-white mt-1 opacity-80">{entry.teamName}</div>
        </div>
        <div className="p-3 flex flex-col gap-3 text-vga-bright-white text-[8px]">
          <div className="bg-vga-black border border-vga-light-red p-2 text-center">
            <div className="text-vga-gray uppercase text-[7px]">{t('misc.clausulazoCost')}</div>
            <div className="text-vga-light-red font-bold text-[16px]">{formatEuros(clausulaCost)}</div>
            <div className="text-[7px] text-vga-gray mt-1 flex justify-center gap-3">
              <span>{t('misc.clausulazoNote', { amount: formatEuros(price) })}</span>
              <span className="text-vga-light-red">{t('misc.clausulazoFee', { amount: formatEuros(price) })}</span>
            </div>
          </div>
          <div className="text-vga-yellow text-[7px] text-center">
            {t('misc.clausulazoDirectTransfer')}
          </div>
          {!canAfford && (
            <div className="bg-vga-red/40 border border-vga-light-red p-1 text-center text-[7px] text-vga-light-red font-bold">
              {t('misc.noBudgetNeed', { amount: formatEuros(clausulaCost - userBudget) })}
            </div>
          )}
        </div>
        <div className="bg-vga-black p-2 border-t-2 border-vga-bright-white flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-vga-gray text-vga-black py-2 text-[9px] border border-vga-bright-white">{t('btn.cancel')}</button>
          <button
            onClick={canAfford ? onConfirm : undefined}
            disabled={!canAfford}
            className={`flex-1 py-2 text-[9px] border font-bold ${canAfford ? 'bg-vga-red text-vga-bright-white hover:bg-vga-light-red border-vga-bright-white' : 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed border-vga-black'}`}
          >
            {canAfford ? t('btn.executeClausula') : t('misc.noBudget')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TransfersView = ({
  userTeam,
  rivalTeams,
  freeAgents,
  seasonYear,
  currentJornada,
  transferLog,
  onOffer,
  onOfferFreeAgent,
  onClausula,
  onPlayerClick,
  blockedSignings,
  windowOpen,
  windowJornadasLeft,
  jornadasUntilOpen,
  onBack,
}: Props) => {
  const t = useT();
  const blockedSet = new Set(blockedSignings);
  const [offerEntry, setOfferEntry] = useState<MarketEntry | null>(null);
  const [clausulaEntry, setClausulaEntry] = useState<MarketEntry | null>(null);
  const [lastResult, setLastResult] = useState<{ accepted: boolean; message: string; playerName: string } | null>(null);
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'all' | 'listed' | 'free' | 'rival'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'ovr' | 'age' | 'pos' | 'club'>('price');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listedEntries: MarketEntry[] = rivalTeams.flatMap(rival =>
    rival.players
      .filter(p => p.forSale && !blockedSet.has(signingBlockKey(rival.id, p.id)))
      .map(p => ({ player: p, teamName: rival.name, teamId: rival.id, isFreeAgent: false }))
  );
  const freeAgentEntries: MarketEntry[] = freeAgents
    .filter(p => { const a = playerAge(p, seasonYear); return a >= 17 && a <= 40; })
    .map(p => ({ player: p, teamName: 'LIBRE', teamId: null, isFreeAgent: true }));

  // Pick up to BAND_SIZE free agents from each rating band, deterministic per jornada.
  const seed = seasonYear * 100 + currentJornada;
  const rotatedFreeAgents: MarketEntry[] = [];
  for (let b = 0; b < BAND_THRESHOLDS.length; b++) {
    const min = BAND_THRESHOLDS[b];
    const max = b === 0 ? 99 : BAND_THRESHOLDS[b - 1] - 1;
    const band = freeAgentEntries.filter(e => playerCa(e.player) >= min && playerCa(e.player) <= max);
    rotatedFreeAgents.push(...seededShuffle(band, seed + b).slice(0, BAND_SIZE));
  }
  // Include all rival players so the table is a one-stop shop (listed + free agents + rival rosters)
  const rivalRosterEntries: MarketEntry[] = rivalTeams.flatMap(rival =>
    rival.players
      .filter(p => !p.forSale && !blockedSet.has(signingBlockKey(rival.id, p.id)))
      .map(p => ({ player: p, teamName: rival.name, teamId: rival.id, isFreeAgent: false }))
  );

  const marketEntries: MarketEntry[] = [...listedEntries, ...rotatedFreeAgents, ...rivalRosterEntries];

  const filtered = marketEntries
    .filter(e => {
      // 'all' shows only actually-available players (en venta + libres). Rivals
      // not for sale are clausulazo candidates and only show under that tab.
      if (typeFilter === 'all') return e.isFreeAgent || e.player.forSale;
      if (typeFilter === 'free') return e.isFreeAgent;
      if (typeFilter === 'listed') return !e.isFreeAgent && e.player.forSale;
      if (typeFilter === 'rival') return !e.isFreeAgent && !e.player.forSale;
      return true;
    })
    .filter(e => posFilter === 'ALL' || e.player.position === posFilter)
    .filter(e => !search.trim() || e.player.name.toLowerCase().includes(search.trim().toLowerCase()) || e.teamName.toLowerCase().includes(search.trim().toLowerCase()));

  const sorted = useMemo(() => {
    const out = [...filtered];
    if (sortBy === 'price') out.sort((a, b) => computePrice(b.player, seasonYear) - computePrice(a.player, seasonYear));
    else if (sortBy === 'ovr') out.sort((a, b) => playerCa(b.player) - playerCa(a.player));
    else if (sortBy === 'age') out.sort((a, b) => playerAge(a.player, seasonYear) - playerAge(b.player, seasonYear));
    else if (sortBy === 'pos') out.sort((a, b) => (POSITION_ORDER[a.player.position] ?? 99) - (POSITION_ORDER[b.player.position] ?? 99));
    else if (sortBy === 'club') out.sort((a, b) => a.teamName.localeCompare(b.teamName));
    return out;
  }, [filtered, sortBy, seasonYear]);

  const selected = sorted.find(e => e.player.id === selectedId) ?? null;

  const submitOffer = (entry: MarketEntry, amount: number, offeredPlayerIds: string[]) => {
    const result = entry.isFreeAgent
      ? onOfferFreeAgent(entry.player.id, amount)
      : onOffer(entry.player.id, entry.teamId!, amount, offeredPlayerIds);
    setLastResult({ accepted: result.accepted, message: result.message, playerName: entry.player.name });
    if (result.accepted) setOfferEntry(null);
  };

  // ── Render ──
  const PanelTitle = ({ title, accent = 'text-vga-magenta', right }: { title: string; accent?: string; right?: React.ReactNode }) => (
    <div className={`${accent} text-[9px] uppercase tracking-widest px-2 py-1 border-b border-vga-blue flex items-center justify-between`}>
      <span>{title}</span>
      {right}
    </div>
  );

  const seasonTransfers = transferLog.filter(r => r.year === seasonYear);

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header strip */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-vga-magenta text-[10px] uppercase tracking-widest">Mercado de Fichajes</span>
          <span className="text-vga-bright-white text-[11px] font-bold">{userTeam.name}</span>
          <span className="text-vga-gray text-[8px]">J{currentJornada} · {seasonYear}</span>
          {windowOpen ? (
            <span className="text-[8px] px-2 py-0.5 border border-vga-light-green text-vga-light-green uppercase">Abierto · {windowJornadasLeft}J</span>
          ) : (
            <span className="text-[8px] px-2 py-0.5 border border-vga-light-red text-vga-light-red uppercase">Cerrado{jornadasUntilOpen < 900 ? ` · vuelve en ${jornadasUntilOpen}J` : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-vga-gray text-[7px] uppercase">Presupuesto</div>
            <div className="text-vga-light-green text-[11px] font-bold">{formatEuros(userTeam.budget)}</div>
          </div>
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red font-bold">
            {t('btn.back')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-3">
        {/* Left column: filters + table */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Filters bar */}
          <div className="bg-vga-black border border-vga-blue flex flex-wrap items-center gap-1 p-2">
            {(['all', 'listed', 'free'] as const).map(type => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`text-[8px] px-2 py-0.5 border font-bold uppercase ${typeFilter === type ? 'bg-vga-yellow text-vga-black border-vga-yellow' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}>
                {type === 'all' ? 'Todo' : type === 'listed' ? 'En venta' : 'Libres'}
              </button>
            ))}
            <span className="text-vga-gray text-[7px] mx-1">|</span>
            {(['ALL', 'POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'] as const).map(p => (
              <button key={p} onClick={() => setPosFilter(p)}
                className={`text-[8px] px-2 py-0.5 border font-bold ${posFilter === p ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}>
                {p}
              </button>
            ))}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar jugador o equipo..."
              className="ml-auto bg-vga-black border border-vga-blue text-vga-bright-white text-[9px] px-2 py-1 w-56 placeholder:text-vga-gray focus:outline-none focus:border-vga-cyan"
            />
          </div>

          {/* Player table */}
          <div className="bg-vga-black border border-vga-blue overflow-hidden">
            <PanelTitle title={`Bolsa de fichajes · ${sorted.length} jugadores`} />
            <div className="max-h-[70vh] overflow-y-auto">
              <table className="w-full text-[9px] tabular-nums">
                <thead className="bg-vga-black sticky top-0">
                  <tr className="text-vga-magenta text-[7px] uppercase">
                    <th className="text-left pl-2 py-1 cursor-pointer hover:text-vga-bright-white" onClick={() => setSortBy('pos')}>POS</th>
                    <th className="text-left">Jugador</th>
                    <th className="text-right cursor-pointer hover:text-vga-bright-white" onClick={() => setSortBy('age')}>Edad</th>
                    <th className="text-right cursor-pointer hover:text-vga-bright-white" onClick={() => setSortBy('ovr')}>OVR</th>
                    <th className="text-right">G/A</th>
                    <th className="text-left pl-2 cursor-pointer hover:text-vga-bright-white" onClick={() => setSortBy('club')}>Club</th>
                    <th className="text-right pr-2 cursor-pointer hover:text-vga-bright-white" onClick={() => setSortBy('price')}>Precio</th>
                    <th className="text-center pr-2">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-vga-gray text-[8px] p-4">{t('misc.noPlayersFilter')}</td></tr>
                  ) : sorted.map(e => {
                    const p = e.player;
                    const price = computePrice(p, seasonYear);
                    const isSelected = p.id === selectedId;
                    const isChollo = !e.isFreeAgent && price < (p.current_ability ?? 100) * 100_000 * 0.5;
                    const isStar = playerCa(p) >= 170;
                    const tag = e.isFreeAgent ? <span className="text-vga-light-green">LIBRE</span>
                              : p.forSale ? <span className="text-vga-yellow">VENTA</span>
                              : <span className="text-vga-cyan">RIVAL</span>;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`cursor-pointer ${isSelected ? 'bg-vga-blue/40 text-vga-bright-white' : 'text-vga-bright-white hover:bg-vga-blue/20'}`}
                      >
                        <td className="pl-2 py-0.5 text-vga-magenta">{p.position}</td>
                        <td className="truncate max-w-[200px]">
                          <PlayerName player={p} />
                          {isStar && <span className="ml-1 text-vga-yellow">★</span>}
                          {isChollo && <span className="ml-1 text-[7px] text-vga-light-green border border-vga-light-green px-0.5">CHOLLO</span>}
                        </td>
                        <td className="text-right text-vga-gray">{playerAge(p, seasonYear)}</td>
                        <td className="text-right text-vga-light-green font-bold">{playerOvr(p)}</td>
                        <td className="text-right text-vga-cyan text-[8px]">{p.seasonStats.goals}/{p.seasonStats.assists}</td>
                        <td className="pl-2 truncate max-w-[140px] text-vga-cyan">{e.teamName}</td>
                        <td className="text-right pr-2 text-vga-light-green font-bold">
                          {e.isFreeAgent ? <span className="text-vga-gray">GRATIS</span> : formatEuros(price)}
                        </td>
                        <td className="text-center pr-2 text-[8px]">{tag}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: inspector + market activity */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Inspector */}
          <div className="bg-vga-black border border-vga-blue">
            <PanelTitle title="Ficha" />
            {!selected ? (
              <div className="p-3 text-vga-gray text-[8px]">Selecciona un jugador para ver su ficha y opciones de fichaje.</div>
            ) : (() => {
              const p = selected.player;
              const price = computePrice(selected.player, seasonYear);
              const blocked = !selected.isFreeAgent && selected.teamId ? blockedSet.has(signingBlockKey(selected.teamId, p.id)) : false;
              return (
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <PlayerPhoto sourceId={p.source_id} size="xl" className="border border-vga-blue" />
                    <div className="min-w-0 flex-1">
                      <div className="text-vga-bright-white text-[11px] truncate"><PlayerName player={p} /></div>
                      <div className="text-vga-cyan text-[8px] truncate">#{p.number} · {p.position}</div>
                      {selected.isFreeAgent
                        ? <div className="text-vga-light-green text-[7px] uppercase">Libre</div>
                        : p.forSale ? <div className="text-vga-yellow text-[7px] uppercase">En venta</div>
                        : <div className="text-vga-cyan text-[7px] uppercase">Cláusula disponible</div>}
                    </div>
                  </div>
                  <div className="text-[9px] grid grid-cols-2 gap-y-0.5">
                    <span className="text-vga-gray">OVR</span><span className="text-vga-light-green font-bold text-right">{playerOvr(p)}</span>
                    <span className="text-vga-gray">Edad</span><span className="text-right">{playerAge(p, seasonYear)}</span>
                    <span className="text-vga-gray">Posición</span><span className="text-vga-magenta text-right">{p.position}</span>
                    <span className="text-vga-gray">Club</span><span className="text-vga-cyan text-right truncate">{selected.teamName}</span>
                    <span className="text-vga-gray">Sueldo</span><span className="text-right">{formatEuros(p.contract?.salary ?? 0)}</span>
                    <span className="text-vga-gray">Valor</span><span className="text-vga-light-green font-bold text-right">{formatEuros(price)}</span>
                    <span className="text-vga-gray">G / A</span><span className="text-right">{p.seasonStats.goals} / {p.seasonStats.assists}</span>
                    <span className="text-vga-gray">TA / TR</span><span className="text-right">{p.seasonStats.yellowCards} / {p.seasonStats.redCards}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1 border-t border-vga-blue">
                    {!windowOpen ? (
                      <div className="text-vga-gray text-[8px] text-center py-1 border border-vga-gray uppercase">{t('transfer.windowClosed')}</div>
                    ) : blocked ? (
                      <div className="text-vga-gray text-[8px] text-center py-1 border border-vga-gray uppercase">{t('misc.blocked')}</div>
                    ) : (
                      <>
                        {selected.isFreeAgent ? (
                          <button
                            onClick={() => { onOfferFreeAgent(p.id, 0); }}
                            className="bg-vga-light-green hover:bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-bold uppercase"
                          >
                            Negociar contrato
                          </button>
                        ) : !(selected.player.forSale === false && !selected.isFreeAgent && selected.teamId) && (
                          <button onClick={() => setOfferEntry(selected)} className="bg-vga-green hover:bg-vga-light-green text-vga-bright-white text-[9px] px-2 py-1 border border-vga-black font-bold uppercase">
                            {t('btn.makeOffer')}
                          </button>
                        )}
                        {!selected.isFreeAgent && selected.teamId && (
                          <button onClick={() => setClausulaEntry(selected)} className="bg-vga-red hover:bg-vga-light-red text-vga-bright-white text-[9px] px-2 py-1 border border-vga-black font-bold uppercase">
                            {t('misc.clausulazo')}
                          </button>
                        )}
                        {onPlayerClick && (
                          <button onClick={() => onPlayerClick(p.id)} className="bg-vga-black hover:bg-vga-blue text-vga-cyan text-[8px] px-2 py-1 border border-vga-cyan uppercase">
                            Ver ficha completa
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Market activity feed */}
          <div className="bg-vga-black border border-vga-blue flex flex-col flex-1 min-h-0">
            <PanelTitle title={`Actividad del mercado · ${seasonTransfers.length}`} />
            <div className="overflow-y-auto max-h-[50vh] p-2 flex flex-col gap-0.5">
              {seasonTransfers.length === 0 ? (
                <div className="text-vga-gray text-[9px] p-3 text-center">Aún no hay movimientos esta temporada.</div>
              ) : seasonTransfers.map(r => {
                const isUserIn = r.toTeamName === userTeam.name;
                const isUserOut = r.fromTeamName === userTeam.name;
                const nameColor = r.kind === 'retirement' ? 'text-vga-gray'
                  : isUserIn ? 'text-vga-light-green'
                  : isUserOut ? 'text-vga-light-cyan'
                  : 'text-vga-bright-white';
                const isRetire = r.kind === 'retirement';
                return (
                  <div key={r.id} className="px-2 py-1.5 border-b border-vga-blue/30 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="text-vga-magenta text-[9px] w-8 shrink-0 font-bold">J{r.jornada}</span>
                      <span className={`flex-1 truncate text-[11px] font-bold ${nameColor}`}>
                        {r.playerName}
                        {isRetire && r.retirementAge ? <span className="text-vga-gray text-[8px] font-normal"> · {r.retirementAge}a</span> : null}
                      </span>
                      {r.amount > 0 && <span className="text-vga-light-green text-[10px] tabular-nums shrink-0 font-bold">{formatEuros(r.amount)}</span>}
                    </div>
                    <div className="pl-10 flex flex-col gap-0.5 mt-0.5">
                      {isRetire ? (
                        <div className="text-[9px] text-vga-gray truncate">
                          <span className="text-vga-magenta text-[7px] uppercase mr-1">Retiro</span>{r.fromTeamName ?? '—'}
                        </div>
                      ) : (
                        <>
                          <div className="text-[9px] truncate">
                            <span className="text-vga-magenta text-[7px] uppercase mr-1">de</span>
                            <span className="text-vga-light-cyan">{r.fromTeamName ?? 'Libre'}</span>
                          </div>
                          <div className="text-[9px] truncate">
                            <span className="text-vga-magenta text-[7px] uppercase mr-1">a</span>
                            <span className="text-vga-light-green">{r.toTeamName}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {offerEntry && (
        <OfferModal
          entry={offerEntry}
          seasonYear={seasonYear}
          userBudget={userTeam.budget}
          userPlayers={userTeam.players}
          onCancel={() => setOfferEntry(null)}
          onSubmit={(amount, offeredPlayerIds) => submitOffer(offerEntry, amount, offeredPlayerIds)}
        />
      )}

      {clausulaEntry && (
        <ClausulaModal
          entry={clausulaEntry}
          seasonYear={seasonYear}
          userBudget={userTeam.budget}
          onCancel={() => setClausulaEntry(null)}
          onConfirm={() => {
            const result = onClausula(clausulaEntry.player.id, clausulaEntry.teamId!);
            setLastResult({ accepted: result.accepted, message: result.message, playerName: clausulaEntry.player.name });
            setClausulaEntry(null);
          }}
        />
      )}

      {lastResult && (
        <MessageModal
          title={lastResult.accepted ? t('misc.offerAccepted') : t('misc.offerRejected')}
          subtitle={lastResult.playerName}
          tone={lastResult.accepted ? 'success' : 'danger'}
          onClose={() => setLastResult(null)}
        >
          <div className="text-center">{lastResult.message}</div>
        </MessageModal>
      )}
    </div>
  );
};

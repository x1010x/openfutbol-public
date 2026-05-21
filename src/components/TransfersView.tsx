import { useState, useMemo } from 'react';
import type { Player, Position, Team } from '../types/game.d.ts';
import type { TransferRecord } from '../store/leagueStore';
import { signingBlockKey } from '../store/leagueStore';
import { computePrice, formatEuros, offerStep, playerAge } from '../data/economy';
import type { OfferResult } from '../data/economy';
import { PlayerCard } from './PlayerCard';
import { MessageModal } from './MessageModal';

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
  onBack: () => void;
}

const BAND_SIZE = 5;
const BAND_THRESHOLDS = [85, 80, 75, 70, 65, 0]; // top edge of each band (last = catch-all)

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

const sortPlayers = (players: Player[]) =>
  [...players].sort((a, b) => {
    const pa = POSITION_ORDER[a.position] ?? 99;
    const pb = POSITION_ORDER[b.position] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.media - a.media;
  });

const TransferRankRow = ({ rank, record }: { rank: number; record: TransferRecord }) => (
  <div className="bg-vga-black border border-vga-gray px-2 py-1 text-[8px] flex items-center gap-2">
    <span className="text-vga-yellow font-bold w-5 text-right shrink-0">{rank}.</span>
    <span className="text-[7px] text-vga-cyan shrink-0">{record.playerPosition}</span>
    <span className="text-vga-bright-white flex-1 truncate min-w-0">{record.playerName}</span>
    <span className="text-[7px] text-vga-gray shrink-0 truncate hidden sm:block max-w-[160px]">
      {record.fromTeamName ?? 'LIBRE'} → {record.toTeamName}
    </span>
    <span className="text-vga-light-green font-bold shrink-0">{formatEuros(record.amount)}</span>
  </div>
);

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
      return b.media - a.media;
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
          <div className="text-vga-yellow text-[10px] uppercase font-bold">OFERTA POR</div>
          <div className="text-vga-bright-white text-[12px] mt-1">
            <span className="text-vga-yellow mr-2">{entry.player.position}</span>{entry.player.name}
          </div>
          <div className="text-[8px] text-vga-cyan mt-1">{entry.isFreeAgent ? 'LIBRE' : entry.teamName} · valor {formatEuros(price)}</div>
        </div>
        <div className="p-3 flex flex-col gap-3 text-vga-bright-white">
          <div className="text-[7px] text-vga-cyan uppercase text-center">Efectivo</div>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => adjust(-step)} className="bg-vga-red text-vga-bright-white px-3 py-1 border border-black text-[10px]">−</button>
            <span className="text-vga-yellow font-bold text-[14px] min-w-[140px] text-center">{formatEuros(offer)}</span>
            <button onClick={() => adjust(step)} className="bg-vga-green text-vga-bright-white px-3 py-1 border border-black text-[10px]">+</button>
          </div>
          <div className="flex justify-center gap-1 text-[7px]">
            <button onClick={() => setOffer(Math.round(price * 0.8 / 100_000) * 100_000)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">80%</button>
            <button onClick={() => setOffer(price)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">BASE</button>
            <button onClick={() => setOffer(Math.round(price * 1.5 / 100_000) * 100_000)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">+50%</button>
            <button onClick={() => setOffer(price * 2)} className="bg-vga-gray text-vga-black px-2 py-0.5 border border-vga-black">DOBLAR</button>
          </div>

          {canSwap && (
            <div className="border border-vga-magenta">
              <button
                onClick={() => setPickerOpen(o => !o)}
                className="w-full bg-vga-black text-vga-magenta px-2 py-1 text-[8px] uppercase font-bold flex justify-between items-center"
              >
                <span>Incluir jugadores ({selectedOffered.size})</span>
                <span>{pickerOpen ? '−' : '+'}</span>
              </button>
              {pickerOpen && (
                <div className="bg-vga-black border-t border-vga-magenta p-2 max-h-44 overflow-y-auto flex flex-col gap-1">
                  {sortedSquad.length === 0 && (
                    <div className="text-[7px] text-vga-gray">Tu plantilla está vacía.</div>
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
                            {p.name}
                            <span className="text-vga-cyan ml-2 text-[7px]">M{p.media} · {playerAge(p, seasonYear)}a</span>
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
                  Jugadores ofrecidos: {formatEuros(offeredValue)}
                </div>
              )}
            </div>
          )}

          <div className="bg-vga-black border border-vga-yellow p-2 text-center">
            <div className="text-[7px] text-vga-yellow uppercase">Valor total</div>
            <div className="text-vga-bright-white text-[14px] font-bold">{formatEuros(totalValue)}</div>
            <div className="text-[7px] text-vga-cyan mt-1">
              {Math.round((totalValue / Math.max(price, 1)) * 100)}% del valor del jugador
            </div>
          </div>

          <div className="text-[7px] text-vga-cyan text-center">
            Sugerencia: ofertas con valor total entre el 70% y el 200% pueden ser aceptadas.
          </div>
        </div>
        <div className="bg-vga-black p-2 border-t-2 border-vga-bright-white flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-vga-red text-vga-bright-white py-2 text-[9px] border border-vga-bright-white">CANCELAR</button>
          <button
            onClick={() => onSubmit(offer, [...selectedOffered])}
            disabled={tooExpensive || wouldBeUnderMin}
            className={`flex-1 py-2 text-[9px] border ${
              tooExpensive || wouldBeUnderMin
                ? 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed border-vga-black'
                : 'bg-vga-green text-vga-bright-white hover:bg-vga-light-green border-vga-bright-white'
            }`}
          >
            {tooExpensive ? 'SIN PRESUPUESTO' : wouldBeUnderMin ? 'PLANTILLA MUY CORTA' : 'ENVIAR OFERTA'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MarketCard = ({
  entry,
  seasonYear,
  onOfferClick,
  onClausulaClick,
  onPlayerClick,
  blocked,
}: {
  entry: MarketEntry;
  seasonYear: number;
  onOfferClick: () => void;
  onClausulaClick?: () => void;
  onPlayerClick?: () => void;
  blocked?: boolean;
}) => {
  const price = computePrice(entry.player, seasonYear);
  const isClausula = !entry.isFreeAgent && !entry.player.forSale && !!onClausulaClick;
  const highlight = entry.isFreeAgent ? 'free' : entry.player.forSale ? 'listed' : 'rival';
  return (
    <PlayerCard
      player={entry.player}
      seasonYear={seasonYear}
      highlight={highlight}
      onNameClick={onPlayerClick}
      footer={
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-[7px]">
            <span className={entry.isFreeAgent ? 'text-vga-light-green font-bold' : 'text-vga-cyan truncate'}>
              {entry.isFreeAgent ? 'LIBRE' : entry.teamName}
            </span>
            <span className="font-bold text-[9px] text-vga-light-green">
              {formatEuros(price)}
            </span>
          </div>
          {blocked ? (
            <button disabled className="w-full px-2 py-1 text-[8px] border border-vga-black bg-vga-gray text-vga-black opacity-60 cursor-not-allowed">
              BLOQUEADO
            </button>
          ) : onClausulaClick && !entry.isFreeAgent ? (
            <div className="flex gap-1">
              {!isClausula && (
                <button onClick={onOfferClick} className="flex-1 px-1 py-1 text-[8px] border border-vga-black bg-vga-green text-vga-bright-white hover:bg-vga-light-green">
                  OFERTAR
                </button>
              )}
              <button onClick={onClausulaClick} className="flex-1 px-1 py-1 text-[8px] border border-vga-black bg-vga-red text-vga-bright-white hover:bg-vga-light-red font-bold">
                CLAUSULAZO
              </button>
            </div>
          ) : (
            <button onClick={onOfferClick} className="w-full px-2 py-1 text-[8px] border border-vga-black bg-vga-green text-vga-bright-white hover:bg-vga-light-green">
              OFERTAR
            </button>
          )}
        </div>
      }
    />
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
  const price = computePrice(entry.player, seasonYear);
  const clausulaCost = price * 2;
  const canAfford = userBudget >= clausulaCost;
  return (
    <div onClick={onCancel} className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={(e) => e.stopPropagation()} className="max-w-xs w-full border-4 border-vga-light-red bg-vga-blue shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="bg-vga-red px-3 py-2 text-center border-b-2 border-vga-bright-white">
          <div className="text-vga-bright-white text-[10px] uppercase font-bold">CLAUSULAZO TEBAS</div>
          <div className="text-vga-bright-white text-[12px] mt-1">
            <span className="text-vga-yellow mr-2">{entry.player.position}</span>{entry.player.name}
          </div>
          <div className="text-[8px] text-vga-bright-white mt-1 opacity-80">{entry.teamName}</div>
        </div>
        <div className="p-3 flex flex-col gap-3 text-vga-bright-white text-[8px]">
          <div className="bg-vga-black border border-vga-light-red p-2 text-center">
            <div className="text-vga-gray uppercase text-[7px]">Coste clausulazo</div>
            <div className="text-vga-light-red font-bold text-[16px]">{formatEuros(clausulaCost)}</div>
            <div className="text-[7px] text-vga-gray mt-1 flex justify-center gap-3">
              <span>Al club: {formatEuros(price)}</span>
              <span className="text-vga-light-red">Tebas se lleva su parte: {formatEuros(price)}</span>
            </div>
          </div>
          <div className="text-vga-yellow text-[7px] text-center">
            El jugador se traspasa directamente. No hay negociación.
          </div>
          {!canAfford && (
            <div className="bg-vga-red/40 border border-vga-light-red p-1 text-center text-[7px] text-vga-light-red font-bold">
              SIN PRESUPUESTO — necesitas {formatEuros(clausulaCost - userBudget)} más
            </div>
          )}
        </div>
        <div className="bg-vga-black p-2 border-t-2 border-vga-bright-white flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-vga-gray text-vga-black py-2 text-[9px] border border-vga-bright-white">CANCELAR</button>
          <button
            onClick={canAfford ? onConfirm : undefined}
            disabled={!canAfford}
            className={`flex-1 py-2 text-[9px] border font-bold ${canAfford ? 'bg-vga-red text-vga-bright-white hover:bg-vga-light-red border-vga-bright-white' : 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed border-vga-black'}`}
          >
            {canAfford ? 'EJECUTAR CLAUSULAZO' : 'SIN PRESUPUESTO'}
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
  onBack,
}: Props) => {
  const blockedSet = new Set(blockedSignings);
  const [offerEntry, setOfferEntry] = useState<MarketEntry | null>(null);
  const [clausulaEntry, setClausulaEntry] = useState<MarketEntry | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ accepted: boolean; message: string; playerName: string } | null>(null);
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'all' | 'listed' | 'free'>('all');

  const rankable = (() => {
    const seen = new Set<string>();
    return transferLog.filter(r => {
      if (r.kind === 'retirement') return false;
      if (r.tradeId) {
        if (seen.has(r.tradeId)) return false;
        seen.add(r.tradeId);
      }
      return true;
    });
  })();
  const topThisSeason = [...rankable]
    .filter(r => r.year === seasonYear)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const topAllTime = [...rankable]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

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
    const band = freeAgentEntries.filter(e => e.player.media >= min && e.player.media <= max);
    rotatedFreeAgents.push(...seededShuffle(band, seed + b).slice(0, BAND_SIZE));
  }
  const marketEntries = [...listedEntries, ...rotatedFreeAgents]
    .sort((a, b) => computePrice(b.player, seasonYear) - computePrice(a.player, seasonYear));

  const submitOffer = (entry: MarketEntry, amount: number, offeredPlayerIds: string[]) => {
    const result = entry.isFreeAgent
      ? onOfferFreeAgent(entry.player.id, amount)
      : onOffer(entry.player.id, entry.teamId!, amount, offeredPlayerIds);
    setLastResult({ accepted: result.accepted, message: result.message, playerName: entry.player.name });
    if (result.accepted) setOfferEntry(null);
  };

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">MERCADO DE FICHAJES</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          VOLVER
        </button>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-3">
        <div className="text-[7px] text-vga-black uppercase font-bold mb-2">Estado del mercado · J{currentJornada}</div>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[7px] text-vga-black uppercase">Presupuesto</div>
            <div className="text-[12px] text-vga-blue font-bold">{formatEuros(userTeam.budget)}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] text-vga-black uppercase">Plantilla</div>
            <div className="text-[10px] text-vga-blue font-bold">{userTeam.players.length}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] text-vga-black uppercase">Libres</div>
            <div className="text-[10px] text-vga-blue font-bold">{freeAgents.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[7px] text-vga-black uppercase">En venta</div>
            <div className="text-[10px] text-vga-blue font-bold">{listedEntries.length}</div>
          </div>
        </div>
      </div>

      <div className="border-2 border-vga-cyan p-2 bg-vga-blue">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-vga-cyan text-[10px] font-bold uppercase">Bolsa de fichajes</h3>
          <span className="text-[7px] text-vga-gray">
            {listedEntries.length} en venta · {freeAgents.length} libres ({rotatedFreeAgents.length} esta jornada)
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {(['all', 'listed', 'free'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-[7px] px-2 py-0.5 border ${typeFilter === t ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'bg-vga-black text-vga-gray border-vga-gray hover:text-vga-bright-white'}`}>
              {t === 'all' ? 'TODOS' : t === 'listed' ? 'EN VENTA' : 'LIBRES'}
            </button>
          ))}
          <span className="text-vga-gray text-[7px] self-center mx-1">|</span>
          {(['ALL', 'POR', 'DEF', 'MED', 'DEL', 'AML', 'AMR'] as const).map(p => (
            <button key={p} onClick={() => setPosFilter(p)}
              className={`text-[7px] px-2 py-0.5 border ${posFilter === p ? 'bg-vga-yellow text-vga-black border-vga-yellow' : 'bg-vga-black text-vga-gray border-vga-gray hover:text-vga-bright-white'}`}>
              {p}
            </button>
          ))}
        </div>
        {(() => {
          const filtered = marketEntries
            .filter(e => typeFilter === 'all' || (typeFilter === 'listed' ? !e.isFreeAgent : e.isFreeAgent))
            .filter(e => posFilter === 'ALL' || e.player.position === posFilter);
          return filtered.length === 0 ? (
            <div className="text-[8px] text-vga-gray text-center p-2">No hay jugadores disponibles con estos filtros.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.map(entry => (
                <MarketCard
                  key={entry.player.id}
                  entry={entry}
                  seasonYear={seasonYear}
                  onOfferClick={() => setOfferEntry(entry)}
                  onClausulaClick={!entry.isFreeAgent && entry.teamId ? () => setClausulaEntry(entry) : undefined}
                  onPlayerClick={onPlayerClick ? () => onPlayerClick(entry.player.id) : undefined}
                  blocked={false}
                />
              ))}
            </div>
          );
        })()}
      </div>

      <div className="border-2 border-vga-cyan p-2 bg-vga-blue">
        <h3 className="text-vga-cyan text-[10px] font-bold mb-2 uppercase">Otros equipos</h3>
        <div className="text-[7px] text-vga-gray mb-2">
          Jugadores en venta: oferta normal. Jugadores sin carteler: <span className="text-vga-light-red font-bold">CLAUSULAZO</span> — pago inmediato × 2 sin negociación.
        </div>
        <div className="flex flex-col gap-1">
          {rivalTeams.map(rival => {
            const open = expandedTeamId === rival.id;
            const listedCount = rival.players.filter(p => p.forSale).length;
            return (
              <div key={rival.id} className="bg-vga-black border border-vga-gray">
                <button
                  onClick={() => setExpandedTeamId(open ? null : rival.id)}
                  className="w-full text-left px-2 py-1 text-[9px] text-vga-bright-white hover:bg-vga-gray hover:text-vga-black flex justify-between items-center"
                >
                  <span>{rival.name}</span>
                  <span className="flex items-center gap-2">
                    {listedCount > 0 && (
                      <span className="text-[7px] bg-vga-yellow text-vga-black px-1 border border-vga-black uppercase">
                        {listedCount} en venta
                      </span>
                    )}
                    <span className="text-vga-yellow">{open ? '−' : '+'}</span>
                  </span>
                </button>
                {open && (
                  <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-vga-gray">
                    {sortPlayers(rival.players)
                      .filter(p => !blockedSet.has(signingBlockKey(rival.id, p.id)))
                      .map(p => {
                        const entry: MarketEntry = { player: p, teamName: rival.name, teamId: rival.id, isFreeAgent: false };
                        return (
                          <MarketCard
                            key={p.id}
                            entry={entry}
                            seasonYear={seasonYear}
                            onOfferClick={() => setOfferEntry(entry)}
                            onClausulaClick={() => setClausulaEntry(entry)}
                            onPlayerClick={onPlayerClick ? () => onPlayerClick(p.id) : undefined}
                            blocked={false}
                          />
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-2 border-vga-magenta p-2 bg-vga-blue">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 uppercase">Top fichajes {seasonYear}</h3>
        {topThisSeason.length === 0 ? (
          <div className="text-[8px] text-vga-gray text-center p-2">Sin fichajes esta temporada.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {topThisSeason.map((r, i) => (
              <TransferRankRow key={r.id} rank={i + 1} record={r} />
            ))}
          </div>
        )}
      </div>

      <div className="border-2 border-vga-magenta p-2 bg-vga-blue">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 uppercase">Top fichajes histórico</h3>
        {topAllTime.length === 0 ? (
          <div className="text-[8px] text-vga-gray text-center p-2">Sin fichajes registrados.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {topAllTime.map((r, i) => (
              <TransferRankRow key={r.id} rank={i + 1} record={r} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-vga-magenta p-2 border-2 border-vga-white text-[7px] text-vga-bright-white text-center uppercase">
        Aviso: puedes poner jugadores en venta desde tu PLANTILLA. Vender un titular libera su hueco en la alineación.
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
          title={lastResult.accepted ? 'Oferta aceptada' : 'Oferta rechazada'}
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

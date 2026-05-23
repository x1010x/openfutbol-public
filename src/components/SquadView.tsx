import { useState } from 'react';
import type { Player, Position, Team } from '../types/game.d.ts';
import { PlayerName } from './PlayerName';

const StaminaBar = ({ value }: { value: number }) => {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  const col = pct >= 60 ? 'bg-vga-light-green' : pct >= 30 ? 'bg-vga-yellow' : 'bg-vga-light-red';
  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-1.5 bg-vga-black border border-vga-gray">
        <div className={`h-full ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[6px] text-vga-gray font-mono">{pct}</span>
    </div>
  );
};
import type { IncomingOffer } from '../store/leagueStore';
import { PlayerCard } from './PlayerCard';
import { computePrice, formatEuros } from '../data/economy';
import { moodStateOf } from '../engine/playerMood';
import { liveMed } from '../engine/formations';

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
  onAcceptIncomingOffer?: (offerId: string) => void;
  onRejectIncomingOffer?: (offerId: string) => void;
  onCounterIncomingOffer?: (offerId: string, requestedCash: number, requestedPlayerIds: string[]) => void;
}

const GROUPS: { label: string; positions: Position[] }[] = [
  { label: 'PORTEROS',     positions: ['POR'] },
  { label: 'DEFENSAS',     positions: ['DEF'] },
  { label: 'CENTROCAMPO',  positions: ['MED'] },
  { label: 'EXTREMOS',     positions: ['AML', 'AMR'] },
  { label: 'DELANTEROS',   positions: ['DEL'] },
];

export const SquadView = ({
  team,
  seasonYear,
  currentJornada,
  onToggleForSale,
  onPlayerClick,
  onBack,
  readOnly = false,
  incomingOffers,
  teams,
  onAcceptIncomingOffer,
  onRejectIncomingOffer,
  onCounterIncomingOffer,
}: Props) => {
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterCash, setCounterCash] = useState(0);
  const [counterPlayerIds, setCounterPlayerIds] = useState<Set<string>>(new Set());
  const [expandedOfferPlayers, setExpandedOfferPlayers] = useState<Set<string>>(new Set());

  const toggleOfferPlayer = (pid: string) =>
    setExpandedOfferPlayers(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  const openCounter = (offerId: string, defaultCash: number) => {
    setCounterOfferId(offerId);
    setCounterCash(defaultCash);
    setCounterPlayerIds(new Set());
  };
  const closeCounter = () => { setCounterOfferId(null); setCounterPlayerIds(new Set()); };
  const canList = team.players.length > 11;
  const listedCount = team.players.filter(p => p.forSale).length;

  const groupPlayers = (positions: Position[]): Player[] =>
    team.players
      .filter(p => positions.includes(p.position))
      .sort((a, b) => b.media - a.media);

  const teamById = (id: string) => teams?.find(t => t.id === id);

  // Hide offers whose bidder can no longer cover the cash amount — they'd
  // fail on accept anyway, so don't show them.
  const affordableOffers = (incomingOffers ?? []).filter(o => {
    const bidder = teamById(o.fromTeamId);
    return bidder && bidder.budget >= o.amount;
  });

  return (
    <div className="w-full max-w-5xl flex flex-col gap-4">
      <div className="flex justify-between items-center bg-vga-blue p-2 border-2 border-vga-white vga-panel">
        <h2 className="text-vga-yellow text-xs">PLANTILLA: {team.name}</h2>
        <button
          onClick={onBack}
          className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black"
        >
          VOLVER
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[8px]">
        <div className="bg-vga-gray border border-vga-blue p-2 text-center">
          <div className="text-vga-black uppercase">Presupuesto</div>
          <div className="text-vga-blue font-bold text-[10px]">{formatEuros(team.budget)}</div>
        </div>
        <div className="bg-vga-gray border border-vga-blue p-2 text-center">
          <div className="text-vga-black uppercase">Jugadores</div>
          <div className="text-vga-blue font-bold text-[10px]">{team.players.length}</div>
        </div>
        <div className="bg-vga-gray border border-vga-blue p-2 text-center">
          <div className="text-vga-black uppercase">En mercado</div>
          <div className="text-vga-blue font-bold text-[10px]">{listedCount}</div>
        </div>
      </div>


      {!readOnly && !canList && (
        <div className="bg-vga-magenta border-2 border-vga-white text-[8px] text-vga-bright-white text-center p-2 uppercase">
          Necesitas más de 11 jugadores para poner alguno en venta.
        </div>
      )}

      {GROUPS.map(group => {
        const players = groupPlayers(group.positions);
        if (players.length === 0) return null;
        return (
          <div key={group.label} className="border-2 border-vga-cyan bg-vga-blue p-2">
            <h3 className="text-vga-cyan text-[10px] font-bold mb-2 uppercase border-b border-vga-cyan pb-1">
              {group.label} <span className="text-vga-gray">({players.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {players.map(player => {
                const listed = !!player.forSale;
                const price = computePrice(player, seasonYear);
                const stamina = player.stamina ?? 99;
                const isInjured = (player.injuryWeeksRemaining ?? 0) > 0;
                const mood = moodStateOf(player, team.lineup.includes(player.id));
                const live = liveMed(player, stamina);
                const playerOffers = affordableOffers.filter(o => o.playerId === player.id);
                const hasOffers = playerOffers.length > 0;
                const isOfferOpen = expandedOfferPlayers.has(player.id);
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    seasonYear={seasonYear}
                    highlight={hasOffers ? 'listed' : undefined}
                    onNameClick={onPlayerClick ? () => onPlayerClick(player.id) : undefined}
                    moodState={mood}
                    liveMedValue={live}
                    footer={
                      <>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[7px] text-vga-gray uppercase">CAN</span>
                            <StaminaBar value={stamina} />
                          </div>
                          {isInjured && (
                            <span className="text-[7px] text-vga-light-red font-bold uppercase">LES {player.injuryWeeksRemaining}s</span>
                          )}
                        </div>
                        {readOnly ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] text-vga-light-green">{formatEuros(price)}</span>
                            {listed && (
                              <span className="px-2 py-1 text-[7px] border border-vga-black bg-vga-yellow text-vga-black uppercase">
                                EN MERCADO
                              </span>
                            )}
                          </div>
                        ) : hasOffers ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] text-vga-light-green">{formatEuros(price)}</span>
                            <button
                              onClick={() => toggleOfferPlayer(player.id)}
                              className="px-2 py-1 text-[7px] border border-vga-black bg-vga-yellow text-vga-black font-bold hover:bg-vga-bright-white"
                            >
                              {isOfferOpen ? 'CERRAR' : `VER OFERTA${playerOffers.length > 1 ? 'S' : ''}`}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] text-vga-light-green">{formatEuros(price)}</span>
                            <button
                              onClick={() => onToggleForSale(player.id)}
                              disabled={!listed && !canList}
                              className={`px-2 py-1 text-[7px] border border-vga-black ${
                                listed
                                  ? 'bg-vga-yellow text-vga-black hover:bg-vga-bright-white'
                                  : !canList
                                  ? 'bg-vga-gray text-vga-black opacity-50 cursor-not-allowed'
                                  : 'bg-vga-red text-vga-bright-white hover:bg-vga-light-red'
                              }`}
                            >
                              {listed ? 'QUITAR DEL MERCADO' : 'PONER EN MERCADO'}
                            </button>
                          </div>
                        )}
                        {isOfferOpen && playerOffers.map(offer => {
                          const bidder = teamById(offer.fromTeamId);
                          if (!bidder) return null;
                          const offeredPlayers = (offer.offeredPlayerIds ?? [])
                            .map(pid => bidder.players.find(p => p.id === pid))
                            .filter((p): p is Player => Boolean(p));
                          const offeredValue = offeredPlayers.reduce((s, p) => s + computePrice(p, seasonYear), 0);
                          const totalValue = offer.amount + offeredValue;
                          const ratio = totalValue / price;
                          const offerRatioClass = ratio >= 1.5 ? 'text-vga-light-green' : ratio >= 1 ? 'text-vga-yellow' : 'text-vga-light-red';
                          const isSwap = offeredPlayers.length > 0;
                          const isCountering = counterOfferId === offer.id;
                          const counterStep = Math.max(100_000, Math.round(price * 0.05 / 100_000) * 100_000);
                          const bidderBench = bidder.players
                            .filter(p => !bidder.lineup.includes(p.id))
                            .sort((a, b) => b.media - a.media);
                          const counterPlayersValue = [...counterPlayerIds]
                            .map(id => bidder.players.find(p => p.id === id))
                            .filter(Boolean)
                            .reduce((s, p) => s + computePrice(p!, seasonYear), 0);
                          const counterTotal = counterCash + counterPlayersValue;
                          return (
                            <div key={offer.id} className="mt-2 border border-vga-yellow bg-vga-black text-[8px] flex flex-col">
                              <div className="p-2 flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[7px] text-vga-cyan">
                                    DE <span className="text-vga-bright-white">{bidder.name}</span>
                                    {offer.expiresAt != null && currentJornada != null && (() => {
                                      const rem = offer.expiresAt - currentJornada;
                                      return rem <= 1 ? (
                                        <span className="ml-2 text-vga-light-red font-bold">EXPIRA HOY</span>
                                      ) : (
                                        <span className="ml-2 text-vga-yellow">EXP J{offer.expiresAt}</span>
                                      );
                                    })()}
                                  </div>
                                  {isSwap && (
                                    <div className="text-[7px] text-vga-magenta mt-0.5">
                                      + INCLUYE:{' '}
                                      {offeredPlayers.map((p, i) => (
                                        <span key={p.id}>
                                          {i > 0 && ', '}
                                          {onPlayerClick ? (
                                            <button onClick={() => onPlayerClick(p.id)} className="hover:text-vga-yellow underline decoration-dotted underline-offset-2 text-vga-light-cyan">
                                              {p.position} <PlayerName player={p} />
                                            </button>
                                          ) : (
                                            <span className="text-vga-light-cyan">{p.position} <PlayerName player={p} /></span>
                                          )}
                                        </span>
                                      ))}
                                      <span className="ml-1 text-vga-gray">({formatEuros(offeredValue)})</span>
                                    </div>
                                  )}
                                  <div className="text-[9px] mt-0.5">
                                    {isSwap ? 'TOTAL' : 'OFERTA'}{' '}
                                    <span className={`font-bold ${offerRatioClass}`}>{formatEuros(totalValue)}</span>
                                    <span className="text-vga-gray ml-1">({Math.round(ratio * 100)}%)</span>
                                    {isSwap && offer.amount > 0 && (
                                      <span className="text-vga-cyan ml-2 text-[7px]">+{formatEuros(offer.amount)} efectivo</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button onClick={() => onAcceptIncomingOffer!(offer.id)} className="bg-vga-green text-vga-bright-white px-2 py-1 text-[7px] border border-vga-black hover:bg-vga-light-green">ACEPTAR</button>
                                  {onCounterIncomingOffer && (
                                    <button
                                      onClick={() => isCountering ? closeCounter() : openCounter(offer.id, offer.amount)}
                                      className={`px-2 py-1 text-[7px] border border-vga-black font-bold ${isCountering ? 'bg-vga-gray text-vga-black' : 'bg-vga-yellow text-vga-black hover:bg-vga-bright-white'}`}
                                    >CONTRA</button>
                                  )}
                                  <button onClick={() => onRejectIncomingOffer!(offer.id)} className="bg-vga-red text-vga-bright-white px-2 py-1 text-[7px] border border-vga-black hover:bg-vga-light-red">RECHAZAR</button>
                                </div>
                              </div>
                              {isCountering && (
                                <div className="border-t border-vga-yellow bg-vga-blue/20 p-2 flex flex-col gap-2">
                                  <div className="text-[7px] text-vga-yellow font-bold uppercase">Contraoferta a {bidder.name}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[7px] text-vga-bright-white">Efectivo:</span>
                                    <button onClick={() => setCounterCash(c => Math.max(0, c - counterStep))} className="bg-vga-gray text-vga-black px-1.5 border border-vga-black text-[8px]">−</button>
                                    <span className="text-vga-yellow font-bold text-[9px] min-w-[110px] text-center">{formatEuros(counterCash)}</span>
                                    <button onClick={() => setCounterCash(c => c + counterStep)} className="bg-vga-gray text-vga-black px-1.5 border border-vga-black text-[8px]">+</button>
                                    <button onClick={() => setCounterCash(0)} className="text-[6px] text-vga-gray border border-vga-gray px-1">0</button>
                                    <button onClick={() => setCounterCash(offer.amount)} className="text-[6px] text-vga-gray border border-vga-gray px-1">BASE</button>
                                  </div>
                                  {bidderBench.length > 0 && (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="text-[7px] text-vga-bright-white">Pedir jugadores de {bidder.name} (máx. 2):</div>
                                      <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
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
                                              <span><span className="font-bold mr-1">{p.position}</span><PlayerName player={p} /></span>
                                              <span className="text-vga-cyan ml-2">{p.media} · {formatEuros(pPrice)}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <div className="text-[7px]">
                                      <span className="text-vga-gray">Total pedido: </span>
                                      <span className="text-vga-yellow font-bold">{formatEuros(counterTotal)}</span>
                                      <span className="text-vga-gray ml-1">({Math.round((counterTotal / price) * 100)}% del valor)</span>
                                    </div>
                                    <div className="flex gap-1">
                                      <button onClick={closeCounter} className="bg-vga-gray text-vga-black px-2 py-1 text-[7px] border border-vga-black">CANCELAR</button>
                                      <button
                                        onClick={() => {
                                          onCounterIncomingOffer!(offer.id, counterCash, [...counterPlayerIds]);
                                          closeCounter();
                                        }}
                                        className="bg-vga-green text-vga-bright-white px-2 py-1 text-[7px] border border-vga-black hover:bg-vga-light-green font-bold"
                                      >ENVIAR</button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

import { useState } from 'react';
import type { Player, Team } from '../types/game.d.ts';
import type { IncomingOffer } from '../store/leagueStore';
import { computePrice, formatEuros, playerWeeklySalary } from '../data/economy';
import { TeamCrest } from './TeamCrest';
import { PlayerPhoto } from './PlayerPhoto';

interface Props {
  player: Player;
  sellerTeam: Team;          // the team that owns the player (could be us or AI)
  buyerTeam: Team;           // the team making the offer
  offer: IncomingOffer;
  seasonYear: number;
  currentJornada?: number;
  isOwnPlayer: boolean;      // true if we own the player (the seller is us)
  onAccept: () => void;
  onReject: () => void;
  onCounter?: (requestedCash: number, requestedPlayerIds: string[]) => void;
  onClose: () => void;
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between text-[8px]">
    <span className="text-vga-gray uppercase">{label}</span>
    <span className="text-vga-bright-white font-mono">{value}</span>
  </div>
);

export const NegotiationModal = ({
  player, sellerTeam, buyerTeam, offer, seasonYear, currentJornada,
  isOwnPlayer, onAccept, onReject, onCounter, onClose,
}: Props) => {
  const price = computePrice(player, seasonYear);
  const ratio = offer.amount / Math.max(1, price);
  const ratioColor = ratio >= 1.5 ? 'text-vga-light-green' : ratio >= 1 ? 'text-vga-yellow' : 'text-vga-light-red';
  const salary = playerWeeklySalary(player, seasonYear);

  const offeredPlayers = (offer.offeredPlayerIds ?? [])
    .map(pid => buyerTeam.players.find(p => p.id === pid))
    .filter((p): p is Player => Boolean(p));
  const offeredValue = offeredPlayers.reduce((s, p) => s + computePrice(p, seasonYear), 0);
  const totalValue = offer.amount + offeredValue;

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterCash, setCounterCash] = useState(offer.amount);
  const [counterIds, setCounterIds] = useState<Set<string>>(new Set());
  const counterStep = Math.max(100_000, Math.round(price * 0.05 / 100_000) * 100_000);
  const counterPlayersValue = [...counterIds]
    .map(id => buyerTeam.players.find(p => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .reduce((s, p) => s + computePrice(p, seasonYear), 0);
  const counterTotal = counterCash + counterPlayersValue;
  const bidderBench = buyerTeam.players
    .filter(p => !buyerTeam.lineup.includes(p.id))
    .sort((a, b) => b.media - a.media);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[92vh] flex flex-col"
      >
        {/* Header: both teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-3 border-b-2 border-vga-blue bg-vga-blue/30">
          <div className="flex items-center gap-2 min-w-0">
            <TeamCrest colors={buyerTeam.colors} size="md" teamId={buyerTeam.id} title={buyerTeam.name} />
            <div className="min-w-0">
              <div className="text-[7px] uppercase text-vga-cyan tracking-widest">Oferta de</div>
              <div className="text-vga-bright-white text-[11px] uppercase font-bold truncate">{buyerTeam.name}</div>
              <div className="text-vga-gray text-[7px] uppercase truncate">ENT: {buyerTeam.manager ?? '—'}</div>
            </div>
          </div>
          <div className="text-vga-yellow text-[14px] font-bold">→</div>
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <div className="text-[7px] uppercase text-vga-magenta tracking-widest">Por jugador de</div>
              <div className="text-vga-bright-white text-[11px] uppercase font-bold truncate">{sellerTeam.name}</div>
              <div className="text-vga-gray text-[7px] uppercase truncate">ENT: {sellerTeam.manager ?? '—'}</div>
            </div>
            <TeamCrest colors={sellerTeam.colors} size="md" teamId={sellerTeam.id} title={sellerTeam.name} />
          </div>
        </div>

        {/* Body: player card + offer */}
        <div className="flex-1 overflow-y-auto grid grid-cols-[180px_1fr] gap-0">
          {/* Player */}
          <div className="border-r-2 border-vga-blue p-3 flex flex-col gap-2">
            <div className="border-2 border-vga-blue overflow-hidden" style={{ width: '100%', aspectRatio: '1 / 1' }}>
              {player.source_id ? (
                <PlayerPhoto sourceId={player.source_id} size="xl" className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-vga-bright-white text-3xl font-bold font-mono" style={{ background: sellerTeam.colors?.[0] ?? '#003366' }}>
                  {player.number ?? '?'}
                </div>
              )}
            </div>
            <div className="text-vga-bright-white text-[10px] font-bold uppercase">{player.name}</div>
            <div className="text-vga-cyan text-[8px] uppercase">{player.position} · #{player.number}</div>
            <div className="flex flex-col gap-0.5 mt-1">
              <Stat label="OVR" value={Math.round((player.current_ability ?? player.media * 2) / 2)} />
              <Stat label="Edad" value={seasonYear - player.birthYear} />
              <Stat label="Valor" value={formatEuros(price)} />
              <Stat label="Sueldo" value={`${formatEuros(salary)}/sem`} />
              <Stat label="Contrato" value={player.contract?.expiration ?? '—'} />
            </div>
            {player.seasonStats && (
              <div className="mt-1 border-t border-vga-blue pt-1 flex flex-col gap-0.5">
                <div className="text-vga-magenta text-[7px] uppercase tracking-widest">Temporada</div>
                <Stat label="PJ" value={player.seasonStats.appearances} />
                <Stat label="G" value={player.seasonStats.goals} />
                <Stat label="A" value={player.seasonStats.assists} />
                <Stat label="Min" value={player.seasonStats.minutes} />
              </div>
            )}
          </div>

          {/* Offer */}
          <div className="p-3 flex flex-col gap-2">
            <div className="text-vga-cyan text-[8px] uppercase tracking-widest">Términos de la oferta</div>
            <div className="border border-vga-blue p-2 flex flex-col gap-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-vga-gray uppercase">Efectivo</span>
                <span className="text-vga-light-green font-bold font-mono">{formatEuros(offer.amount)}</span>
              </div>
              {offeredPlayers.length > 0 && (
                <div className="flex flex-col gap-0.5 border-t border-vga-blue pt-1">
                  <div className="text-vga-gray uppercase text-[7px]">Incluye jugadores</div>
                  {offeredPlayers.map(p => (
                    <div key={p.id} className="flex justify-between text-[8px]">
                      <span className="text-vga-light-cyan"><span className="font-bold mr-1">{p.position}</span>{p.name}</span>
                      <span className="text-vga-gray font-mono">{formatEuros(computePrice(p, seasonYear))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-[9px] border-t border-vga-blue pt-1">
                <span className="text-vga-gray uppercase">Valor total</span>
                <span className={`${ratioColor} font-bold font-mono`}>{formatEuros(totalValue)} ({Math.round((totalValue / price) * 100)}%)</span>
              </div>
              {offer.expiresAt != null && currentJornada != null && (
                <div className="flex justify-between text-[8px] border-t border-vga-blue pt-1">
                  <span className="text-vga-gray uppercase">Expira</span>
                  <span className={offer.expiresAt - currentJornada <= 1 ? 'text-vga-light-red font-bold' : 'text-vga-yellow'}>
                    {offer.expiresAt - currentJornada <= 1 ? 'PRÓXIMA JORNADA' : `J${offer.expiresAt}`}
                  </span>
                </div>
              )}
            </div>

            {counterOpen && isOwnPlayer && onCounter && (
              <div className="border border-vga-yellow bg-vga-blue/20 p-2 flex flex-col gap-2">
                <div className="text-[8px] text-vga-yellow font-bold uppercase">Contraoferta — pide a {buyerTeam.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[8px] text-vga-bright-white uppercase">Efectivo:</span>
                  <button onClick={() => setCounterCash(c => Math.max(0, c - counterStep))} className="bg-vga-gray text-vga-black px-2 border border-vga-black text-[10px]">−</button>
                  <span className="text-vga-yellow font-bold text-[10px] font-mono min-w-[100px] text-center">{formatEuros(counterCash)}</span>
                  <button onClick={() => setCounterCash(c => c + counterStep)} className="bg-vga-gray text-vga-black px-2 border border-vga-black text-[10px]">+</button>
                </div>
                {bidderBench.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[7px] text-vga-bright-white uppercase">Jugadores de {buyerTeam.name} (máx 2)</div>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
                      {bidderBench.map(p => {
                        const sel = counterIds.has(p.id);
                        const canAdd = sel || counterIds.size < 2;
                        return (
                          <button
                            key={p.id}
                            disabled={!canAdd}
                            onClick={() => setCounterIds(prev => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                              return next;
                            })}
                            className={`flex items-center justify-between px-2 py-0.5 text-[8px] border ${sel ? 'bg-vga-yellow text-vga-black border-vga-black' : canAdd ? 'bg-vga-black text-vga-bright-white border-vga-gray hover:border-vga-yellow' : 'bg-vga-black text-vga-gray border-vga-gray opacity-40 cursor-default'}`}
                          >
                            <span className="truncate"><span className="font-bold mr-1">{p.position}</span>{p.name}</span>
                            <span className="text-vga-cyan ml-2 shrink-0">{p.media} · {formatEuros(computePrice(p, seasonYear))}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[8px]">
                    <span className="text-vga-gray">Total: </span>
                    <span className="text-vga-yellow font-bold font-mono">{formatEuros(counterTotal)}</span>
                    <span className="text-vga-gray ml-1">({Math.round((counterTotal / price) * 100)}%)</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCounterOpen(false)} className="bg-vga-gray text-vga-black px-3 py-1 text-[9px] uppercase border border-vga-black">Cancelar</button>
                    <button
                      onClick={() => { onCounter(counterCash, [...counterIds]); onClose(); }}
                      className="bg-vga-light-green text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-bright-white"
                    >
                      Enviar contra
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {isOwnPlayer && !counterOpen && (
          <div className="border-t-2 border-vga-blue p-3 grid grid-cols-3 gap-2 bg-vga-blue/30">
            <button
              onClick={() => { onReject(); onClose(); }}
              className="bg-vga-red text-vga-bright-white text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-light-red"
            >
              Rechazar
            </button>
            {onCounter ? (
              <button
                onClick={() => setCounterOpen(true)}
                className="bg-vga-yellow text-vga-black text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white"
              >
                Contraoferta
              </button>
            ) : <div />}
            <button
              onClick={() => { onAccept(); onClose(); }}
              className="bg-vga-light-green text-vga-black text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white"
            >
              Aceptar
            </button>
          </div>
        )}
        {!isOwnPlayer && (
          <div className="border-t-2 border-vga-blue p-3 bg-vga-blue/30">
            <button onClick={onClose} className="w-full bg-vga-blue text-vga-bright-white text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

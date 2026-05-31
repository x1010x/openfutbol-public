import { useMemo, useState } from 'react';
import type { Player, Team } from '../types/game.d.ts';
import { formatEuros, playerWeeklySalary, computePrice } from '../data/economy';
import { TeamCrest } from './TeamCrest';
import { PlayerPhoto } from './PlayerPhoto';

// The player's demanded weekly wage given the deal context. Higher fee, higher
// ambition: when a club pays a premium the player wants a share of it.
const computeDemand = (player: Player, buyer: Team, feePaid: number, seasonYear: number): number => {
  const price = Math.max(1, computePrice(player, seasonYear));
  const feeRatio = feePaid / price;
  const currentWage = playerWeeklySalary(player, seasonYear);
  // Base demand: current wage scaled by fee ratio with a 10% bump premium.
  const base = currentWage * Math.max(1.05, feeRatio * 1.1);
  // Buyer quality nudge: strong clubs can lowball a touch.
  const avgMedia = buyer.players.length > 0
    ? buyer.players.reduce((s, p) => s + p.media, 0) / buyer.players.length
    : 50;
  const buyerDiscount = avgMedia > 80 ? 0.92 : avgMedia > 70 ? 0.96 : 1.0;
  return Math.round((base * buyerDiscount) / 100) * 100;
};

const computeContractYears = (player: Player, seasonYear: number): number => {
  const age = seasonYear - player.birthYear;
  if (age < 24) return 5;
  if (age < 29) return 4;
  if (age < 32) return 3;
  return 2;
};

interface Props {
  player: Player;
  buyerTeam: Team;
  sellerTeam: Team;
  feePaid: number;
  seasonYear: number;
  // 'user-buying' → user sets terms manually. 'user-selling' → AI buyer talks
  // to player; user just watches the outcome.
  mode: 'user-buying' | 'user-selling';
  onAccept: (agreedWeeklySalary: number, years: number) => void;
  onReject: () => void;
  onClose: () => void;
}

const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flex justify-between text-[9px]">
    <span className="text-vga-gray uppercase">{label}</span>
    <span className={`${color ?? 'text-vga-bright-white'} font-mono`}>{value}</span>
  </div>
);

export const PlayerNegotiationModal = ({
  player, buyerTeam, sellerTeam, feePaid, seasonYear, mode, onAccept, onReject, onClose,
}: Props) => {
  const demand = useMemo(() => computeDemand(player, buyerTeam, feePaid, seasonYear), [player, buyerTeam, feePaid, seasonYear]);
  const years = computeContractYears(player, seasonYear);
  const currentWage = playerWeeklySalary(player, seasonYear);
  const minOffer = Math.round(demand * 0.7 / 100) * 100;
  const step = Math.max(500, Math.round(demand * 0.02 / 100) * 100);

  const [offer, setOffer] = useState<number>(demand);
  const [contractYears, setContractYears] = useState<number>(years);
  const [outcome, setOutcome] = useState<null | { ok: boolean; msg: string }>(null);

  const ratio = offer / demand;
  const ratioColor = ratio >= 1 ? 'text-vga-light-green' : ratio >= 0.9 ? 'text-vga-yellow' : 'text-vga-light-red';

  const submit = (proposed: number, yrs: number) => {
    // Acceptance rule: at or above demand → almost certain. 90-99% → coin flip.
    // Below 90% → likely rejection. Shorter contracts hurt slightly when player
    // is young (wants security), longer contracts hurt slightly when over-30.
    const r = proposed / demand;
    const age = seasonYear - player.birthYear;
    const yearsTuning = age < 28
      ? (yrs >= 4 ? 0.05 : yrs <= 2 ? -0.08 : 0)
      : (yrs >= 4 ? -0.06 : yrs <= 2 ? 0.03 : 0);
    const p = Math.max(0.05, Math.min(0.97,
      r >= 1.1 ? 0.97 :
      r >= 1.0 ? 0.85 + yearsTuning :
      r >= 0.95 ? 0.6 + yearsTuning :
      r >= 0.9 ? 0.35 + yearsTuning :
      r >= 0.8 ? 0.15 + yearsTuning :
      0.04
    ));
    const ok = Math.random() < p;
    if (ok) {
      setOutcome({ ok: true, msg: `${player.name} acepta los términos.` });
      setTimeout(() => onAccept(proposed, yrs), 700);
    } else {
      setOutcome({
        ok: false,
        msg: r >= 0.9
          ? `${player.name} quiere más. La operación se cae.`
          : `${player.name} considera la oferta insuficiente y rechaza el traspaso.`,
      });
      setTimeout(() => onReject(), 1000);
    }
  };

  // User-selling: AI buyer auto-negotiates a single offer. We compute it and
  // show the back-and-forth, then call onAccept/onReject. Buyer pays slightly
  // under demand on average — about 92-98%.
  const autoRun = mode === 'user-selling';
  if (autoRun && !outcome) {
    // Trigger once via setState; we render the modal then run on first paint.
    setTimeout(() => {
      const proposed = Math.round(demand * (0.92 + Math.random() * 0.08) / 100) * 100;
      submit(proposed, years);
    }, 100);
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[92vh] flex flex-col"
      >
        <div className="bg-vga-blue/30 border-b-2 border-vga-blue p-3 text-center">
          <div className="text-vga-yellow text-[9px] uppercase tracking-widest font-bold">Negociación con el jugador</div>
          <div className="text-vga-gray text-[8px] uppercase mt-1">Clubes ya de acuerdo · falta convencer al jugador</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Header with player + clubs */}
          <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
            <div className="border-2 border-vga-blue overflow-hidden" style={{ width: 80, height: 80 }}>
              {player.source_id ? (
                <PlayerPhoto sourceId={player.source_id} size="md" className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-vga-bright-white text-xl font-bold font-mono" style={{ background: sellerTeam.colors?.[0] ?? '#003366' }}>
                  {player.number ?? '?'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-vga-bright-white text-[11px] font-bold uppercase truncate">{player.name}</div>
              <div className="text-vga-cyan text-[8px] uppercase">{player.position} · {seasonYear - player.birthYear}a · {Math.round((player.current_ability ?? player.media * 2) / 2)} OVR</div>
              <div className="flex items-center gap-1 mt-1">
                <TeamCrest colors={sellerTeam.colors} size="sm" teamId={sellerTeam.id} title={sellerTeam.name} />
                <span className="text-vga-gray text-[8px]">→</span>
                <TeamCrest colors={buyerTeam.colors} size="sm" teamId={buyerTeam.id} title={buyerTeam.name} />
                <span className="text-vga-bright-white text-[8px] uppercase truncate ml-1">{buyerTeam.name}</span>
              </div>
            </div>
          </div>

          {/* Demand panel */}
          <div className="border border-vga-blue p-2 flex flex-col gap-1">
            <div className="text-vga-magenta text-[8px] uppercase tracking-widest">Lo que pide el jugador</div>
            <Row label="Sueldo actual"       value={`${formatEuros(currentWage)}/sem  (${formatEuros(currentWage * 52)} anual)`} color="text-vga-gray" />
            <Row label="Sueldo exigido"      value={`${formatEuros(demand)}/sem  (${formatEuros(demand * 52)} anual)`}           color="text-vga-yellow" />
            <Row label="Traspaso pagado"     value={formatEuros(feePaid)}              color="text-vga-light-green" />
            <Row label="Contrato propuesto"  value={`${years} años`}                   color="text-vga-cyan" />
          </div>

          {/* Form (only when user is buying) */}
          {mode === 'user-buying' && !outcome && (
            <div className="border border-vga-yellow bg-vga-blue/10 p-2 flex flex-col gap-2">
              <div className="text-vga-yellow text-[8px] uppercase tracking-widest font-bold">Tu oferta</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[8px] text-vga-bright-white uppercase">Sueldo:</span>
                <button onClick={() => setOffer(o => Math.max(minOffer, o - step))} className="bg-vga-gray text-vga-black px-2 border border-vga-black text-[10px]">−</button>
                <span className={`font-bold text-[11px] font-mono min-w-[120px] text-center ${ratioColor}`}>{formatEuros(offer)}/sem</span>
                <button onClick={() => setOffer(o => o + step)} className="bg-vga-gray text-vga-black px-2 border border-vga-black text-[10px]">+</button>
                <span className="text-[7px] text-vga-gray">({Math.round(ratio * 100)}% de lo pedido)</span>
              </div>
              <div className="text-[7px] text-vga-gray uppercase ml-[58px]">
                Equivale a {formatEuros(offer * 52)} al año
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-vga-bright-white uppercase">Contrato:</span>
                {[1, 2, 3, 4, 5].map(y => (
                  <button
                    key={y}
                    onClick={() => setContractYears(y)}
                    className={`px-2 py-0.5 text-[8px] border ${contractYears === y ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold' : 'bg-vga-black text-vga-cyan border-vga-gray hover:border-vga-yellow'}`}
                  >
                    {y}a
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <button
                  onClick={onClose}
                  className="bg-vga-red text-vga-bright-white px-3 py-1 text-[9px] uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-light-red"
                >
                  Abandonar
                </button>
                <button
                  onClick={() => submit(offer, contractYears)}
                  className="bg-vga-light-green text-vga-black px-3 py-1 text-[9px] uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white"
                >
                  Ofrecer
                </button>
              </div>
            </div>
          )}

          {/* Outcome */}
          {outcome && (
            <div className={`border-2 ${outcome.ok ? 'border-vga-light-green' : 'border-vga-light-red'} p-3 text-center`}>
              <div className={`text-[10px] uppercase font-bold ${outcome.ok ? 'text-vga-light-green' : 'text-vga-light-red'}`}>
                {outcome.ok ? 'Acuerdo' : 'Sin acuerdo'}
              </div>
              <div className="text-vga-bright-white text-[9px] mt-2">{outcome.msg}</div>
            </div>
          )}

          {/* Auto-run indicator for selling-side */}
          {mode === 'user-selling' && !outcome && (
            <div className="border border-vga-blue p-2 text-center text-vga-cyan text-[8px] uppercase tracking-widest animate-pulse">
              {buyerTeam.name} negocia con {player.name}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

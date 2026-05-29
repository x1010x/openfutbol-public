import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Player } from '../types/game.d.ts';
import { PlayerPhoto } from '../components/PlayerPhoto';
import { CountryBadge } from '../components/CountryBadge';
import { groupFor } from '../store/leagueStore';

type DraftPos = 'POR' | 'DEF' | 'MED' | 'DEL';

const POS_BADGE: Record<string, string> = {
  POR: 'bg-vga-yellow text-vga-black',
  DEF: 'bg-vga-blue text-vga-bright-white',
  MED: 'bg-vga-green text-vga-black',
  DEL: 'bg-vga-red text-vga-bright-white',
};

const STAT_LABELS: Record<string, string> = {
  speed: 'VEL', dribbling: 'DRI', passing: 'PAS',
  shooting: 'TIR', defending: 'DEF', physical: 'FIS', goalkeeping: 'POR',
};

const KEY_STATS: Record<string, string[]> = {
  POR: ['goalkeeping', 'defending', 'speed'],
  DEF: ['defending', 'physical', 'speed'],
  MED: ['passing', 'dribbling', 'defending'],
  DEL: ['shooting', 'dribbling', 'speed'],
};

const ALL_STATS = ['speed', 'dribbling', 'passing', 'shooting', 'defending', 'physical', 'goalkeeping'];

interface TooltipState {
  player: Player;
  x: number;
  y: number;
}

interface Ctx {
  show: (player: Player, x: number, y: number) => void;
  hide: () => void;
}

const PlayerTooltipContext = createContext<Ctx>({ show: () => {}, hide: () => {} });

export const usePlayerTooltip = () => useContext(PlayerTooltipContext);

const fmtEur = (v?: number) => {
  if (!v || v <= 0) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M €`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K €`;
  return `${v} €`;
};

const Tooltip = ({ player, x, y, year }: TooltipState & { year: number }) => {
  const pos = groupFor(player.position) as DraftPos;
  const age = year - player.birthYear;
  const keyStats = KEY_STATS[pos] ?? [];
  const ca = player.current_ability ?? player.media * 2;
  const pa = player.potential_ability ?? ca;
  const caDisplay = Math.round(ca / 2);
  const paDisplay = Math.round(pa / 2);
  const contractExp = player.contract?.expiration?.slice(0, 4);

  const W = 420;
  const H = 480;
  const left = x + W + 20 > window.innerWidth ? x - W - 8 : x + 16;
  const top = y + H > window.innerHeight ? Math.max(8, window.innerHeight - H - 8) : y - 8;

  return createPortal(
    <div
      style={{ position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', width: W }}
      className="bg-vga-black border-4 border-vga-white shadow-[6px_6px_0_rgba(0,0,0,1)] font-mono"
    >
      {/* Header */}
      <div className={`px-3 py-2 flex items-center gap-3 border-b-2 border-vga-gray ${POS_BADGE[pos] ?? 'bg-vga-gray text-vga-black'}`}>
        <span className="text-[14px] font-bold shrink-0">{pos}</span>
        <span className="text-[14px] font-bold truncate flex-1">{player.fullName}</span>
        {player.country_code && (
          <span className="text-[11px] shrink-0">
            <CountryBadge code={player.country_code} size="sm" />
          </span>
        )}
      </div>

      {/* Photo + meta */}
      <div className="flex gap-3 p-3 border-b border-vga-gray">
        <PlayerPhoto sourceId={player.source_id} size="md" className="shrink-0 border-2 border-vga-gray" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="text-vga-bright-white text-[13px] font-bold leading-tight">{player.fullName}</div>
          <div className="text-vga-cyan text-[10px]">#{player.number} · {age} años · pico {player.peakAge}a</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div>
              <span className="text-vga-gray text-[9px] mr-1">CA</span>
              <span className="text-vga-yellow text-[18px] font-bold">{caDisplay}</span>
            </div>
            <div>
              <span className="text-vga-gray text-[9px] mr-1">PA</span>
              <span className="text-vga-light-green text-[14px] font-bold">{paDisplay}</span>
            </div>
          </div>
          <div className="text-vga-gray text-[9px] mt-0.5">
            VAL <span className="text-vga-bright-white">{fmtEur(player.value)}</span>
            {contractExp && <> · CTR <span className="text-vga-bright-white">{contractExp}</span></>}
          </div>
          {player.fifa_year && (
            <div className="text-vga-magenta text-[9px] font-bold">FIFA {player.fifa_year}</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 flex flex-col gap-1">
        {ALL_STATS.map(stat => {
          const val = (player.stats as unknown as Record<string, number>)[stat] ?? 0;
          const isKey = keyStats.includes(stat);
          return (
            <div key={stat} className="flex items-center gap-2">
              <span className={`text-[11px] w-10 shrink-0 ${isKey ? 'text-vga-yellow font-bold' : 'text-vga-gray'}`}>
                {STAT_LABELS[stat]}
              </span>
              <div className="flex-1 bg-vga-gray h-3 border border-vga-black">
                <div className={`h-full ${isKey ? 'bg-vga-yellow' : 'bg-vga-blue'}`} style={{ width: `${val}%` }} />
              </div>
              <span className={`text-[12px] w-8 text-right shrink-0 font-bold ${isKey ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {(player.injuryWeeksRemaining ?? 0) > 0 && (
        <div className="px-3 py-1 bg-vga-red text-vga-bright-white text-[10px] font-bold uppercase">
          ✕ Lesionado · {player.injuryWeeksRemaining}s
        </div>
      )}
      {player.suspensionMatches > 0 && (
        <div className="px-3 py-1 bg-vga-red text-vga-bright-white text-[10px] font-bold uppercase">
          S Sancionado · {player.suspensionMatches}j
        </div>
      )}
    </div>,
    document.body,
  );
};

export const PlayerTooltipProvider = ({ children, year }: { children: React.ReactNode; year: number }) => {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((player: Player, x: number, y: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setTip({ player, x, y }), 500);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setTip(null), 80);
  }, []);

  return (
    <PlayerTooltipContext.Provider value={{ show, hide }}>
      {children}
      {tip && <Tooltip {...tip} year={year} />}
    </PlayerTooltipContext.Provider>
  );
};

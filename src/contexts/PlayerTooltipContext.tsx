import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Player } from '../types/game.d.ts';
import { PlayerPhoto } from '../components/PlayerPhoto';
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

const Tooltip = ({ player, x, y, year }: TooltipState & { year: number }) => {
  const pos = groupFor(player.position) as DraftPos;
  const age = year - player.birthYear;
  const keyStats = KEY_STATS[pos] ?? [];

  const left = x + 220 > window.innerWidth ? x - 228 : x + 16;
  const top = y + 288 > window.innerHeight ? window.innerHeight - 296 : y - 8;

  return createPortal(
    <div
      style={{ position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', width: 208 }}
      className="bg-vga-black border-2 border-vga-white shadow-[4px_4px_0_rgba(0,0,0,1)] font-mono"
    >
      <div className={`px-2 py-1 flex items-center gap-2 border-b border-vga-gray ${POS_BADGE[pos] ?? 'bg-vga-gray text-vga-black'}`}>
        <span className="text-[8px] font-bold shrink-0">{pos}</span>
        <span className="text-[8px] font-bold truncate">{player.fullName}</span>
      </div>
      <div className="flex gap-2 p-2">
        <PlayerPhoto playerId={player.id} size="md" className="shrink-0 border border-vga-gray" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-vga-bright-white text-[9px] font-bold leading-tight">{player.fullName}</div>
          <div className="text-vga-gray text-[7px]">{age} años · pico {player.peakAge}a</div>
          <div className="text-vga-yellow text-[12px] font-bold">{player.media}</div>
        </div>
      </div>
      <div className="px-2 pb-2 flex flex-col gap-0.5">
        {ALL_STATS.map(stat => {
          const val = (player.stats as Record<string, number>)[stat] ?? 0;
          const isKey = keyStats.includes(stat);
          return (
            <div key={stat} className="flex items-center gap-1">
              <span className={`text-[6px] w-6 shrink-0 ${isKey ? 'text-vga-yellow font-bold' : 'text-vga-gray'}`}>
                {STAT_LABELS[stat]}
              </span>
              <div className="flex-1 bg-vga-gray h-1.5">
                <div className={`h-full ${isKey ? 'bg-vga-yellow' : 'bg-vga-blue'}`} style={{ width: `${val}%` }} />
              </div>
              <span className={`text-[7px] w-5 text-right shrink-0 ${isKey ? 'text-vga-yellow font-bold' : 'text-vga-gray'}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export const PlayerTooltipProvider = ({ children, year }: { children: React.ReactNode; year: number }) => {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((player: Player, x: number, y: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTip({ player, x, y });
  }, []);

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setTip(null), 80);
  }, []);

  return (
    <PlayerTooltipContext.Provider value={{ show, hide }}>
      {children}
      {tip && <Tooltip {...tip} year={year} />}
    </PlayerTooltipContext.Provider>
  );
};

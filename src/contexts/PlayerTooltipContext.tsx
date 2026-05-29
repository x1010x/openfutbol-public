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

const RADAR_AXES_OUTFIELD: { stat: string; label: string }[] = [
  { stat: 'speed', label: 'VEL' },
  { stat: 'shooting', label: 'TIR' },
  { stat: 'dribbling', label: 'DRI' },
  { stat: 'passing', label: 'PAS' },
  { stat: 'defending', label: 'DEF' },
  { stat: 'physical', label: 'FIS' },
];
const RADAR_AXES_GK: { stat: string; label: string }[] = [
  { stat: 'goalkeeping', label: 'POR' },
  { stat: 'defending', label: 'DEF' },
  { stat: 'speed', label: 'VEL' },
  { stat: 'physical', label: 'FIS' },
  { stat: 'passing', label: 'PAS' },
  { stat: 'shooting', label: 'TIR' },
];

const Radar = ({ stats, isGK, size = 160 }: { stats: Record<string, number>; isGK: boolean; size?: number }) => {
  const axes = isGK ? RADAR_AXES_GK : RADAR_AXES_OUTFIELD;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const N = axes.length;
  const point = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };
  const labelPos = (i: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * (r + 12), cy + Math.sin(angle) * (r + 12)];
  };
  const ringPath = (frac: number) =>
    axes.map((_, i) => point(i, frac)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const playerPoints = axes.map(({ stat }, i) => point(i, Math.max(0, Math.min(1, (stats[stat] ?? 0) / 100))));
  const playerPath = playerPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="shrink-0">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="#5555aa" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#444477" strokeWidth="0.8" />;
      })}
      <path d={playerPath} fill="rgba(255,255,85,0.45)" stroke="#ffff55" strokeWidth="2" />
      {playerPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#ffff55" />
      ))}
      {axes.map(({ label }, i) => {
        const [x, y] = labelPos(i);
        return (
          <text key={label} x={x} y={y} fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fill="#ffffff">
            {label}
          </text>
        );
      })}
    </svg>
  );
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
  const isGK = pos === 'POR';
  const s = player.seasonStats ?? { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, cleanSheets: 0, goalsAgainst: 0 };
  const avgMin = s.appearances > 0 ? Math.round(s.minutes / s.appearances) : 0;

  const W = 440;
  const H = 460;
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
        <PlayerPhoto sourceId={player.source_id} size="xl" className="shrink-0 border-2 border-vga-gray" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="text-vga-cyan text-[10px]">#{player.number} · {age} años · pico {player.peakAge}a</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div>
              <span className="text-vga-cyan text-[11px] font-bold mr-1">CA</span>
              <span className="text-vga-yellow text-[20px] font-bold">{caDisplay}</span>
            </div>
            <div>
              <span className="text-vga-cyan text-[11px] font-bold mr-1">PA</span>
              <span className="text-vga-light-green text-[16px] font-bold">{paDisplay}</span>
            </div>
          </div>
          <div className="text-vga-bright-white text-[11px] mt-0.5">
            <span title="Valor">🪙</span> {fmtEur(player.value)}
            {contractExp && <> · <span title="Contrato">📅</span> {contractExp}</>}
          </div>
          {player.fifa_year && (
            <div className="text-vga-magenta text-[10px] font-bold">FIFA {player.fifa_year}</div>
          )}
        </div>
      </div>

      {/* Radar */}
      <div className="flex items-center justify-center py-1 border-b border-vga-gray bg-vga-black">
        <Radar stats={player.stats as unknown as Record<string, number>} isGK={isGK} size={150} />
      </div>

      {/* Season stats */}
      <div className="px-3 py-2 border-b border-vga-gray">
        <div className="text-vga-cyan text-[10px] font-bold uppercase mb-1">Temporada</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[14px]" title="Partidos jugados">📊</div>
            <div className="text-vga-bright-white text-[14px] font-bold">{s.appearances}</div>
          </div>
          {isGK ? (
            <>
              <div>
                <div className="text-[14px]" title="Porterías imbatidas">❤️</div>
                <div className="text-vga-bright-white text-[14px] font-bold">{s.cleanSheets ?? 0}</div>
              </div>
              <div>
                <div className="text-[14px]" title="Goles encajados">🧤</div>
                <div className="text-vga-bright-white text-[14px] font-bold">{s.goalsAgainst ?? 0}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[14px]" title="Goles">⚽</div>
                <div className="text-vga-light-green text-[14px] font-bold">{s.goals}</div>
              </div>
              <div>
                <div className="text-[14px]" title="Asistencias">👟</div>
                <div className="text-vga-cyan text-[14px] font-bold">{s.assists}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-[14px]" title="Minutos / partido">🕒</div>
            <div className="text-vga-bright-white text-[14px] font-bold">{avgMin}</div>
          </div>
        </div>
        {(s.yellowCards > 0 || s.redCards > 0) && (
          <div className="flex justify-center gap-3 mt-1 text-[12px]">
            {s.yellowCards > 0 && <span className="text-vga-yellow font-bold">🟨 {s.yellowCards}</span>}
            {s.redCards > 0 && <span className="text-vga-red font-bold">🟥 {s.redCards}</span>}
          </div>
        )}
      </div>

      {/* Key stat callouts (replaces bars list — radar shows the full shape) */}
      <div className="flex justify-around px-3 py-1 border-b border-vga-gray">
        {keyStats.map(stat => {
          const val = (player.stats as unknown as Record<string, number>)[stat] ?? 0;
          return (
            <div key={stat} className="flex flex-col items-center">
              <span className="text-vga-yellow text-[11px] font-bold">{STAT_LABELS[stat]}</span>
              <span className="text-vga-bright-white text-[16px] font-bold">{val}</span>
            </div>
          );
        })}
      </div>

      {(player.injuryWeeksRemaining ?? 0) > 0 && (
        <div className="px-3 py-1 bg-vga-red text-vga-bright-white text-[11px] font-bold uppercase">
          🩼 Lesionado · {player.injuryWeeksRemaining}s
        </div>
      )}
      {player.suspensionMatches > 0 && (
        <div className="px-3 py-1 bg-vga-red text-vga-bright-white text-[11px] font-bold uppercase">
          ⚖️ Sancionado · {player.suspensionMatches}j
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

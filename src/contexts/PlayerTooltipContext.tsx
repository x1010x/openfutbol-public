import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Team } from '../types/game.d.ts';
import { PlayerPhoto } from '../components/PlayerPhoto';
import { CountryBadge } from '../components/CountryBadge';
import { TeamCrest } from '../components/TeamCrest';
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

const Radar = ({ stats, isGK, size = 110 }: { stats: Record<string, number>; isGK: boolean; size?: number }) => {
  const axes = isGK ? RADAR_AXES_GK : RADAR_AXES_OUTFIELD;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const N = axes.length;
  const point = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };
  const labelPos = (i: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * (r + 8), cy + Math.sin(angle) * (r + 8)];
  };
  const ringPath = (frac: number) =>
    axes.map((_, i) => point(i, frac)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const playerPoints = axes.map(({ stat }, i) => point(i, Math.max(0, Math.min(1, (stats[stat] ?? 0) / 100))));
  const playerPath = playerPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="shrink-0">
      {[0.33, 0.66, 1].map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="#5555aa" strokeWidth="0.6" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#444477" strokeWidth="0.6" />;
      })}
      <path d={playerPath} fill="rgba(255,255,85,0.4)" stroke="#ffff55" strokeWidth="1.4" />
      {playerPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill="#ffff55" />
      ))}
      {axes.map(({ label }, i) => {
        const [x, y] = labelPos(i);
        return (
          <text key={label} x={x} y={y} fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fill="#ffffff">
            {label}
          </text>
        );
      })}
    </svg>
  );
};

const Tooltip = ({ player, x, y, year, team }: TooltipState & { year: number; team: { id: string; name: string; colors?: string[] } | null }) => {
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
  const totalMin = s.minutes;
  const avgMin = s.appearances > 0 ? Math.round(s.minutes / s.appearances) : 0;
  const goalsPer90 = totalMin > 0 ? ((s.goals * 90) / totalMin).toFixed(2) : '0';
  const assistsPer90 = totalMin > 0 ? ((s.assists * 90) / totalMin).toFixed(2) : '0';

  const W = 380;
  const H = 540;
  const left = x + W + 20 > window.innerWidth ? x - W - 8 : x + 16;
  const top = y + H > window.innerHeight ? Math.max(8, window.innerHeight - H - 8) : y - 8;

  return createPortal(
    <div
      style={{ position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none', width: W }}
      className="bg-vga-black border-2 border-vga-white shadow-[4px_4px_0_rgba(0,0,0,1)] font-mono"
    >
      {/* Header */}
      <div className={`px-2 py-1 flex items-center gap-2 border-b border-vga-gray ${POS_BADGE[pos] ?? 'bg-vga-gray text-vga-black'}`}>
        <span className="text-[10px] font-bold shrink-0">{pos}</span>
        <span className="text-[11px] font-bold truncate flex-1">{player.fullName}</span>
        {player.country_code && (
          <span className="shrink-0"><CountryBadge code={player.country_code} size="sm" /></span>
        )}
      </div>
      {team && (
        <div className="px-2 py-1 flex items-center gap-2 border-b border-vga-gray bg-vga-blue/30">
          <TeamCrest colors={team.colors} size="sm" teamId={team.id} title={team.name} />
          <span className="text-vga-bright-white text-[10px] uppercase truncate">{team.name}</span>
        </div>
      )}

      {/* Photo + meta */}
      <div className="flex gap-2 p-2 border-b border-vga-gray">
        <PlayerPhoto sourceId={player.source_id} size="lg" className="shrink-0 border border-vga-gray" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 text-[9px]">
          <div className="text-vga-cyan">#{player.number} · {age}a · pico {player.peakAge}a</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span><span className="text-vga-cyan font-bold">CA</span> <span className="text-vga-yellow text-[14px] font-bold">{caDisplay}</span></span>
            <span><span className="text-vga-cyan font-bold">PA</span> <span className="text-vga-light-green text-[12px] font-bold">{paDisplay}</span></span>
          </div>
          <div className="text-vga-bright-white">
            <span className="text-vga-cyan">€</span> {fmtEur(player.value)}
            {contractExp && <> · <span className="text-vga-cyan">⌛</span> {contractExp}</>}
          </div>
          {player.contract?.salary != null && (
            <div className="text-vga-light-red leading-tight">
              <div>sueldo {fmtEur(player.contract.salary)}/sem</div>
              <div className="text-vga-gray text-[7px]">{fmtEur(player.contract.salary * 52)} anual</div>
            </div>
          )}
          {player.stats_year && (
            <div className="text-vga-magenta font-bold">{player.stats_year}</div>
          )}
        </div>
      </div>

      {/* Radar + key stats inline */}
      <div className="flex items-center gap-1 border-b border-vga-gray bg-vga-black px-2 py-1">
        <Radar stats={player.stats as unknown as Record<string, number>} isGK={isGK} size={110} />
        <div className="flex flex-col gap-1 flex-1 text-[9px]">
          {keyStats.map(stat => {
            const val = (player.stats as unknown as Record<string, number>)[stat] ?? 0;
            const pct = Math.min(100, Math.max(0, val));
            return (
              <div key={stat}>
                <div className="flex justify-between">
                  <span className="text-vga-yellow font-bold">{STAT_LABELS[stat]}</span>
                  <span className="text-vga-bright-white font-bold">{val}</span>
                </div>
                <div className="h-1 bg-vga-blue/40 border border-vga-blue mt-0.5">
                  <div className="h-full bg-vga-yellow" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Season stats compact */}
      <div className="px-2 py-1 border-b border-vga-gray">
        <div className="text-vga-cyan text-[8px] font-bold uppercase tracking-widest mb-1">Temporada</div>
        <div className="grid grid-cols-4 gap-1 text-center tabular-nums">
          <div>
            <div className="text-vga-magenta text-[7px] uppercase">PJ</div>
            <div className="text-vga-bright-white text-[11px] font-bold">{s.appearances}</div>
          </div>
          {isGK ? (
            <>
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">PI</div>
                <div className="text-vga-light-green text-[11px] font-bold">{s.cleanSheets ?? 0}</div>
              </div>
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">GC</div>
                <div className="text-vga-light-red text-[11px] font-bold">{s.goalsAgainst ?? 0}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">G</div>
                <div className="text-vga-light-green text-[11px] font-bold">{s.goals}</div>
              </div>
              <div>
                <div className="text-vga-magenta text-[7px] uppercase">A</div>
                <div className="text-vga-light-cyan text-[11px] font-bold">{s.assists}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-vga-magenta text-[7px] uppercase">Min</div>
            <div className="text-vga-bright-white text-[11px] font-bold">{totalMin}</div>
            {avgMin > 0 && <div className="text-vga-gray text-[7px]">{avgMin}/p</div>}
          </div>
        </div>
        {!isGK && totalMin > 0 && (s.goals > 0 || s.assists > 0) && (
          <div className="flex justify-center gap-3 text-[8px] mt-1 text-vga-gray">
            <span>G/90 <span className="text-vga-light-green font-bold">{goalsPer90}</span></span>
            <span>A/90 <span className="text-vga-light-cyan font-bold">{assistsPer90}</span></span>
          </div>
        )}
        {(s.yellowCards > 0 || s.redCards > 0) && (
          <div className="flex justify-center gap-2 mt-1 text-[9px]">
            {s.yellowCards > 0 && <span className="text-vga-yellow font-bold flex items-center gap-1"><span className="inline-block w-1.5 h-2 bg-vga-yellow border border-black" />{s.yellowCards}</span>}
            {s.redCards > 0 && <span className="text-vga-light-red font-bold flex items-center gap-1"><span className="inline-block w-1.5 h-2 bg-vga-light-red border border-black" />{s.redCards}</span>}
          </div>
        )}
      </div>

      {(player.injuryWeeksRemaining ?? 0) > 0 && (
        <div className="px-2 py-0.5 bg-vga-red text-vga-bright-white text-[9px] font-bold uppercase">
          Lesionado · {player.injuryWeeksRemaining}s
        </div>
      )}
      {player.suspensionMatches > 0 && (
        <div className="px-2 py-0.5 bg-vga-red text-vga-bright-white text-[9px] font-bold uppercase">
          Sancionado · {player.suspensionMatches}j
        </div>
      )}
    </div>,
    document.body,
  );
};

export const PlayerTooltipProvider = ({ children, year, teams }: { children: React.ReactNode; year: number; teams?: Team[] }) => {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map every player id to its team so the tooltip can pop the right crest.
  const teamByPlayerId = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams ?? []) for (const p of t.players) m.set(p.id, t);
    return m;
  }, [teams]);

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
      {tip && <Tooltip {...tip} year={year} team={teamByPlayerId.get(tip.player.id) ?? null} />}
    </PlayerTooltipContext.Provider>
  );
};

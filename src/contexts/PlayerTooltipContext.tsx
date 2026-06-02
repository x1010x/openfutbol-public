import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Player, Team } from '../types/game.d.ts';
import { PlayerPhoto } from '../components/PlayerPhoto';
import { CountryBadge } from '../components/CountryBadge';
import { TeamCrest } from '../components/TeamCrest';
import { groupFor } from '../store/leagueStore';
import { MOOD, moodStateOf } from '../engine/playerMood';

type DraftPos = 'POR' | 'DEF' | 'MED' | 'DEL';

const POS_ACCENT: Record<string, { color: string; glow: string }> = {
  POR: { color: '#ffe94d', glow: 'rgba(255, 233, 77, 0.7)' },
  DEF: { color: '#33f3ff', glow: 'rgba(51, 243, 255, 0.7)' },
  MED: { color: '#6dff9b', glow: 'rgba(109, 255, 155, 0.7)' },
  DEL: { color: '#ff5c8a', glow: 'rgba(255, 92, 138, 0.7)' },
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

const Radar = ({ stats, isGK, accent = '#33f3ff', size = 130 }: { stats: Record<string, number>; isGK: boolean; accent?: string; size?: number }) => {
  const axes = isGK ? RADAR_AXES_GK : RADAR_AXES_OUTFIELD;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const N = axes.length;
  const point = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };
  const labelPos = (i: number) => {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * (r + 9), cy + Math.sin(angle) * (r + 9)];
  };
  const ringPath = (frac: number) =>
    axes.map((_, i) => point(i, frac)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const playerPoints = axes.map(({ stat }, i) => point(i, Math.max(0, Math.min(1, (stats[stat] ?? 0) / 100))));
  const playerPath = playerPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const glow = accent.replace(')', ', 0.55)').replace('rgb', 'rgba');

  return (
    <svg width={size} height={size} className="shrink-0" style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}>
      {[0.33, 0.66, 1].map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="#3a3a5e" strokeWidth="0.6" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2a2a48" strokeWidth="0.6" />;
      })}
      <path d={playerPath} fill={glow.startsWith('rgba') ? glow : accent + '55'} stroke={accent} strokeWidth="1.5" />
      {playerPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill={accent} />
      ))}
      {axes.map(({ label }, i) => {
        const [x, y] = labelPos(i);
        return (
          <text key={label} x={x} y={y} fontSize="8" fontFamily="'Press Start 2P', monospace" textAnchor="middle" dominantBaseline="middle" fill="#cfcfd9" letterSpacing="0.05em">
            {label}
          </text>
        );
      })}
    </svg>
  );
};

const MOOD_NEON = ['#ff5c8a', '#ff9966', '#ffe94d', '#33f3ff', '#6dff9b'];

const Tooltip = ({ player, x, y, year, team }: TooltipState & { year: number; team: { id: string; name: string; colors?: string[]; lineup?: string[] } | null }) => {
  const pos = groupFor(player.position) as DraftPos;
  const age = year - player.birthYear;
  const ca = player.current_ability ?? player.media * 2;
  const caDisplay = Math.round(ca / 2);
  const contractExp = player.contract?.expiration?.slice(0, 4);
  const isGK = pos === 'POR';
  const s = player.seasonStats ?? { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, cleanSheets: 0, goalsAgainst: 0 };
  const totalMin = s.minutes;
  const avgMin = s.appearances > 0 ? Math.round(s.minutes / s.appearances) : 0;
  const goalsPer90 = totalMin > 0 ? ((s.goals * 90) / totalMin).toFixed(2) : '0';
  const assistsPer90 = totalMin > 0 ? ((s.assists * 90) / totalMin).toFixed(2) : '0';

  const accent = (POS_ACCENT[pos] ?? POS_ACCENT.MED).color;
  const accentGlow = (POS_ACCENT[pos] ?? POS_ACCENT.MED).glow;

  // Stamina / Mood / Form (avg rating) for the right side info column.
  const stamina = Math.max(0, Math.min(99, player.stamina ?? 99));
  const inLineup = !!team?.lineup?.includes(player.id);
  const moodIdx = moodStateOf(player, inLineup);
  const mood = MOOD[moodIdx];
  const formRating = s.appearances > 0 ? (s.ratingSum / s.appearances) : null;
  const formColor = formRating == null ? '#5a5a7a'
    : formRating >= 7.5 ? '#6dff9b'
    : formRating >= 6.5 ? '#33f3ff'
    : formRating >= 5.5 ? '#ffe94d'
    : '#ff5c8a';
  const staminaColor = stamina >= 75 ? '#6dff9b' : stamina >= 50 ? '#ffe94d' : '#ff5c8a';

  const W = 480;
  const H = 520;
  const left = x + W + 20 > window.innerWidth ? x - W - 8 : x + 16;
  const top = y + H > window.innerHeight ? Math.max(8, window.innerHeight - H - 8) : y - 8;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left, top,
        zIndex: 9999,
        pointerEvents: 'none',
        width: W,
        background: 'rgba(5, 0, 13, 0.95)',
        border: `1px solid ${accent}`,
        boxShadow: `0 0 22px ${accentGlow}, inset 0 0 18px rgba(0, 0, 0, 0.6)`,
        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
      }}
      className="font-mono"
    >
      {/* Header — position pill, name, country */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${accent}55`, background: `linear-gradient(90deg, ${accent}22 0%, transparent 60%)` }}>
        <span
          className="text-[8px] font-bold shrink-0 px-1.5 py-0.5"
          style={{
            color: accent,
            border: `1px solid ${accent}`,
            textShadow: `0 0 6px ${accentGlow}`,
            letterSpacing: '0.15em',
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
            fontFamily: "'Press Start 2P', monospace",
          }}
        >
          {pos}
        </span>
        <span
          className="text-[11px] font-bold truncate flex-1 text-white"
          style={{ textShadow: '0 0 6px rgba(255,255,255,0.4)', fontFamily: "'Press Start 2P', monospace", letterSpacing: '0.05em' }}
        >
          {player.fullName}
        </span>
        {player.country_code && (
          <span className="shrink-0"><CountryBadge code={player.country_code} size="sm" /></span>
        )}
      </div>

      {/* Team strip */}
      {team && (
        <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: '1px solid #2a2a48', background: 'rgba(9, 0, 20, 0.6)' }}>
          <TeamCrest colors={team.colors} size="sm" teamId={team.id} title={team.name} />
          <span className="text-[10px] uppercase truncate" style={{ color: '#33f3ff', letterSpacing: '0.12em', textShadow: '0 0 5px rgba(51, 243, 255, 0.5)' }}>{team.name}</span>
          {player.stats_year && (
            <span className="ml-auto text-[8px] px-1.5 py-0.5" style={{ color: '#ff4df8', border: '1px solid #ff4df8', textShadow: '0 0 5px rgba(255, 77, 248, 0.6)', letterSpacing: '0.12em' }}>
              {player.stats_year}
            </span>
          )}
        </div>
      )}

      {/* Identity row: photo + key facts grid */}
      <div className="flex gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid #2a2a48' }}>
        <PlayerPhoto sourceId={player.source_id} size="lg" className="shrink-0" />
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <KV k="#" v={`${player.number}`} />
          <KV k="Edad" v={`${age}a`} />
          <KV k="CA" v={`${caDisplay}`} valueColor={accent} valueGlow={accentGlow} big />
          <KV k="Pico" v={`${player.peakAge}a`} />
          <KV k="Valor" v={fmtEur(player.value)} valueColor="#6dff9b" />
          {contractExp && <KV k="Contrato" v={contractExp} valueColor="#33f3ff" />}
          {player.contract?.salary != null && (
            <>
              <KV k="Sueldo" v={`${fmtEur(player.contract.salary)}/sem`} valueColor="#ff5c8a" />
              <KV k="Anual" v={fmtEur(player.contract.salary * 52)} valueColor="#8a8aa8" />
            </>
          )}
        </div>
      </div>

      {/* Radar + condition column */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: '1px solid #2a2a48' }}>
        <Radar stats={player.stats as unknown as Record<string, number>} isGK={isGK} accent={accent} size={150} />
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div>
            <div className="flex justify-between items-baseline">
              <span style={{ color: '#8a8aa8', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", letterSpacing: '0.12em' }}>FORMA</span>
              <span style={{ color: staminaColor, textShadow: `0 0 5px ${staminaColor}99`, fontSize: '15px', fontFamily: "'VT323', monospace", fontWeight: 'bold', lineHeight: 1 }}>{stamina}</span>
            </div>
            <div className="h-2 mt-1" style={{ background: 'rgba(9, 0, 20, 0.8)', border: '1px solid #2a2a48' }}>
              <div className="h-full" style={{ width: `${stamina}%`, background: staminaColor, boxShadow: `0 0 8px ${staminaColor}` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <span style={{ color: '#8a8aa8', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", letterSpacing: '0.12em' }}>ÁNIMO</span>
              <span style={{ color: MOOD_NEON[moodIdx], textShadow: `0 0 5px ${MOOD_NEON[moodIdx]}99`, fontSize: '15px', fontFamily: "'VT323', monospace", fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1, textTransform: 'uppercase' }}>
                {mood.label}
              </span>
            </div>
            <div className="flex gap-1 mt-1.5">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="flex-1 h-1.5" style={{
                  background: i <= moodIdx ? MOOD_NEON[moodIdx] : 'rgba(9, 0, 20, 0.8)',
                  border: '1px solid #2a2a48',
                  boxShadow: i <= moodIdx ? `0 0 6px ${MOOD_NEON[moodIdx]}` : undefined,
                }} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline">
              <span style={{ color: '#8a8aa8', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", letterSpacing: '0.12em' }}>NOTA</span>
              <span style={{ color: formColor, textShadow: `0 0 6px ${formColor}99`, fontSize: '18px', fontFamily: "'VT323', monospace", fontWeight: 'bold', lineHeight: 1 }}>
                {formRating != null ? formRating.toFixed(2) : '—'}
              </span>
            </div>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: '12px', color: '#5a5a7a', marginTop: 2 }}>
              media · {s.appearances} {s.appearances === 1 ? 'partido' : 'partidos'}
            </div>
          </div>
        </div>
      </div>

      {/* Temporada compact */}
      <div className="px-3 py-2" style={{ borderBottom: ((player.injuryWeeksRemaining ?? 0) > 0 || player.suspensionMatches > 0) ? '1px solid #2a2a48' : 'none' }}>
        <div className="text-[8px] uppercase mb-1.5" style={{ color: '#ff4df8', letterSpacing: '0.2em', textShadow: '0 0 5px rgba(255, 77, 248, 0.6)', fontFamily: "'Press Start 2P', monospace" }}>
          Temporada
        </div>
        <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
          <SeasonCell label="PJ" value={s.appearances} color="#ffffff" />
          {isGK ? (
            <>
              <SeasonCell label="PI" value={s.cleanSheets ?? 0} color="#6dff9b" />
              <SeasonCell label="GC" value={s.goalsAgainst ?? 0} color="#ff5c8a" />
            </>
          ) : (
            <>
              <SeasonCell label="G" value={s.goals} color="#6dff9b" />
              <SeasonCell label="A" value={s.assists} color="#33f3ff" />
            </>
          )}
          <SeasonCell label="Min" value={totalMin} color="#ffffff" sub={avgMin > 0 ? `${avgMin}/p` : undefined} />
        </div>
        {!isGK && totalMin > 0 && (s.goals > 0 || s.assists > 0) && (
          <div className="flex justify-center gap-4 text-[9px] mt-2" style={{ fontFamily: "'VT323', monospace", fontSize: '13px', color: '#8a8aa8' }}>
            <span>G/90 <span style={{ color: '#6dff9b', textShadow: '0 0 5px rgba(109, 255, 155, 0.6)' }} className="font-bold">{goalsPer90}</span></span>
            <span>A/90 <span style={{ color: '#33f3ff', textShadow: '0 0 5px rgba(51, 243, 255, 0.6)' }} className="font-bold">{assistsPer90}</span></span>
          </div>
        )}
        {(s.yellowCards > 0 || s.redCards > 0) && (
          <div className="flex justify-center gap-3 mt-2 text-[10px]">
            {s.yellowCards > 0 && (
              <span className="flex items-center gap-1.5 font-bold" style={{ color: '#ffe94d', textShadow: '0 0 5px rgba(255, 233, 77, 0.6)' }}>
                <span className="inline-block w-2 h-2.5" style={{ background: '#ffe94d', boxShadow: '0 0 4px #ffe94d' }} />
                {s.yellowCards}
              </span>
            )}
            {s.redCards > 0 && (
              <span className="flex items-center gap-1.5 font-bold" style={{ color: '#ff5c8a', textShadow: '0 0 5px rgba(255, 92, 138, 0.6)' }}>
                <span className="inline-block w-2 h-2.5" style={{ background: '#ff5c8a', boxShadow: '0 0 4px #ff5c8a' }} />
                {s.redCards}
              </span>
            )}
          </div>
        )}
      </div>

      {(player.injuryWeeksRemaining ?? 0) > 0 && (
        <div className="px-3 py-1 text-[9px] font-bold uppercase" style={{ background: 'rgba(255, 92, 138, 0.18)', color: '#ff5c8a', textShadow: '0 0 5px rgba(255, 92, 138, 0.7)', letterSpacing: '0.15em', fontFamily: "'Press Start 2P', monospace" }}>
          Lesionado · {player.injuryWeeksRemaining}s
        </div>
      )}
      {player.suspensionMatches > 0 && (
        <div className="px-3 py-1 text-[9px] font-bold uppercase" style={{ background: 'rgba(255, 92, 138, 0.18)', color: '#ff5c8a', textShadow: '0 0 5px rgba(255, 92, 138, 0.7)', letterSpacing: '0.15em', fontFamily: "'Press Start 2P', monospace" }}>
          Sancionado · {player.suspensionMatches}j
        </div>
      )}
    </div>,
    document.body,
  );
};

const KV = ({ k, v, valueColor = '#ffffff', valueGlow, big }: { k: string; v: string; valueColor?: string; valueGlow?: string; big?: boolean }) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span
      className="shrink-0"
      style={{ color: '#8a8aa8', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", letterSpacing: '0.12em' }}
    >
      {k}
    </span>
    <span
      className="truncate font-bold"
      style={{
        color: valueColor,
        textShadow: valueGlow ? `0 0 6px ${valueGlow}` : undefined,
        fontSize: big ? '18px' : '15px',
        fontFamily: "'VT323', monospace",
        letterSpacing: '0.04em',
        lineHeight: 1,
      }}
    >
      {v}
    </span>
  </div>
);

const SeasonCell = ({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) => (
  <div>
    <div style={{ color: '#ff4df8', fontSize: '9px', letterSpacing: '0.12em', textShadow: '0 0 4px rgba(255, 77, 248, 0.5)', fontFamily: "'Press Start 2P', monospace" }}>{label}</div>
    <div className="mt-1" style={{ color, textShadow: `0 0 5px ${color}99`, fontSize: '18px', fontFamily: "'VT323', monospace", fontWeight: 'bold', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: '#5a5a7a', fontFamily: "'VT323', monospace", fontSize: '12px', marginTop: 2 }}>{sub}</div>}
  </div>
);

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
      {tip && (() => {
        const t = teamByPlayerId.get(tip.player.id);
        const teamProp = t ? { id: t.id, name: t.name, colors: t.colors, lineup: t.lineup } : null;
        return <Tooltip {...tip} year={year} team={teamProp} />;
      })()}
    </PlayerTooltipContext.Provider>
  );
};

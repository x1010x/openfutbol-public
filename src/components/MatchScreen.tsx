import { useEffect, useRef } from 'react';
import type { FormationId, MatchState, Position } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { FORMATIONS, liveMed } from '../engine/formations';
import { formatJornadaDate } from '../engine/calendar';
import { engineSettings } from '../engine/engineSettings';
import { TeamCrest } from './TeamCrest';

const MAX_EVENT_CHARS = 90;
const truncate = (s: string, n = MAX_EVENT_CHARS) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const shirtName = (p: { last_name?: string; name?: string } | null | undefined): string => {
  if (!p) return '—';
  if (p.last_name && p.last_name.trim()) return p.last_name.trim();
  const full = (p.name || '').trim();
  if (!full) return '—';
  // Fallback: last whitespace-separated token of the full name
  const parts = full.split(/\s+/);
  return parts[parts.length - 1];
};

interface Props {
  match: MatchState;
  userTeamId: string;
  year: number;
  currentJornada: number;
  budget: number;
  isPlaying: boolean;
  showSubPanel: boolean;
  htPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onShowSubs: () => void;
  onPlayerClick?: (playerId: string) => void;
  onContinue: () => void;
  stats?: Record<string, import('../store/leagueStore').TeamStats>;
  schedule?: import('../engine/calendar').Jornada[];
}

// Mini-pitch layouts in a 0-100 / 0-100 viewBox. Each team renders into its own half.
const MINI_LAYOUTS: Record<FormationId, [number, number][]> = {
  '4-4-2': [
    [50, 96],
    [18, 78], [38, 78], [62, 78], [82, 78],
    [18, 54], [38, 54], [62, 54], [82, 54],
    [35, 24], [65, 24],
  ],
  '5-3-2': [
    [50, 96],
    [12, 78], [32, 78], [50, 78], [68, 78], [88, 78],
    [25, 54], [50, 54], [75, 54],
    [35, 24], [65, 24],
  ],
  '4-3-3': [
    [50, 96],
    [18, 78], [38, 78], [62, 78], [82, 78],
    [25, 54], [50, 54], [75, 54],
    [15, 24], [50, 24], [85, 24],
  ],
  '4-2-4': [
    [50, 96],
    [18, 76], [38, 76], [62, 76], [82, 76],
    [35, 56], [65, 56],
    [12, 24], [38, 24], [62, 24], [88, 24],
  ],
  '5-4-1': [
    [50, 96],
    [12, 78], [32, 78], [50, 78], [68, 78], [88, 78],
    [18, 54], [38, 54], [62, 54], [82, 54],
    [50, 24],
  ],
  '3-4-3': [
    [50, 96],
    [25, 78], [50, 78], [75, 78],
    [18, 54], [38, 54], [62, 54], [82, 54],
    [15, 24], [50, 24], [85, 24],
  ],
};

function eventIcon(type: string): string {
  switch (type) {
    case 'goal': return '⚽';
    case 'yellow': return '■';
    case 'red': return '■';
    case 'sub': return '⇄';
    case 'injury': return '+';
    case 'shot': return '·';
    default: return '›';
  }
}

function eventColor(type: string): string {
  switch (type) {
    case 'goal': return 'text-vga-light-green';
    case 'yellow': return 'text-vga-yellow';
    case 'red': return 'text-vga-light-red';
    case 'sub': return 'text-vga-light-green';
    case 'injury': return 'text-vga-light-red';
    default: return 'text-vga-white';
  }
}

function eventText(e: MatchState['events'][number], match: MatchState): string {
  if (e.description) return e.description;
  const team = e.teamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
  const p = team.players.find(pl => pl.id === e.playerId);
  const name = shirtName(p);
  switch (e.type) {
    case 'goal': return `Gol de ${name}.`;
    case 'yellow': return `Amarilla para ${name}.`;
    case 'red': return `Roja para ${name}.`;
    case 'sub': {
      const off = team.players.find(pl => pl.id === e.playerOffId);
      return `Cambio: entra ${name}${off ? `, sale ${shirtName(off)}` : ''}.`;
    }
    case 'injury': return `${name} se lesiona.`;
    case 'shot': return `Disparo de ${name}.`;
    default: return '';
  }
}

function staminaFill(stam: number): string {
  if (stam >= 70) return '#55ff55';
  if (stam >= 40) return '#ffff55';
  return '#ff5555';
}

function MiniPitch({ match, userTeamId, onPlayerClick }: { match: MatchState; userTeamId: string; onPlayerClick?: (playerId: string) => void }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const homeLayout = MINI_LAYOUTS[home.formation] ?? MINI_LAYOUTS['4-4-2'];
  const awayLayout = MINI_LAYOUTS[away.formation] ?? MINI_LAYOUTS['4-4-2'];

  const lookup = (id: string | undefined, team: typeof match.homeTeam) => {
    if (!id) return null;
    return team.players.find(pl => pl.id === id) ?? null;
  };
  const shortName = (p: ReturnType<typeof lookup>): string => {
    if (!p) return '';
    const raw = p.last_name || p.name || '';
    return raw.length > 9 ? raw.slice(0, 9) : raw;
  };

  // Horizontal pitch — home attacks right, away attacks left.
  // Original MINI_LAYOUTS were vertical (GK bottom, attackers top). Rotate so the GK sits
  // at the team's deep end (home: far left, away: far right) and attackers near halfway.
  // viewBox: 220 wide x 110 tall. Each half is 110 wide.
  const W = 220, H = 110;
  const PAD = 2;
  const halfW = (W / 2) - PAD; // playable width per half
  const playH = H - 2 * PAD;
  // For home: newX in [PAD, PAD+halfW] grows as origY shrinks (GK origY≈96 → near PAD; DEL origY≈22 → near halfway)
  const mapHome = (origX: number, origY: number): [number, number] => {
    const nx = PAD + ((110 - origY) / 110) * halfW;
    const ny = PAD + (origX / 100) * playH;
    return [nx, ny];
  };
  // For away: mirrored. GK origY≈96 → near right edge; DEL near halfway.
  const mapAway = (origX: number, origY: number): [number, number] => {
    const nx = W - PAD - ((110 - origY) / 110) * halfW;
    const ny = PAD + (origX / 100) * playH;
    return [nx, ny];
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={W} height={H} fill="#0a0a2a" />
      <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />
      <line x1={W / 2} y1={PAD} x2={W / 2} y2={H - PAD} stroke="#3a3a6a" strokeWidth={0.6} />
      <circle cx={W / 2} cy={H / 2} r={11} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />
      <circle cx={W / 2} cy={H / 2} r={0.8} fill="#3a3a6a" />
      {/* Penalty / 6-yard boxes (left = home, right = away) */}
      <rect x={PAD} y={H / 2 - 22} width={16} height={44} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />
      <rect x={W - PAD - 16} y={H / 2 - 22} width={16} height={44} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />
      <rect x={PAD} y={H / 2 - 10} width={6} height={20} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />
      <rect x={W - PAD - 6} y={H / 2 - 10} width={6} height={20} fill="none" stroke="#3a3a6a" strokeWidth={0.6} />

      {homeLayout.map(([x, y], i) => {
        const [cx, cy] = mapHome(x, y);
        const p = lookup(home.lineup[i], home);
        const stam = p ? (match.homeStamina[p.id] ?? p.stamina ?? 99) : 99;
        const fill = p ? staminaFill(stam) : '#666';
        const name = shortName(p);
        const slotPos: Position | undefined = FORMATIONS[home.formation]?.[i];
        const viv = p ? Math.max(1, Math.floor(liveMed({ ...p, stamina: stam }, stam, slotPos) / 2)) : null;
        const isUserSide = home.id === userTeamId;
        const clickable = !!(isUserSide && p && onPlayerClick);
        const handle = () => { if (clickable && p) onPlayerClick!(p.id); };
        return (
          <g key={`h${i}`} onClick={clickable ? handle : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
            <circle cx={cx} cy={cy} r={3.6} fill={fill} stroke="#000" strokeWidth={0.4} />
            {viv != null && (
              <text x={cx} y={cy + 1.1} textAnchor="middle" fill="#000" fontSize={2.6} fontFamily="monospace" fontWeight={700}>
                {viv}
              </text>
            )}
            {name && (
              <text x={cx} y={cy + 6.4} textAnchor="middle" fill="#ff5555" stroke="#000" strokeWidth={0.25} paintOrder="stroke" fontSize={2.8} fontFamily="'Press Start 2P', monospace" fontWeight={400}>
                {name.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      {awayLayout.map(([x, y], i) => {
        const [cx, cy] = mapAway(x, y);
        const p = lookup(away.lineup[i], away);
        const stam = p ? (match.awayStamina[p.id] ?? p.stamina ?? 99) : 99;
        const fill = p ? staminaFill(stam) : '#666';
        const name = shortName(p);
        const slotPos: Position | undefined = FORMATIONS[away.formation]?.[i];
        const viv = p ? Math.max(1, Math.floor(liveMed({ ...p, stamina: stam }, stam, slotPos) / 2)) : null;
        const isUserSide = away.id === userTeamId;
        const clickable = !!(isUserSide && p && onPlayerClick);
        const handle = () => { if (clickable && p) onPlayerClick!(p.id); };
        return (
          <g key={`a${i}`} onClick={clickable ? handle : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
            <circle cx={cx} cy={cy} r={3.6} fill={fill} stroke="#000" strokeWidth={0.4} />
            {viv != null && (
              <text x={cx} y={cy + 1.1} textAnchor="middle" fill="#000" fontSize={2.6} fontFamily="monospace" fontWeight={700}>
                {viv}
              </text>
            )}
            {name && (
              <text x={cx} y={cy + 6.4} textAnchor="middle" fill="#55ffff" stroke="#000" strokeWidth={0.25} paintOrder="stroke" fontSize={2.8} fontFamily="'Press Start 2P', monospace" fontWeight={400}>
                {name.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function MatchScreen({
  match, userTeamId, year, currentJornada, budget, stats, schedule,
  isPlaying, showSubPanel, htPaused,
  onPlay, onPause, onShowSubs, onPlayerClick, onContinue,
}: Props) {
  const eventLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [match.events.length]);

  const homeMED = Math.floor(calculateTeamStrength(match.homeTeam, match.homeSentOff, match.homeStamina) / 2);
  const awayMED = Math.floor(calculateTeamStrength(match.awayTeam, match.awaySentOff, match.awayStamina) / 2);

  // League position + last-5 form for both teams.
  const sortedStats = stats ? Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
  }) : [];
  const totalTeams = sortedStats.length;
  const positionOf = (teamId: string): number => sortedStats.findIndex(s => s.teamId === teamId) + 1;
  const last5FormOf = (teamId: string): ('W' | 'D' | 'L')[] => {
    if (!schedule) return [];
    const out: ('W' | 'D' | 'L')[] = [];
    for (let i = schedule.length - 1; i >= 0 && out.length < 5; i--) {
      const m = schedule[i].matches.find(x => x.played && (x.homeId === teamId || x.awayId === teamId));
      if (!m || m.homeScore == null || m.awayScore == null) continue;
      const isHome = m.homeId === teamId;
      const my = isHome ? m.homeScore : m.awayScore;
      const opp = isHome ? m.awayScore : m.homeScore;
      out.push(my > opp ? 'W' : my === opp ? 'D' : 'L');
    }
    return out.reverse();
  };
  const homePos = positionOf(match.homeTeam.id);
  const awayPos = positionOf(match.awayTeam.id);
  const homeForm = last5FormOf(match.homeTeam.id);
  const awayForm = last5FormOf(match.awayTeam.id);
  const homeStats = stats?.[match.homeTeam.id];
  const awayStats = stats?.[match.awayTeam.id];
  const formColor = (c: 'W' | 'D' | 'L') => c === 'W' ? 'bg-vga-light-green' : c === 'D' ? 'bg-vga-yellow' : 'bg-vga-light-red';

  const totalPoss = match.homePossession + match.awayPossession;
  const homePoss = totalPoss === 0 ? 50 : Math.round((match.homePossession / totalPoss) * 100);
  const awayPoss = 100 - homePoss;

  const allGoals = match.events
    .filter(e => e.type === 'goal')
    .map(g => ({ ...g, team: g.teamId === match.homeTeam.id ? 'home' as const : 'away' as const }))
    .sort((a, b) => a.minute - b.minute);

  const homeYellows = match.events.filter(e => e.type === 'yellow' && e.teamId === match.homeTeam.id);
  const awayYellows = match.events.filter(e => e.type === 'yellow' && e.teamId === match.awayTeam.id);
  const homeReds = match.events.filter(e => e.type === 'red' && e.teamId === match.homeTeam.id);
  const awayReds = match.events.filter(e => e.type === 'red' && e.teamId === match.awayTeam.id);
  const allCards = [
    ...homeReds.map(c => ({ ...c, color: 'red' as const, team: 'home' as const })),
    ...awayReds.map(c => ({ ...c, color: 'red' as const, team: 'away' as const })),
    ...homeYellows.map(c => ({ ...c, color: 'yellow' as const, team: 'home' as const })),
    ...awayYellows.map(c => ({ ...c, color: 'yellow' as const, team: 'away' as const })),
  ].sort((a, b) => a.minute - b.minute);

  const isUserHome = match.homeTeam.id === userTeamId;
  const userSubsUsed = isUserHome ? match.homeSubsUsed : match.awaySubsUsed;
  const canSub = userSubsUsed < 3 && !match.isFinished;

  const stadium = match.homeTeam.stadiumName || '—';
  const dateStr = formatJornadaDate(year, currentJornada);
  const cashStr = budget.toLocaleString('es-ES');

  const StatBar = ({ label, h, a }: { label: string; h: number; a: number }) => {
    const total = h + a;
    const hPct = total === 0 ? 50 : Math.round((h / total) * 100);
    const aPct = 100 - hPct;
    return (
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 text-[8px]">
        <span className="text-vga-light-red font-bold text-right">{h}</span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-vga-cyan uppercase tracking-wide">{label}</span>
          <div className="w-full flex h-1 border border-vga-gray">
            <div className="bg-vga-light-red h-full" style={{ width: `${hPct}%` }} />
            <div className="bg-vga-light-cyan h-full" style={{ width: `${aPct}%` }} />
          </div>
        </div>
        <span className="text-vga-light-cyan font-bold">{a}</span>
      </div>
    );
  };

  return (
    <div className="w-full border-2 border-vga-blue bg-vga-black p-2 vga-panel" style={{ maxWidth: `${engineSettings.matchScreenMaxWidthPx}px`, marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Top HUD */}
      <div className="flex items-center justify-between border border-vga-blue bg-vga-black px-3 py-1 text-[8px] uppercase">
        <div className="flex items-center gap-3 text-vga-cyan">
          <span className="text-vga-yellow">[*]</span>
          <span className="text-vga-bright-white">Liga {year}/{(year + 1) % 100}</span>
          <span className="text-vga-magenta">|</span>
          <span>Jornada {currentJornada}</span>
          <span className="text-vga-magenta">|</span>
          <span>{dateStr}</span>
          <span className="text-vga-magenta">|</span>
          <span className="truncate max-w-[16ch]" title={stadium}>{stadium}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-vga-cyan">CAJA</span>
          <span className="text-vga-yellow font-bold">{cashStr} €</span>
        </div>
      </div>

      {/* Scoreboard + possession (combined, compact) */}
      <div className="border border-vga-blue bg-vga-black mt-1 px-3 py-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-2 justify-end min-w-0">
            <div className="text-right min-w-0">
              <p className="text-vga-light-red text-[11px] truncate uppercase font-bold tracking-wide whitespace-nowrap">{match.homeTeam.name}</p>
              <p className="text-vga-cyan text-[7px]">
                MED {homeMED}
                {homePos > 0 && <span className="text-vga-magenta"> · POS {homePos}/{totalTeams}</span>}
                {homeStats && <span className="text-vga-gray"> · {homeStats.points}p</span>}
              </p>
              {homeForm.length > 0 && (
                <div className="flex gap-0.5 justify-end mt-0.5">
                  {homeForm.map((f, i) => (
                    <span key={i} className={`${formColor(f)} w-2.5 h-2.5 text-vga-black text-[6px] font-bold flex items-center justify-center leading-none`}>{f}</span>
                  ))}
                </div>
              )}
            </div>
            <TeamCrest colors={match.homeTeam.colors} size="lg" title={match.homeTeam.name} teamId={match.homeTeam.id} />
          </div>
          <div className="text-center px-2">
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-vga-light-red text-4xl font-bold leading-none">{match.homeScore}</span>
              <span className="text-vga-yellow text-[10px] leading-none">{match.minute}'</span>
              <span className="text-vga-light-cyan text-4xl font-bold leading-none">{match.awayScore}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-start min-w-0">
            <TeamCrest colors={match.awayTeam.colors} size="lg" title={match.awayTeam.name} teamId={match.awayTeam.id} />
            <div className="text-left min-w-0">
              <p className="text-vga-light-cyan text-[11px] truncate uppercase font-bold tracking-wide whitespace-nowrap">{match.awayTeam.name}</p>
              <p className="text-vga-cyan text-[7px]">
                MED {awayMED}
                {awayPos > 0 && <span className="text-vga-magenta"> · POS {awayPos}/{totalTeams}</span>}
                {awayStats && <span className="text-vga-gray"> · {awayStats.points}p</span>}
              </p>
              {awayForm.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {awayForm.map((f, i) => (
                    <span key={i} className={`${formColor(f)} w-2.5 h-2.5 text-vga-black text-[6px] font-bold flex items-center justify-center leading-none`}>{f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-vga-light-red text-[8px] font-bold w-8 text-right">{homePoss}%</span>
          <div className="flex-1 flex h-1.5 border border-vga-gray">
            <div className="bg-vga-light-red h-full" style={{ width: `${homePoss}%` }} />
            <div className="bg-vga-light-cyan h-full" style={{ width: `${awayPoss}%` }} />
          </div>
          <span className="text-vga-light-cyan text-[8px] font-bold w-8">{awayPoss}%</span>
        </div>
      </div>

      {/* 3-column dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-[0.9fr_2.2fr_1fr] gap-1 mt-1">
        {/* EVENTOS */}
        <div className="border border-vga-blue bg-vga-black flex flex-col">
          <div className="px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest">Eventos</div>
          <div ref={eventLogRef} className="flex-1 overflow-y-auto p-2 text-[8px] leading-snug" style={{ maxHeight: '16rem' }}>
            {match.events.length === 0 && (
              <div className="text-vga-gray italic">Sin eventos.</div>
            )}
            {match.events.map((e, i) => (
              <div key={i} className="flex gap-2 py-1 border-b border-vga-blue/40 last:border-b-0">
                <span className="text-vga-yellow font-mono w-8 flex-shrink-0">{e.minute}'</span>
                <span className={`w-3 flex-shrink-0 ${eventColor(e.type)}`}>{eventIcon(e.type)}</span>
                <span className="text-vga-bright-white">{truncate(eventText(e, match))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ALINEACIONES */}
        <div className="border border-vga-blue bg-vga-black flex flex-col">
          <div className="px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest">Alineaciones</div>
          <div className="p-2 flex-1 flex flex-col">
            <MiniPitch match={match} userTeamId={userTeamId} onPlayerClick={onPlayerClick} />
            <div className="flex justify-between mt-2 px-2 text-[10px] font-bold">
              <span className="text-vga-light-red">{match.homeTeam.formation}</span>
              <span className="text-vga-light-cyan">{match.awayTeam.formation}</span>
            </div>
          </div>
        </div>

        {/* GOLES + TARJETAS + ESTADÍSTICAS */}
        <div className="flex flex-col gap-2">
          <div className="border border-vga-blue bg-vga-black">
            <div className="px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest">Goles</div>
            <div className="p-2 text-[8px] max-h-20 overflow-y-auto">
              {allGoals.length === 0 && <div className="text-vga-gray italic">Sin goles.</div>}
              {allGoals.map((g, i) => {
                const tm = g.team === 'home' ? match.homeTeam : match.awayTeam;
                const scorer = tm.players.find(pl => pl.id === g.playerId);
                const tag = g.team === 'home' ? 'HOM' : 'VIS';
                const tagCol = g.team === 'home' ? 'text-vga-light-red' : 'text-vga-light-cyan';
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="text-vga-yellow font-mono w-7">{g.minute}'</span>
                    <span className="text-vga-light-green">{'⚽'}</span>
                    <span className="text-vga-bright-white truncate flex-1">{shirtName(scorer)}</span>
                    <span className={`${tagCol} text-[7px]`}>({tag})</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border border-vga-blue bg-vga-black">
            <div className="px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest">Tarjetas</div>
            <div className="p-2 text-[8px] max-h-20 overflow-y-auto">
              {allCards.length === 0 && <div className="text-vga-gray italic">Sin tarjetas.</div>}
              {allCards.map((c, i) => {
                const t = c.team === 'home' ? match.homeTeam : match.awayTeam;
                const p = t.players.find(pl => pl.id === c.playerId);
                const tag = c.team === 'home' ? 'HOM' : 'VIS';
                const tagCol = c.team === 'home' ? 'text-vga-light-red' : 'text-vga-light-cyan';
                return (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="text-vga-yellow font-mono w-7">{c.minute}'</span>
                    <span className={`inline-block w-2 h-3 border border-black ${c.color === 'red' ? 'bg-vga-light-red' : 'bg-vga-yellow'}`} />
                    <span className="text-vga-bright-white truncate flex-1">{shirtName(p)}</span>
                    <span className={`${tagCol} text-[7px]`}>({tag})</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 border-t border-vga-blue text-[7px]">
              <div className="p-1.5 border-r border-vga-blue text-center">
                <div className="text-vga-light-red uppercase font-bold mb-1 truncate">{match.homeTeam.name}</div>
                <div className="flex justify-center gap-3">
                  <span className="text-vga-yellow">{homeYellows.length} <span className="inline-block w-1.5 h-2 bg-vga-yellow border border-black align-middle" /></span>
                  <span className="text-vga-light-red">{homeReds.length} <span className="inline-block w-1.5 h-2 bg-vga-light-red border border-black align-middle" /></span>
                </div>
              </div>
              <div className="p-1.5 text-center">
                <div className="text-vga-light-cyan uppercase font-bold mb-1 truncate">{match.awayTeam.name}</div>
                <div className="flex justify-center gap-3">
                  <span className="text-vga-yellow">{awayYellows.length} <span className="inline-block w-1.5 h-2 bg-vga-yellow border border-black align-middle" /></span>
                  <span className="text-vga-light-red">{awayReds.length} <span className="inline-block w-1.5 h-2 bg-vga-light-red border border-black align-middle" /></span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-vga-blue bg-vga-black flex-1">
            <div className="px-3 py-1.5 border-b border-vga-blue text-vga-magenta text-[9px] uppercase tracking-widest">Estadísticas Clave</div>
            <div className="p-3 flex flex-col gap-2">
              <StatBar label="Tiros" h={match.homeShots} a={match.awayShots} />
              <StatBar label="A Puerta" h={match.homeShotsOnTarget} a={match.awayShotsOnTarget} />
              <StatBar label="Posesión" h={homePoss} a={awayPoss} />
              <StatBar label="Faltas" h={match.homeFouls} a={match.awayFouls} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action area */}
      <div className="mt-1">
        {!match.isFinished && (
          <div className="flex gap-2">
            {canSub && !showSubPanel && (
              <button
                onClick={onShowSubs}
                className="bg-vga-yellow text-vga-black py-2 px-4 text-[9px] border-2 border-vga-bright-white hover:bg-vga-bright-white font-bold uppercase tracking-wider"
              >
                Cambios ({userSubsUsed}/3)
              </button>
            )}
            {!isPlaying && !showSubPanel && (
              <button
                onClick={onPlay}
                className="flex-1 bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-2 px-4 border-2 border-vga-bright-white text-[10px] font-bold uppercase tracking-widest"
              >
                {htPaused ? '▶  Reanudar (2T)' : '▶  Reanudar'}
              </button>
            )}
            {isPlaying && (
              <button
                onClick={onPause}
                className="flex-1 bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-2 border-vga-bright-white text-[10px] font-bold uppercase tracking-widest"
              >
                Pausa
              </button>
            )}
          </div>
        )}
        {match.isFinished && (
          <button
            onClick={onContinue}
            className="w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-3 px-4 border-2 border-vga-bright-white text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-3"
          >
            <span>{'▶'}</span>
            <span>Continuar</span>
          </button>
        )}
      </div>
    </div>
  );
}

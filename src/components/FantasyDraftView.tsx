import { useState, useEffect, useRef } from 'react';
import type { Player, Team } from '../types/game.d.ts';
import { TeamCrest } from './TeamCrest';
import { PlayerPhoto } from './PlayerPhoto';
import { groupFor } from '../store/leagueStore';

type DraftPos = 'POR' | 'DEF' | 'MED' | 'DEL';

interface Props {
  year: number;
  teamIds: string[];
  userTeamId: string;
  cap: number | null;
  allTeams: Team[];
  pool: Player[];
  onComplete: (teamPicks: Record<string, Player[]>) => void;
  onBack: () => void;
}

const TOTAL_ROUNDS = 18;
const POS_POOL: DraftPos[] = ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL', 'DEL', 'DEL', 'POR', 'DEL'];
const POS_ORDER: DraftPos[] = ['POR', 'DEF', 'MED', 'DEL'];

const shuffleArr = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const POS_BADGE: Record<DraftPos, string> = {
  POR: 'bg-vga-yellow text-vga-black',
  DEF: 'bg-vga-blue text-vga-bright-white',
  MED: 'bg-vga-green text-vga-black',
  DEL: 'bg-vga-red text-vga-bright-white',
};

const POS_SECTION_COLOR: Record<DraftPos, string> = {
  POR: 'text-vga-yellow',
  DEF: 'text-vga-cyan',
  MED: 'text-vga-light-green',
  DEL: 'text-vga-light-red',
};

const KEY_STATS: Record<DraftPos, (keyof Player['stats'])[]> = {
  POR: ['goalkeeping', 'defending', 'speed'],
  DEF: ['defending', 'physical', 'speed'],
  MED: ['passing', 'dribbling', 'defending'],
  DEL: ['shooting', 'dribbling', 'speed'],
};

const STAT_LABELS: Record<keyof Player['stats'], string> = {
  speed: 'VEL', dribbling: 'DRI', passing: 'PAS',
  shooting: 'TIR', defending: 'DEF', physical: 'FIS', goalkeeping: 'POR',
};

const filterByPos = (pool: Player[], pos: DraftPos): Player[] =>
  pool.filter(p => groupFor(p.position) === pos);

const sortByPosition = (picks: Player[]): Player[] => {
  return [...picks].sort((a, b) => {
    const ai = POS_ORDER.indexOf(groupFor(a.position) as DraftPos);
    const bi = POS_ORDER.indexOf(groupFor(b.position) as DraftPos);
    if (ai !== bi) return ai - bi;
    return b.media - a.media;
  });
};

// ── Hover tooltip ──────────────────────────────────────────────
const PlayerTooltip = ({ player, year, x, y }: { player: Player; year: number; x: number; y: number }) => {
  const pos = groupFor(player.position) as DraftPos;
  const age = year - player.birthYear;
  const allStats: (keyof Player['stats'])[] = ['speed', 'dribbling', 'passing', 'shooting', 'defending', 'physical', 'goalkeeping'];
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x + 16,
    top: y - 8,
    zIndex: 9999,
    pointerEvents: 'none',
  };
  // Clamp to viewport
  if (x + 220 > window.innerWidth) style.left = x - 224;
  if (typeof style.top === 'number' && style.top + 280 > window.innerHeight) style.top = window.innerHeight - 288;

  return (
    <div style={style} className="w-52 bg-vga-black border-2 border-vga-white shadow-[4px_4px_0_rgba(0,0,0,1)]">
      <div className={`px-2 py-1 flex items-center gap-2 border-b border-vga-gray ${POS_BADGE[pos]}`}>
        <span className="text-[8px] font-bold">{pos}</span>
        <span className="text-[8px] font-bold truncate">{player.fullName}</span>
      </div>
      <div className="flex gap-2 p-2">
        <PlayerPhoto playerId={player.id} size="md" className="shrink-0 border border-vga-gray" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-vga-bright-white text-[9px] font-bold leading-tight">{player.fullName}</div>
          <div className="text-vga-gray text-[7px]">{age} años · pico {player.peakAge}a</div>
          <div className="text-vga-yellow text-[11px] font-bold">{player.media}</div>
        </div>
      </div>
      <div className="px-2 pb-2 flex flex-col gap-0.5">
        {allStats.map(stat => {
          const val = player.stats[stat];
          const isKey = KEY_STATS[pos]?.includes(stat);
          return (
            <div key={stat} className="flex items-center gap-1">
              <span className={`text-[6px] w-6 shrink-0 ${isKey ? 'text-vga-yellow font-bold' : 'text-vga-gray'}`}>
                {STAT_LABELS[stat]}
              </span>
              <div className="flex-1 bg-vga-gray h-1.5 relative">
                <div
                  className={`h-full ${isKey ? 'bg-vga-yellow' : 'bg-vga-blue'}`}
                  style={{ width: `${val}%` }}
                />
              </div>
              <span className={`text-[7px] w-4 text-right shrink-0 ${isKey ? 'text-vga-yellow font-bold' : 'text-vga-gray'}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Pool player row ─────────────────────────────────────────────
const PoolRow = ({
  player, year, canPick, isUserTurn, overBudget, onPick, onHover, onLeave,
}: {
  player: Player; year: number; canPick: boolean; isUserTurn: boolean;
  overBudget: boolean; onPick: () => void;
  onHover: (p: Player, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const pos = groupFor(player.position) as DraftPos;
  const age = year - player.birthYear;
  const keyStats = KEY_STATS[pos] ?? [];

  return (
    <button
      disabled={!canPick}
      onClick={() => canPick && onPick()}
      onMouseMove={e => onHover(player, e.clientX, e.clientY)}
      onMouseLeave={onLeave}
      className={`flex items-center gap-2 px-2 py-1.5 border-b border-vga-gray text-left w-full transition-colors ${
        canPick
          ? 'hover:bg-vga-blue cursor-pointer'
          : 'cursor-default opacity-40'
      }`}
    >
      <PlayerPhoto playerId={player.id} size="xs" className="shrink-0 border border-vga-gray" />
      <span className={`text-[7px] font-bold px-1 shrink-0 ${POS_BADGE[pos]}`}>{pos}</span>
      <span className="text-vga-bright-white text-[8px] flex-1 min-w-0">{player.fullName}</span>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {keyStats.map(s => (
          <span key={s} className="text-[7px] text-vga-gray">
            <span className="text-vga-gray opacity-70">{STAT_LABELS[s]}</span>
            <span className="text-vga-bright-white ml-0.5">{player.stats[s]}</span>
          </span>
        ))}
      </div>
      <span className="text-vga-cyan text-[7px] shrink-0 ml-1">{age}a</span>
      <span className={`text-[9px] font-bold shrink-0 w-6 text-right ${overBudget ? 'text-vga-light-red' : 'text-vga-yellow'}`}>
        {player.media}
      </span>
    </button>
  );
};

// ── Squad panel (sorted by position) ───────────────────────────
const SquadPanel = ({
  picks, label, isUser, cap, spent, year, onHover, onLeave,
}: {
  picks: Player[]; label: string; isUser: boolean; cap: number | null;
  spent: number; year: number;
  onHover: (p: Player, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const sorted = sortByPosition(picks);
  const remaining = cap !== null ? cap - spent : null;

  return (
    <div className={`border-2 ${isUser ? 'border-vga-cyan' : 'border-vga-gray'} bg-vga-black`}>
      <div className={`px-2 py-1.5 flex items-center justify-between border-b ${isUser ? 'border-vga-cyan bg-vga-blue' : 'border-vga-gray'}`}>
        <span className={`text-[8px] font-bold ${isUser ? 'text-vga-cyan' : 'text-vga-bright-white'}`}>{label}</span>
        <span className="text-vga-gray text-[7px]">{picks.length}/{TOTAL_ROUNDS}</span>
      </div>
      {cap !== null && isUser && (
        <div className={`px-2 py-0.5 text-[7px] font-bold border-b border-vga-gray ${remaining! < 60 ? 'text-vga-light-red' : remaining! < 150 ? 'text-vga-yellow' : 'text-vga-cyan'}`}>
          CAP {spent}/{cap} · RESTO {remaining}
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="text-vga-gray text-[7px] text-center py-3">—</div>
      ) : (
        <div className="flex flex-col">
          {POS_ORDER.map(pos => {
            const group = sorted.filter(p => groupFor(p.position) === pos);
            if (group.length === 0) return null;
            return (
              <div key={pos}>
                <div className={`px-2 py-0.5 text-[6px] font-bold uppercase border-b border-vga-gray ${POS_SECTION_COLOR[pos]}`}>
                  {pos}
                </div>
                {group.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2 py-1 border-b border-vga-gray last:border-0"
                    onMouseMove={e => onHover(p, e.clientX, e.clientY)}
                    onMouseLeave={onLeave}
                  >
                    <PlayerPhoto playerId={p.id} size="xs" className="shrink-0" />
                    <span className="text-vga-bright-white text-[7px] flex-1 min-w-0 truncate">{p.fullName}</span>
                    <span className="text-vga-yellow text-[7px] shrink-0">{p.media}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Rival panel ─────────────────────────────────────────────────
const RivalPanel = ({
  team, picks, isCurrent, year, onHover, onLeave,
}: {
  team: Team | undefined; picks: Player[]; isCurrent: boolean; year: number;
  onHover: (p: Player, x: number, y: number) => void;
  onLeave: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const sorted = sortByPosition(picks);

  return (
    <div className={`border ${isCurrent ? 'border-vga-yellow' : 'border-vga-gray'} bg-vga-black`}>
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-vga-blue transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <TeamCrest colors={team?.colors} size="xs" title={team?.name} teamId={team?.id} />
        <span className={`text-[8px] flex-1 min-w-0 truncate text-left ${isCurrent ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'}`}>
          {team?.name ?? '—'}
        </span>
        <span className="text-vga-gray text-[7px] shrink-0">{picks.length}/{TOTAL_ROUNDS}</span>
        <span className="text-vga-gray text-[7px] shrink-0">{open ? '▼' : '▶'}</span>
      </button>
      {open && sorted.length > 0 && (
        <div className="border-t border-vga-gray">
          {POS_ORDER.map(pos => {
            const group = sorted.filter(p => groupFor(p.position) === pos);
            if (group.length === 0) return null;
            return (
              <div key={pos}>
                <div className={`px-2 py-0.5 text-[6px] font-bold ${POS_SECTION_COLOR[pos]} border-b border-vga-gray`}>{pos}</div>
                {group.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2 py-0.5 border-b border-vga-gray last:border-0"
                    onMouseMove={e => onHover(p, e.clientX, e.clientY)}
                    onMouseLeave={onLeave}
                  >
                    <PlayerPhoto playerId={p.id} size="xs" className="shrink-0" />
                    <span className="text-[7px] text-vga-bright-white flex-1 min-w-0 truncate">{p.fullName}</span>
                    <span className="text-[7px] text-vga-yellow shrink-0">{p.media}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────
export const FantasyDraftView = ({
  year, teamIds, userTeamId, cap, allTeams, pool: initialPool, onComplete, onBack,
}: Props) => {
  const [pool, setPool] = useState<Player[]>(initialPool);
  const [teamPicks, setTeamPicks] = useState<Record<string, Player[]>>(() =>
    Object.fromEntries(teamIds.map(id => [id, []]))
  );
  const [round, setRound] = useState(0);
  const [roundPos, setRoundPos] = useState<DraftPos>(POS_POOL[0]);
  const [roundOrder] = useState<string[]>(() => shuffleArr(teamIds));
  const [pickIdx, setPickIdx] = useState(0);
  const [posFilter, setPosFilter] = useState<DraftPos | 'ALL'>('ALL');
  const [done, setDone] = useState(false);
  const [tooltip, setTooltip] = useState<{ player: Player; x: number; y: number } | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTeamId = roundOrder[pickIdx];
  const isUserTurn = currentTeamId === userTeamId;

  const teamSpent = (teamId: string) => (teamPicks[teamId] ?? []).reduce((s, p) => s + p.media, 0);
  const teamRemaining = (teamId: string) => cap !== null ? cap - teamSpent(teamId) : Infinity;
  const userRemaining = teamRemaining(userTeamId);

  const getTeam = (id: string) => allTeams.find(t => t.id === id);

  const doPick = (teamId: string, player: Player) => {
    const nextPool = pool.filter(p => p.id !== player.id);
    const nextPicks = { ...teamPicks, [teamId]: [...(teamPicks[teamId] ?? []), player] };
    setPool(nextPool);
    setTeamPicks(nextPicks);
    const nextPickIdx = pickIdx + 1;
    if (nextPickIdx >= roundOrder.length) {
      const nextRound = round + 1;
      if (nextRound >= TOTAL_ROUNDS) { setDone(true); }
      else { setRound(nextRound); setRoundPos(POS_POOL[nextRound]); setPickIdx(0); }
    } else {
      setPickIdx(nextPickIdx);
    }
  };

  const doAiPick = (teamId: string) => {
    const remaining = teamRemaining(teamId);
    const affordable = (p: Player) => p.media <= remaining;
    const candidates = filterByPos(pool, roundPos).filter(affordable);
    const top = candidates.slice(0, 3);
    if (top.length === 0) {
      const fallback = pool.filter(affordable)[0] ?? pool[0];
      if (fallback) doPick(teamId, fallback);
      return;
    }
    doPick(teamId, randomFrom(top));
  };

  useEffect(() => {
    if (done || isUserTurn) return;
    aiTimerRef.current = setTimeout(() => { doAiPick(currentTeamId); }, 600);
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, pickIdx, done]);

  const showTooltip = (player: Player, x: number, y: number) => setTooltip({ player, x, y });
  const hideTooltip = () => setTooltip(null);

  const displayPool = posFilter === 'ALL' ? pool : pool.filter(p => groupFor(p.position) === posFilter);
  const userPicks = teamPicks[userTeamId] ?? [];
  const pickingTeam = getTeam(currentTeamId);

  // ── Done screen ────────────────────────────────────────────────
  if (done) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-vga-yellow text-center text-sm underline decoration-double mb-6">SORTEO TERMINADO</h2>
          <div className="flex flex-col gap-3 mb-4">
            {teamIds.map(id => {
              const t = getTeam(id);
              const picks = sortByPosition(teamPicks[id] ?? []);
              return (
                <div key={id} className="bg-vga-black border border-vga-gray p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TeamCrest colors={t?.colors} size="sm" title={t?.name} teamId={id} />
                    <span className={`text-[9px] font-bold ${id === userTeamId ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                      {t?.name ?? id}{id === userTeamId ? ' (TÚ)' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {picks.map(p => (
                      <span key={p.id} className={`text-[7px] px-1 py-0.5 border border-vga-gray ${POS_BADGE[groupFor(p.position) as DraftPos]}`}>
                        {p.fullName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          onClick={() => onComplete(teamPicks)}
          className="w-full bg-vga-green text-vga-bright-white border-b-4 border-r-4 border-vga-black p-3 text-[10px] font-bold uppercase tracking-wider hover:bg-vga-light-green"
        >
          COMENZAR LIGA
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl flex flex-col gap-3 animate-in fade-in duration-500">
      {tooltip && <PlayerTooltip player={tooltip.player} year={year} x={tooltip.x} y={tooltip.y} />}

      {/* Header */}
      <div className="bg-vga-blue p-2 border-4 border-vga-white shadow-[4px_4px_0_rgba(0,0,0,1)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-vga-yellow text-[9px] font-bold">RONDA {round + 1}/{TOTAL_ROUNDS}</span>
          <span className={`text-[8px] font-bold px-2 py-0.5 ${POS_BADGE[roundPos]}`}>{roundPos}</span>
        </div>
        <div className="flex items-center gap-2">
          {pickingTeam && <TeamCrest colors={pickingTeam.colors} size="sm" title={pickingTeam.name} teamId={pickingTeam.id} />}
          <span className={`text-[9px] font-bold ${isUserTurn ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
            {isUserTurn ? 'TU TURNO' : (pickingTeam?.name ?? currentTeamId)}
          </span>
        </div>
        <button onClick={onBack} className="text-[7px] text-vga-gray border border-vga-gray px-2 py-1 hover:text-vga-bright-white hover:border-vga-white">
          SALIR
        </button>
      </div>

      {isUserTurn && (
        <div className="bg-vga-black border-2 border-vga-yellow px-3 py-2 text-[8px] text-vga-yellow font-bold text-center">
          ES TU TURNO — POSICIÓN RECOMENDADA: <span className={`px-2 py-0.5 ml-1 ${POS_BADGE[roundPos]}`}>{roundPos}</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Pool */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-vga-blue px-3 py-2 border-2 border-vga-white mb-0 flex items-center justify-between">
            <span className="text-vga-yellow text-[8px] font-bold">POOL DE JUGADORES</span>
            <div className="flex gap-1">
              {(['ALL', 'POR', 'DEF', 'MED', 'DEL'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`text-[7px] px-2 py-0.5 border font-bold ${posFilter === pos ? 'bg-vga-yellow text-vga-black border-vga-yellow' : 'bg-vga-black text-vga-gray border-vga-gray hover:border-vga-white hover:text-vga-bright-white'}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-vga-black border-2 border-t-0 border-vga-white overflow-y-auto" style={{ maxHeight: '520px' }}>
            {displayPool.length === 0 ? (
              <div className="text-vga-gray text-[8px] text-center py-8">SIN JUGADORES DISPONIBLES</div>
            ) : (
              displayPool.slice(0, 60).map(p => {
                const overBudget = isUserTurn && cap !== null && p.media > userRemaining;
                const canPick = isUserTurn && !overBudget;
                return (
                  <PoolRow
                    key={p.id}
                    player={p}
                    year={year}
                    canPick={canPick}
                    isUserTurn={isUserTurn}
                    overBudget={overBudget}
                    onPick={() => doPick(userTeamId, p)}
                    onHover={showTooltip}
                    onLeave={hideTooltip}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <SquadPanel
            picks={userPicks}
            label="MI PLANTILLA"
            isUser
            cap={cap}
            spent={teamSpent(userTeamId)}
            year={year}
            onHover={showTooltip}
            onLeave={hideTooltip}
          />

          <div className="bg-vga-blue px-2 py-1.5 border-2 border-vga-white">
            <div className="text-vga-yellow text-[8px] font-bold mb-1">RIVALES</div>
            <div className="flex flex-col gap-1">
              {teamIds.filter(id => id !== userTeamId).map(id => (
                <RivalPanel
                  key={id}
                  team={getTeam(id)}
                  picks={teamPicks[id] ?? []}
                  isCurrent={id === currentTeamId}
                  year={year}
                  onHover={showTooltip}
                  onLeave={hideTooltip}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

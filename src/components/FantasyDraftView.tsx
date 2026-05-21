import { useState, useEffect, useRef } from 'react';
import type { Player, Team } from '../types/game.d.ts';
import { TeamCrest } from './TeamCrest';
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

const shuffleArr = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const POS_BADGE_COLORS: Record<DraftPos, string> = {
  POR: 'bg-vga-yellow text-vga-black',
  DEF: 'bg-vga-blue text-vga-bright-white',
  MED: 'bg-vga-green text-vga-black',
  DEL: 'bg-vga-red text-vga-bright-white',
};

const filterByPos = (pool: Player[], pos: DraftPos): Player[] =>
  pool.filter(p => groupFor(p.position) === pos);


export const FantasyDraftView = ({
  year,
  teamIds,
  userTeamId,
  cap,
  allTeams,
  pool: initialPool,
  onComplete,
  onBack,
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
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTeamId = roundOrder[pickIdx];
  const isUserTurn = currentTeamId === userTeamId;

  const teamSpent = (teamId: string) =>
    (teamPicks[teamId] ?? []).reduce((s, p) => s + p.media, 0);
  const teamRemaining = (teamId: string) =>
    cap !== null ? cap - teamSpent(teamId) : Infinity;
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
      if (nextRound >= TOTAL_ROUNDS) {
        setDone(true);
      } else {
        setRound(nextRound);
        setRoundPos(POS_POOL[nextRound]);
        setPickIdx(0);
      }
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
    if (done) return;
    if (isUserTurn) return;
    aiTimerRef.current = setTimeout(() => {
      doAiPick(currentTeamId);
    }, 600);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, pickIdx, done]);

  const displayPool = posFilter === 'ALL' ? pool : pool.filter(p => groupFor(p.position) === posFilter);

  if (done) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-vga-yellow text-center text-sm underline decoration-double mb-6">
            SORTEO TERMINADO
          </h2>
          <div className="flex flex-col gap-3 mb-4">
            {teamIds.map(id => {
              const t = getTeam(id);
              const picks = teamPicks[id] ?? [];
              return (
                <div key={id} className="bg-vga-black border border-vga-gray p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TeamCrest colors={t?.colors} size="sm" title={t?.name} />
                    <span className={`text-[9px] font-bold ${id === userTeamId ? 'text-vga-yellow' : 'text-vga-bright-white'}`}>
                      {t?.name ?? id}{id === userTeamId ? ' (TÚ)' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {picks.map(p => (
                      <span key={p.id} className="text-[7px] bg-vga-blue text-vga-bright-white px-1 py-0.5 border border-vga-gray">
                        {p.name}
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
          className="w-full bg-vga-green text-vga-bright-white border-2 border-vga-light-green p-3 text-[10px] font-bold hover:bg-vga-light-green"
        >
          COMENZAR LIGA
        </button>
      </div>
    );
  }

  const pickingTeam = getTeam(currentTeamId);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="bg-vga-blue p-3 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-vga-yellow text-[9px] font-bold">RONDA {round + 1}/{TOTAL_ROUNDS}</span>
          <span className={`text-[8px] font-bold px-2 py-0.5 ${POS_BADGE_COLORS[roundPos]}`}>{roundPos}</span>
        </div>
        <div className="flex items-center gap-2">
          {pickingTeam && <TeamCrest colors={pickingTeam.colors} size="sm" title={pickingTeam.name} />}
          <span className={`text-[8px] ${isUserTurn ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'}`}>
            {isUserTurn ? 'TU TURNO' : (pickingTeam?.name ?? currentTeamId)}
          </span>
        </div>
        <button onClick={onBack} className="text-[7px] text-vga-gray border border-vga-gray px-2 py-1 hover:text-vga-bright-white hover:border-vga-white">
          SALIR
        </button>
      </div>

      {isUserTurn && (
        <div className="bg-vga-black border-2 border-vga-yellow px-3 py-2 text-[8px] text-vga-yellow font-bold text-center">
          ES TU TURNO — POSICIÓN RECOMENDADA: <span className={`px-2 py-0.5 ml-1 ${POS_BADGE_COLORS[roundPos]}`}>{roundPos}</span>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-vga-blue p-2 border-2 border-vga-white mb-2">
            <div className="text-vga-yellow text-[8px] font-bold mb-2">POOL DE JUGADORES</div>
            <div className="flex gap-1 mb-2 flex-wrap">
              {(['ALL', 'POR', 'DEF', 'MED', 'DEL'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`text-[7px] px-2 py-0.5 border ${posFilter === pos ? 'bg-vga-yellow text-vga-black border-vga-yellow' : 'bg-vga-black text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-white'}`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto max-h-96 flex flex-col gap-1">
              {displayPool.slice(0, 40).map(p => {
                const pg = groupFor(p.position);
                const overBudget = isUserTurn && cap !== null && p.media > userRemaining;
                const canPick = isUserTurn && !overBudget;
                return (
                  <button
                    key={p.id}
                    disabled={!canPick}
                    onClick={() => canPick && doPick(userTeamId, p)}
                    className={`flex items-center gap-2 px-2 py-1.5 border text-left w-full transition-colors ${canPick ? 'bg-vga-black border-vga-gray hover:border-vga-light-green hover:bg-vga-blue cursor-pointer' : 'bg-vga-black border-vga-gray cursor-default opacity-40'}`}
                  >
                    <span className={`text-[7px] font-bold px-1 shrink-0 ${POS_BADGE_COLORS[pg as DraftPos] ?? 'bg-vga-gray text-vga-black'}`}>{pg}</span>
                    <span className="text-vga-bright-white text-[8px] flex-1 min-w-0 truncate">{p.name}</span>
                    <span className="text-vga-cyan text-[7px] shrink-0">{year - p.birthYear}a</span>
                    <span className={`text-[8px] font-bold shrink-0 ${overBudget ? 'text-vga-red' : 'text-vga-yellow'}`}>{p.media}</span>
                  </button>
                );
              })}
              {displayPool.length === 0 && (
                <div className="text-vga-gray text-[8px] text-center py-4">SIN JUGADORES DISPONIBLES</div>
              )}
            </div>
          </div>
        </div>

        <div className="w-64 shrink-0 flex flex-col gap-2">
          <div className="bg-vga-blue p-2 border-2 border-vga-cyan">
            <div className="text-vga-cyan text-[8px] font-bold mb-1">
              MI PLANTILLA <span className="text-vga-gray font-normal">({(teamPicks[userTeamId] ?? []).length}/{TOTAL_ROUNDS})</span>
            </div>
            {cap !== null && (
              <div className={`text-[7px] mb-2 font-bold ${userRemaining < 60 ? 'text-vga-red' : userRemaining < 150 ? 'text-vga-yellow' : 'text-vga-cyan'}`}>
                CAP: {teamSpent(userTeamId)}/{cap} — RESTO: {userRemaining}
              </div>
            )}
            <div className="flex flex-col gap-1 overflow-y-auto max-h-64">
              {(teamPicks[userTeamId] ?? []).length === 0 ? (
                <div className="text-vga-gray text-[7px] text-center py-2">SIN FICHAJES AÚN</div>
              ) : (
                (teamPicks[userTeamId] ?? []).map(p => {
                  const pg = groupFor(p.position) as DraftPos;
                  return (
                    <div key={p.id} className="flex items-center gap-1 bg-vga-black px-1 py-0.5">
                      <span className={`text-[6px] font-bold px-1 shrink-0 ${POS_BADGE_COLORS[pg] ?? 'bg-vga-gray text-vga-black'}`}>{pg}</span>
                      <span className="text-vga-bright-white text-[7px] flex-1 min-w-0 truncate">{p.name}</span>
                      <span className="text-vga-yellow text-[7px] shrink-0">{p.media}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-vga-blue p-2 border-2 border-vga-white">
            <div className="text-vga-yellow text-[8px] font-bold mb-2">RIVALES</div>
            <div className="flex flex-col gap-1 overflow-y-auto max-h-48">
              {teamIds.filter(id => id !== userTeamId).map(id => {
                const t = getTeam(id);
                const picks = teamPicks[id] ?? [];
                const isCurrent = id === currentTeamId;
                return (
                  <div
                    key={id}
                    className={`bg-vga-black border px-2 py-1 flex items-center gap-1 ${isCurrent ? 'border-vga-yellow' : 'border-vga-gray'}`}
                  >
                    <TeamCrest colors={t?.colors} size="sm" title={t?.name} />
                    <span className="text-vga-bright-white text-[7px] flex-1 min-w-0 truncate">{t?.name ?? id}</span>
                    <span className="text-vga-gray text-[7px] shrink-0">{picks.length}/{TOTAL_ROUNDS}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

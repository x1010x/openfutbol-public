import type { TournamentState, TournamentStage, TournamentTie, GroupMatch } from '../store/tournamentStore';
import { groupStandings } from '../store/tournamentStore';
import { TeamCrest } from './TeamCrest';

interface Props {
  state: TournamentState;
  // Index into state.stages of the stage that just finished.
  justPlayedStageIdx: number;
  onClose: () => void;
}

export const TournamentRoundResultsModal = ({ state, justPlayedStageIdx, onClose }: Props) => {
  const stage = state.stages[justPlayedStageIdx];
  if (!stage) return null;
  const teamById = (id: string | null) => id ? state.teams.find(t => t.id === id) : null;

  // User outcome detection
  const userIn = state.userTeamId && stage.inputTeamIds?.includes(state.userTeamId);
  const userOut = state.userTeamId && userIn && !stage.survivorIds?.includes(state.userTeamId);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[92vh] flex flex-col">
        <div className="bg-vga-blue/40 border-b-2 border-vga-blue px-3 py-2 text-center">
          <div className="text-vga-yellow text-[9px] uppercase tracking-widest font-bold">
            Resultados — {stage.name}
          </div>
          {userIn && (
            <div className={`text-[8px] uppercase mt-1 ${userOut ? 'text-vga-light-red' : 'text-vga-light-green'}`}>
              {userOut ? 'Tu equipo queda eliminado' : '¡Tu equipo pasa de fase!'}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {stage.config.kind === 'liga'
            ? <LigaRecap stage={stage} teamById={teamById} userTeamId={state.userTeamId} />
            : <KoRecap stage={stage} teamById={teamById} userTeamId={state.userTeamId} />}
        </div>

        <div className="border-t-2 border-vga-blue p-2 bg-vga-blue/30">
          <button onClick={onClose} className="w-full bg-vga-yellow text-vga-black text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white">
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

const LigaRecap = ({ stage, teamById, userTeamId }: {
  stage: TournamentStage;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string | null;
}) => {
  if (!stage.groups) return null;
  const adv = stage.config.kind === 'liga' ? stage.config.advancePerGroup : 0;
  return (
    <div className="flex flex-col gap-3">
      {stage.groups.map(group => {
        const standings = groupStandings(group);
        return (
          <div key={group.id} className="border-2 border-vga-blue">
            <div className="bg-vga-blue/40 px-2 py-1 text-vga-yellow text-[10px] uppercase font-bold">Grupo {group.letter}</div>
            <table className="w-full text-[8px] font-mono">
              <thead className="text-vga-cyan bg-vga-blue/20">
                <tr><th className="text-left px-1 py-1">#</th><th className="text-left px-1 py-1">EQUIPO</th><th className="text-right px-1 py-1">PJ</th><th className="text-right px-1 py-1">G</th><th className="text-right px-1 py-1">DG</th><th className="text-right px-1 py-1">PTS</th></tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const t = teamById(s.teamId);
                  const passes = i < adv;
                  return (
                    <tr key={s.teamId} className={`${userTeamId === s.teamId ? 'bg-vga-yellow/20' : ''} border-b border-vga-blue/30`}>
                      <td className={`px-1 py-0.5 ${passes ? 'text-vga-light-green font-bold' : 'text-vga-gray'}`}>{i + 1}</td>
                      <td className="px-1 py-0.5 flex items-center gap-1 truncate text-vga-bright-white">
                        {t && <TeamCrest colors={t.colors} size="sm" teamId={t.id} title={t.name} />}
                        <span className="truncate">{t?.name ?? '—'}</span>
                      </td>
                      <td className="text-right px-1 py-0.5">{s.played}</td>
                      <td className="text-right px-1 py-0.5">{s.gf}</td>
                      <td className="text-right px-1 py-0.5">{s.gd}</td>
                      <td className="text-right px-1 py-0.5 text-vga-yellow font-bold">{s.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <details className="border-t border-vga-blue">
              <summary className="px-2 py-1 text-vga-cyan text-[7px] uppercase cursor-pointer">Resultados ({group.matches.filter(m => m.played).length} partidos)</summary>
              <div className="px-2 pb-2 flex flex-col gap-0.5">
                {group.matches.filter(m => m.played).map(m => <GroupMatchRow key={`${m.homeTeamId}-${m.awayTeamId}-${m.jornada}`} m={m} teamById={teamById} />)}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
};

const GroupMatchRow = ({ m, teamById }: { m: GroupMatch; teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined }) => {
  const h = teamById(m.homeTeamId); const a = teamById(m.awayTeamId);
  return (
    <div className="grid grid-cols-[1fr_auto_24px_auto_1fr] items-center gap-1 text-[8px] py-0.5">
      <span className="text-vga-bright-white uppercase truncate text-right">{h?.name ?? '—'}</span>
      <span className="text-vga-light-green font-mono font-bold">{m.homeScore}</span>
      <span className="text-vga-gray text-center">·</span>
      <span className="text-vga-light-green font-mono font-bold">{m.awayScore}</span>
      <span className="text-vga-bright-white uppercase truncate">{a?.name ?? '—'}</span>
    </div>
  );
};

const KoRecap = ({ stage, teamById, userTeamId }: {
  stage: TournamentStage;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string | null;
}) => (
  <div className="flex flex-col gap-1">
    {(stage.ties ?? []).slice().sort((a, b) => a.slot - b.slot).map(tie =>
      <TieRow key={tie.id} tie={tie} teamById={teamById} userTeamId={userTeamId} />
    )}
  </div>
);

const TieRow = ({ tie, teamById, userTeamId }: { tie: TournamentTie; teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined; userTeamId: string | null }) => {
  const h = teamById(tie.homeTeamId); const a = teamById(tie.awayTeamId);
  const userIn = userTeamId && (tie.homeTeamId === userTeamId || tie.awayTeamId === userTeamId);
  const winnerIsHome = tie.winnerTeamId === tie.homeTeamId;
  const winnerIsAway = tie.winnerTeamId === tie.awayTeamId;
  return (
    <div className={`grid grid-cols-[1fr_auto_24px_auto_1fr] items-center gap-2 px-2 py-1 border-2 ${userIn ? 'border-vga-yellow' : 'border-vga-blue'} bg-vga-black text-[9px]`}>
      <div className="flex items-center gap-1 justify-end min-w-0">
        {h && <TeamCrest colors={h.colors} size="sm" teamId={h.id} title={h.name} />}
        <span className={`uppercase truncate ${winnerIsHome ? 'text-vga-yellow font-bold' : 'text-vga-bright-white opacity-60'}`}>{h?.name ?? '—'}</span>
      </div>
      <span className={`text-[12px] font-mono font-bold ${winnerIsHome ? 'text-vga-light-green' : 'text-vga-gray'}`}>{tie.aggHome}</span>
      <span className="text-vga-gray text-center">·</span>
      <span className={`text-[12px] font-mono font-bold ${winnerIsAway ? 'text-vga-light-green' : 'text-vga-gray'}`}>{tie.aggAway}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`uppercase truncate ${winnerIsAway ? 'text-vga-yellow font-bold' : 'text-vga-bright-white opacity-60'}`}>{a?.name ?? '—'}</span>
        {a && <TeamCrest colors={a.colors} size="sm" teamId={a.id} title={a.name} />}
      </div>
    </div>
  );
};

import type { TournamentState, TournamentStage, TournamentTie, KoStageConfig, LigaStageConfig } from '../store/tournamentStore';
import { groupStandings, userNextAction, spectatorNextMatch } from '../store/tournamentStore';
import { TeamCrest } from './TeamCrest';

interface Props {
  state: TournamentState;
  onAdvanceStage: () => void;
  onPlayUserMatch?: () => void;
  onPlaySpectatorMatch?: () => void;
  onOpenAlignment: () => void;
  onOpenSquad: () => void;
  onOpenStats: () => void;
  onExit: () => void;
}

export const BracketView = ({ state, onAdvanceStage, onPlayUserMatch, onPlaySpectatorMatch, onOpenAlignment, onOpenSquad, onOpenStats, onExit }: Props) => {
  const teamById = (id: string | null) => id ? state.teams.find(t => t.id === id) : null;
  const champion = state.champion ? teamById(state.champion) : null;
  const userTeam = state.userTeamId ? teamById(state.userTeamId) : null;
  const userIsChampion = state.champion === state.userTeamId;
  const stage = state.stages[state.currentStageIdx];

  // User eliminated? Only true if userTeamId set and not in current stage inputs.
  const userOut = userTeam && stage.inputTeamIds && !stage.inputTeamIds.includes(state.userTeamId!);

  const nextAction = userNextAction(state);
  const spectatorAction = nextAction ? null : spectatorNextMatch(state);
  const watchedAction = nextAction ?? spectatorAction;
  const watchedLabel = watchedAction
    ? (() => {
        const h = teamById(watchedAction.homeTeamId)?.name ?? '?';
        const a = teamById(watchedAction.awayTeamId)?.name ?? '?';
        if (watchedAction.type === 'liga') return `Jornada ${watchedAction.jornada} · ${h} vs ${a}`;
        const legLabel = watchedAction.legIdx === 0 ? 'Ida' : watchedAction.legIdx === 1 ? 'Vuelta' : `Partido ${watchedAction.legIdx + 1}`;
        return `${legLabel} · ${h} vs ${a}`;
      })()
    : null;

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">{state.name}</h2>
          <span className="text-vga-bright-white text-[9px] uppercase">{state.teams.length} equipos</span>
          {userTeam ? (
            <span className="text-vga-cyan text-[9px] uppercase flex items-center gap-1">
              · <TeamCrest colors={userTeam.colors} size="sm" teamId={userTeam.id} title={userTeam.name} /> {userTeam.name}
            </span>
          ) : (
            <span className="text-vga-gray text-[9px] uppercase">· modo espectador</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {userTeam && (
            <>
              <button onClick={onOpenAlignment} className="bg-vga-green text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-green">
                Alineación
              </button>
              <button onClick={onOpenSquad} className="bg-vga-magenta text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-magenta">
                Equipo
              </button>
            </>
          )}
          <button onClick={onOpenStats} className="bg-vga-cyan text-vga-black px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-cyan">
            Stats
          </button>
          <button onClick={onExit} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
            Salir
          </button>
        </div>
      </div>

      {/* Stage banner */}
      <div className="bg-vga-blue/40 border-2 border-vga-blue px-3 py-1 flex items-center justify-between">
        <span className="text-vga-yellow text-[10px] uppercase tracking-widest font-bold">
          Fase {state.currentStageIdx + 1}/{state.stages.length} · {stage.name}
        </span>
        <span className="text-vga-cyan text-[8px] uppercase">
          {stage.inputCount} → {stage.outputCount}
          {stage.config.kind === 'ko' && (stage.config as KoStageConfig).legs > 1
            ? ` · ${(stage.config as KoStageConfig).legs} partidos${(stage.config as KoStageConfig).awayGoalsRule ? ' · gol visitante' : ''}`
            : null}
        </span>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="border-4 border-vga-yellow bg-vga-black p-3 flex items-center gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <TeamCrest colors={champion.colors} size="lg" teamId={champion.id} title={champion.name} />
          <div className="flex-1">
            <div className="text-vga-yellow text-[8px] uppercase tracking-widest">Campeón del torneo</div>
            <div className="text-vga-bright-white text-[18px] font-bold uppercase">{champion.name}</div>
            <div className="text-vga-light-green text-[9px] mt-1">
              {userIsChampion ? '¡Has ganado!' : 'La IA se ha llevado el trofeo.'}
            </div>
          </div>
        </div>
      )}

      {/* User out banner */}
      {!champion && userOut && (
        <div className="border-2 border-vga-light-red bg-vga-black p-2 text-vga-light-red text-[9px] uppercase">
          Tu equipo está eliminado. Puedes seguir el torneo hasta el final.
        </div>
      )}

      {/* Stage body */}
      {stage.config.kind === 'liga'
        ? <LigaStageBody stage={stage} teamById={teamById} userTeamId={state.userTeamId} />
        : <KoStageBody stage={stage} teamById={teamById} userTeamId={state.userTeamId} />
      }

      {/* Footer */}
      {!champion && (
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="text-vga-cyan text-[9px] uppercase">
            {watchedLabel ? `Próximo: ${watchedLabel}` : ''}
          </div>
          <div className="flex gap-2">
            {nextAction && onPlayUserMatch && (
              <button
                onClick={onPlayUserMatch}
                className="bg-vga-yellow text-vga-black text-[11px] uppercase font-bold border-2 border-vga-bright-white px-4 py-2 hover:bg-vga-bright-white tracking-wider"
              >
                Jugar tu partido
              </button>
            )}
            {!nextAction && spectatorAction && onPlaySpectatorMatch && (
              <button
                onClick={onPlaySpectatorMatch}
                className="bg-vga-cyan text-vga-black text-[11px] uppercase font-bold border-2 border-vga-bright-white px-4 py-2 hover:bg-vga-light-cyan tracking-wider"
              >
                Ver siguiente partido
              </button>
            )}
            <button
              onClick={onAdvanceStage}
              className="bg-vga-light-green text-vga-black text-[11px] uppercase font-bold border-2 border-vga-bright-white px-4 py-2 hover:bg-vga-bright-white tracking-wider"
            >
              {watchedAction ? 'Auto-sim fase' : 'Jugar fase'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LigaStageBody = ({ stage, teamById, userTeamId }: {
  stage: TournamentStage;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string | null;
}) => {
  const adv = (stage.config as LigaStageConfig).advancePerGroup;
  return (
    <div className="bg-vga-black border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4">
      <div className="text-vga-gray text-[8px] uppercase tracking-widest text-center">
        Pasan {adv} por grupo
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {(stage.groups ?? []).map(group => {
          const standings = groupStandings(group);
          return (
            <div key={group.id} className="border-4 border-vga-white bg-vga-gray p-2 vga-panel">
              <h3 className="text-vga-yellow text-center mb-2 text-[10px] uppercase tracking-widest font-bold">Grupo {group.letter}</h3>
              <table className="w-full text-[8px] text-left border-collapse">
                <thead>
                  <tr className="bg-vga-blue text-vga-bright-white uppercase text-[7px]">
                    <th className="p-1 border border-vga-white text-center">#</th>
                    <th className="p-1 border border-vga-white text-left">Equipo</th>
                    <th className="p-1 border border-vga-white text-center">PJ</th>
                    <th className="p-1 border border-vga-white text-center">V</th>
                    <th className="p-1 border border-vga-white text-center">E</th>
                    <th className="p-1 border border-vga-white text-center">D</th>
                    <th className="p-1 border border-vga-white text-center">GF</th>
                    <th className="p-1 border border-vga-white text-center">GC</th>
                    <th className="p-1 border border-vga-white text-center">DG</th>
                    <th className="p-1 border border-vga-white text-center">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const tm = teamById(s.teamId);
                    const isUser = s.teamId === userTeamId;
                    const isAdv = i < adv;
                    const baseBg = i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray';
                    const rowClass = isUser ? 'bg-vga-blue' : baseBg;
                    return (
                      <tr key={s.teamId} className={rowClass}>
                        <td className={`p-1 border border-vga-white text-center font-bold ${isAdv ? 'text-vga-light-green' : 'text-vga-yellow'}`}>{i + 1}</td>
                        <td className={`p-1 border border-vga-white truncate max-w-[180px] ${isUser ? 'text-vga-yellow font-bold' : ''}`}>
                          <div className="flex items-center gap-1.5">
                            {tm && <TeamCrest colors={tm.colors} size="xs" teamId={tm.id} />}
                            <span className="truncate">{tm?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="p-1 border border-vga-white text-center">{s.played}</td>
                        <td className="p-1 border border-vga-white text-center text-vga-light-green">{s.won}</td>
                        <td className="p-1 border border-vga-white text-center text-vga-white">{s.drawn}</td>
                        <td className="p-1 border border-vga-white text-center text-vga-light-red">{s.lost}</td>
                        <td className="p-1 border border-vga-white text-center">{s.gf}</td>
                        <td className="p-1 border border-vga-white text-center">{s.ga}</td>
                        <td className="p-1 border border-vga-white text-center">{s.gd}</td>
                        <td className="p-1 border border-vga-white text-center text-vga-yellow font-bold">{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KoStageBody = ({ stage, teamById, userTeamId }: {
  stage: TournamentStage;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string | null;
}) => {
  const cfg = stage.config as KoStageConfig;
  const ties = (stage.ties ?? []).slice().sort((a, b) => a.slot - b.slot);
  return (
    <div className="bg-vga-black border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
        {ties.map(tie => (
          <TieCard key={tie.id} tie={tie} legs={cfg.legs} teamById={teamById} userTeamId={userTeamId} />
        ))}
      </div>
    </div>
  );
};

const TieCard = ({ tie, legs, teamById, userTeamId }: {
  tie: TournamentTie;
  legs: number;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string | null;
}) => {
  const home = teamById(tie.homeTeamId);
  const away = teamById(tie.awayTeamId);
  const userInTie = userTeamId && (tie.homeTeamId === userTeamId || tie.awayTeamId === userTeamId);
  const winnerIsHome = tie.winnerTeamId === tie.homeTeamId;
  const winnerIsAway = tie.winnerTeamId === tie.awayTeamId;
  return (
    <div className={`border-2 ${userInTie ? 'border-vga-yellow' : tie.played ? 'border-vga-blue' : 'border-vga-gray'} bg-vga-black`}>
      <Row team={home} aggScore={tie.played ? tie.aggHome : null} winner={winnerIsHome} loser={tie.played && !winnerIsHome} />
      <Row team={away} aggScore={tie.played ? tie.aggAway : null} winner={winnerIsAway} loser={tie.played && !winnerIsAway} />
      {legs > 1 && tie.legs.some(l => l.played) && (
        <div className="px-2 py-1 text-[7px] text-vga-gray uppercase border-t border-vga-blue flex justify-between flex-wrap gap-x-2">
          {tie.legs.map((l, i) => l.played ? (
            <span key={i}>P{i + 1}: {l.homeScore}-{l.awayScore}</span>
          ) : null)}
        </div>
      )}
    </div>
  );
};

const Row = ({ team, aggScore, winner, loser }: {
  team: { id: string; name: string; colors?: string[] } | null | undefined;
  aggScore: number | null;
  winner: boolean;
  loser: boolean;
}) => (
  <div className={`grid grid-cols-[24px_1fr_auto] items-center gap-1 px-2 py-1 border-b border-vga-blue last:border-b-0 ${loser ? 'opacity-50' : ''}`}>
    {team ? <TeamCrest colors={team.colors} size="sm" teamId={team.id} title={team.name} /> : <div className="w-[18px] h-[18px] border border-vga-gray" />}
    <span className={`text-[9px] uppercase truncate ${winner ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'}`}>
      {team?.name ?? '—'}
    </span>
    <span className={`text-[11px] font-mono font-bold ${winner ? 'text-vga-light-green' : 'text-vga-gray'}`}>
      {aggScore ?? '·'}
    </span>
  </div>
);

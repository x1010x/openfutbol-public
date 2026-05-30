import type { TournamentState } from '../store/tournamentStore';
import { roundLabel } from '../store/tournamentStore';
import { TeamCrest } from './TeamCrest';

interface Props {
  state: TournamentState;
  onAdvanceRound: () => void;
  onExit: () => void;
}

export const BracketView = ({ state, onAdvanceRound, onExit }: Props) => {
  const teamById = (id: string | null) => id ? state.teams.find(t => t.id === id) : null;
  const rounds: number[] = [];
  for (let r = 0; r < state.totalRounds; r++) rounds.push(r);

  const champion = state.champion ? teamById(state.champion) : null;
  const userTeam = teamById(state.userTeamId);
  const userIsChampion = state.champion === state.userTeamId;

  // User still alive? (No tie this round where user lost.)
  const userOut = state.ties.some(t => t.played && t.winnerTeamId && t.winnerTeamId !== state.userTeamId
    && (t.homeTeamId === state.userTeamId || t.awayTeamId === state.userTeamId));

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-3">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">{state.name}</h2>
          <span className="text-vga-bright-white text-[9px] uppercase">{state.teams.length} equipos</span>
          {userTeam && (
            <span className="text-vga-cyan text-[9px] uppercase flex items-center gap-1">
              · Tu equipo: <TeamCrest colors={userTeam.colors} size="sm" teamId={userTeam.id} title={userTeam.name} /> {userTeam.name}
            </span>
          )}
        </div>
        <button onClick={onExit} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          Salir
        </button>
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

      {/* Bracket */}
      <div className="bg-vga-black border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto">
        <div className="flex gap-3 min-w-fit">
          {rounds.map(r => {
            const ties = state.ties.filter(t => t.round === r).sort((a, b) => a.slot - b.slot);
            const isCurrent = r === state.currentRound;
            return (
              <div key={r} className="flex flex-col gap-2 min-w-[180px]">
                <div className={`text-center text-[9px] uppercase tracking-widest py-1 border-2 ${isCurrent ? 'border-vga-yellow text-vga-yellow' : 'border-vga-blue text-vga-cyan'}`}>
                  {roundLabel(state.totalRounds, r)}
                </div>
                <div className="flex flex-col gap-2">
                  {ties.map(tie => {
                    const home = teamById(tie.homeTeamId);
                    const away = teamById(tie.awayTeamId);
                    const userInTie = tie.homeTeamId === state.userTeamId || tie.awayTeamId === state.userTeamId;
                    const winnerIsHome = tie.winnerTeamId && tie.winnerTeamId === tie.homeTeamId;
                    const winnerIsAway = tie.winnerTeamId && tie.winnerTeamId === tie.awayTeamId;
                    return (
                      <div
                        key={tie.id}
                        className={`border-2 ${userInTie ? 'border-vga-yellow' : tie.played ? 'border-vga-blue' : 'border-vga-gray'} bg-vga-black`}
                      >
                        <Row
                          team={home}
                          score={tie.homeScore}
                          loser={tie.played && !winnerIsHome}
                          winner={!!winnerIsHome}
                        />
                        <Row
                          team={away}
                          score={tie.awayScore}
                          loser={tie.played && !winnerIsAway}
                          winner={!!winnerIsAway}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {!champion && (
        <div className="flex justify-end">
          <button
            onClick={onAdvanceRound}
            className="bg-vga-light-green text-vga-black text-[11px] uppercase font-bold border-2 border-vga-bright-white px-4 py-2 hover:bg-vga-bright-white tracking-wider"
          >
            Jugar {roundLabel(state.totalRounds, state.currentRound)}
          </button>
        </div>
      )}
    </div>
  );
};

const Row = ({ team, score, winner, loser }: {
  team: { id: string; name: string; colors?: string[] } | null | undefined;
  score: number | null;
  winner: boolean;
  loser: boolean;
}) => (
  <div className={`grid grid-cols-[24px_1fr_auto] items-center gap-1 px-2 py-1 border-b border-vga-blue last:border-b-0 ${loser ? 'opacity-50' : ''}`}>
    {team
      ? <TeamCrest colors={team.colors} size="sm" teamId={team.id} title={team.name} />
      : <div className="w-[18px] h-[18px] border border-vga-gray" />}
    <span className={`text-[9px] uppercase truncate ${winner ? 'text-vga-yellow font-bold' : 'text-vga-bright-white'}`}>
      {team?.name ?? '—'}
    </span>
    <span className={`text-[11px] font-mono font-bold ${winner ? 'text-vga-light-green' : 'text-vga-gray'}`}>
      {score ?? '·'}
    </span>
  </div>
);

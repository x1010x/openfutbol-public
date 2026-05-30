import type { TournamentState, TournamentTie } from '../store/tournamentStore';
import { roundLabel } from '../store/tournamentStore';
import { TeamCrest } from './TeamCrest';

interface Props {
  state: TournamentState;
  justPlayedRound: number;
  onClose: () => void;
}

export const TournamentRoundResultsModal = ({ state, justPlayedRound, onClose }: Props) => {
  const teamById = (id: string | null) => id ? state.teams.find(t => t.id === id) : null;
  const ties = state.ties.filter(t => t.round === justPlayedRound && t.played).sort((a, b) => a.slot - b.slot);

  const userTie = ties.find(t => t.homeTeamId === state.userTeamId || t.awayTeamId === state.userTeamId);
  const userWon = userTie?.winnerTeamId === state.userTeamId;
  const userPlayed = !!userTie;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl border-4 border-vga-bright-white bg-vga-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[92vh] flex flex-col"
      >
        <div className="bg-vga-blue/40 border-b-2 border-vga-blue px-3 py-2 text-center">
          <div className="text-vga-yellow text-[9px] uppercase tracking-widest font-bold">
            Resultados — {roundLabel(state.totalRounds, justPlayedRound)}
          </div>
          {userPlayed && (
            <div className={`text-[8px] uppercase mt-1 ${userWon ? 'text-vga-light-green' : 'text-vga-light-red'}`}>
              {userWon ? '¡Tu equipo pasa de ronda!' : 'Tu equipo queda eliminado.'}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {ties.map(tie => <TieRow key={tie.id} tie={tie} teamById={teamById} userTeamId={state.userTeamId} />)}
        </div>

        <div className="border-t-2 border-vga-blue p-2 bg-vga-blue/30">
          <button
            onClick={onClose}
            className="w-full bg-vga-yellow text-vga-black text-[10px] py-2 uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

const TieRow = ({ tie, teamById, userTeamId }: {
  tie: TournamentTie;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string;
}) => {
  const home = teamById(tie.homeTeamId);
  const away = teamById(tie.awayTeamId);
  const userInTie = tie.homeTeamId === userTeamId || tie.awayTeamId === userTeamId;
  const winnerIsHome = tie.winnerTeamId === tie.homeTeamId;
  const winnerIsAway = tie.winnerTeamId === tie.awayTeamId;
  return (
    <div className={`grid grid-cols-[1fr_auto_24px_auto_1fr] items-center gap-2 px-2 py-1.5 border-2 ${userInTie ? 'border-vga-yellow' : 'border-vga-blue'} bg-vga-black text-[9px]`}>
      <div className="flex items-center gap-2 min-w-0 justify-end">
        {home && <TeamCrest colors={home.colors} size="sm" teamId={home.id} title={home.name} />}
        <span className={`uppercase truncate ${winnerIsHome ? 'text-vga-yellow font-bold' : 'text-vga-bright-white opacity-60'}`}>
          {home?.name ?? '—'}
        </span>
      </div>
      <span className={`text-[12px] font-mono font-bold ${winnerIsHome ? 'text-vga-light-green' : 'text-vga-gray'}`}>
        {tie.homeScore ?? '·'}
      </span>
      <span className="text-vga-gray text-center">·</span>
      <span className={`text-[12px] font-mono font-bold ${winnerIsAway ? 'text-vga-light-green' : 'text-vga-gray'}`}>
        {tie.awayScore ?? '·'}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`uppercase truncate ${winnerIsAway ? 'text-vga-yellow font-bold' : 'text-vga-bright-white opacity-60'}`}>
          {away?.name ?? '—'}
        </span>
        {away && <TeamCrest colors={away.colors} size="sm" teamId={away.id} title={away.name} />}
      </div>
    </div>
  );
};

import type { TournamentState, TournamentTie } from '../store/tournamentStore';
import { roundLabel } from '../store/tournamentStore';
import { TeamCrest } from './TeamCrest';

interface Props {
  state: TournamentState;
  onAdvanceRound: () => void;
  onExit: () => void;
}

export const BracketView = ({ state, onAdvanceRound, onExit }: Props) => {
  const teamById = (id: string | null) => id ? state.teams.find(t => t.id === id) : null;
  const champion = state.champion ? teamById(state.champion) : null;
  const userTeam = teamById(state.userTeamId);
  const userIsChampion = state.champion === state.userTeamId;

  const userOut = state.ties.some(t => t.played && t.winnerTeamId && t.winnerTeamId !== state.userTeamId
    && (t.homeTeamId === state.userTeamId || t.awayTeamId === state.userTeamId));

  // Split each round's ties into a left half and right half. The final lives
  // alone in the center column. For an N-round tournament:
  //   - non-final rounds (0..N-2): first half of slots → left, second → right
  //   - final round (N-1): single tie → center
  const nonFinalRounds: number[] = [];
  for (let r = 0; r < state.totalRounds - 1; r++) nonFinalRounds.push(r);
  const finalRound = state.totalRounds - 1;
  const finalTie = state.ties.find(t => t.round === finalRound) ?? null;

  const tiesInRound = (r: number) => state.ties.filter(t => t.round === r).sort((a, b) => a.slot - b.slot);

  // For each round, left half = first N/2 ties, right half = last N/2 ties.
  // We render left rounds in ascending order (Octavos → Cuartos → SF) and
  // right rounds in DESCENDING order (SF → Cuartos → Octavos) so the bracket
  // flows toward the centre Final.
  const leftRounds = nonFinalRounds.map(r => {
    const ties = tiesInRound(r);
    return ties.slice(0, Math.ceil(ties.length / 2));
  });
  const rightRoundsAsc = nonFinalRounds.map(r => {
    const ties = tiesInRound(r);
    return ties.slice(Math.ceil(ties.length / 2));
  });
  // Right side renders in reverse: outermost (R1) on the far right.
  const rightRoundsRev = [...rightRoundsAsc].reverse();
  const rightRoundLabelsRev = [...nonFinalRounds].reverse();

  // The bracket lives in a CSS grid. Total columns = leftRounds.length + 1
  // (final) + rightRounds.length. For 16 teams: 3 left + 1 final + 3 right = 7.
  const columns = leftRounds.length + 1 + rightRoundsRev.length;

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-3 flex-wrap">
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

      {/* Two-sided bracket */}
      <div className="bg-vga-black border-4 border-vga-blue p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto">
        <div
          className="grid gap-3 min-w-fit"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(180px, 1fr))` }}
        >
          {/* Headers row */}
          {nonFinalRounds.map(r => (
            <RoundHeader
              key={`hl-${r}`}
              label={roundLabel(state.totalRounds, r)}
              current={r === state.currentRound}
            />
          ))}
          <RoundHeader
            label={roundLabel(state.totalRounds, finalRound)}
            current={finalRound === state.currentRound}
            golden
          />
          {rightRoundLabelsRev.map(r => (
            <RoundHeader
              key={`hr-${r}`}
              label={roundLabel(state.totalRounds, r)}
              current={r === state.currentRound}
            />
          ))}

          {/* Bracket body row */}
          {leftRounds.map((ties, idx) => (
            <Column
              key={`l-${idx}`}
              ties={ties}
              teamById={teamById}
              userTeamId={state.userTeamId}
              align="left"
            />
          ))}
          {/* Final column (vertically centered) */}
          <div className="flex items-center justify-center">
            {finalTie && (
              <TieCard
                tie={finalTie}
                teamById={teamById}
                userTeamId={state.userTeamId}
                emphasis
              />
            )}
          </div>
          {rightRoundsRev.map((ties, idx) => (
            <Column
              key={`r-${idx}`}
              ties={ties}
              teamById={teamById}
              userTeamId={state.userTeamId}
              align="right"
            />
          ))}
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

const RoundHeader = ({ label, current, golden }: { label: string; current: boolean; golden?: boolean }) => (
  <div className={`text-center text-[9px] uppercase tracking-widest py-1 border-2 ${
    golden ? 'border-vga-yellow text-vga-yellow bg-vga-blue/30 font-bold'
      : current ? 'border-vga-yellow text-vga-yellow'
      : 'border-vga-blue text-vga-cyan'
  }`}>
    {label}
  </div>
);

const Column = ({ ties, teamById, userTeamId, align }: {
  ties: TournamentTie[];
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string;
  align: 'left' | 'right';
}) => (
  // Evenly distribute ties vertically so later rounds line up between pairs
  // from the previous round.
  <div className={`flex flex-col justify-around gap-2 ${align === 'right' ? 'items-end' : 'items-start'}`}>
    {ties.map(tie => (
      <TieCard key={tie.id} tie={tie} teamById={teamById} userTeamId={userTeamId} />
    ))}
  </div>
);

const TieCard = ({ tie, teamById, userTeamId, emphasis }: {
  tie: TournamentTie;
  teamById: (id: string | null) => { id: string; name: string; colors?: string[] } | null | undefined;
  userTeamId: string;
  emphasis?: boolean;
}) => {
  const home = teamById(tie.homeTeamId);
  const away = teamById(tie.awayTeamId);
  const userInTie = tie.homeTeamId === userTeamId || tie.awayTeamId === userTeamId;
  const winnerIsHome = tie.winnerTeamId && tie.winnerTeamId === tie.homeTeamId;
  const winnerIsAway = tie.winnerTeamId && tie.winnerTeamId === tie.awayTeamId;
  return (
    <div
      className={`w-full border-2 ${userInTie ? 'border-vga-yellow' : tie.played ? 'border-vga-blue' : 'border-vga-gray'} bg-vga-black ${emphasis ? 'shadow-[3px_3px_0px_0px_rgba(255,255,85,0.5)]' : ''}`}
    >
      <Row team={home} score={tie.homeScore} loser={tie.played && !winnerIsHome} winner={!!winnerIsHome} />
      <Row team={away} score={tie.awayScore} loser={tie.played && !winnerIsAway} winner={!!winnerIsAway} />
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

import type { TeamStats } from '../store/leagueStore';
import type { Jornada } from '../engine/calendar';
import type { Team } from '../types/game.d.ts';
import { TeamCrest } from './TeamCrest';
import type { StatKey } from './StatDrillDown';

interface Props {
  stats: Record<string, TeamStats>;
  schedule?: Jornada[];
  userTeamId?: string;
  teams?: Team[];
  onCellClick?: (teamId: string, stat: StatKey) => void;
  onTeamClick?: (teamId: string) => void;
}

type FormChar = 'W' | 'D' | 'L';

const lastFiveForm = (teamId: string, schedule: Jornada[]): FormChar[] => {
  const out: FormChar[] = [];
  // Iterate from latest jornada backwards
  for (let i = schedule.length - 1; i >= 0 && out.length < 5; i--) {
    const m = schedule[i].matches.find(
      x => x.played && (x.homeId === teamId || x.awayId === teamId)
    );
    if (!m || m.homeScore == null || m.awayScore == null) continue;
    const isHome = m.homeId === teamId;
    const my = isHome ? m.homeScore : m.awayScore;
    const opp = isHome ? m.awayScore : m.homeScore;
    out.push(my > opp ? 'W' : my === opp ? 'D' : 'L');
  }
  return out.reverse(); // oldest → newest
};

const formColor = (c: FormChar) =>
  c === 'W' ? 'bg-vga-light-green' : c === 'D' ? 'bg-vga-yellow' : 'bg-vga-light-red';

export const LeagueTable = ({ stats, schedule, userTeamId, teams, onCellClick, onTeamClick }: Props) => {
  const colorsById = new Map<string, string[] | undefined>();
  const namesById = new Map<string, string>();
  teams?.forEach(t => {
    colorsById.set(t.id, t.colors);
    namesById.set(t.id, t.name);
  });

  const sortedStats = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.goalsFor - a.goalsAgainst;
    const diffB = b.goalsFor - b.goalsAgainst;
    return diffB - diffA;
  });

  const cell = (teamId: string, stat: StatKey, value: number, colorClass = '') => {
    const baseClass = `p-1 border border-vga-white text-center ${colorClass}`;
    if (!onCellClick || !schedule) {
      return <td className={baseClass}>{value}</td>;
    }
    return (
      <td className={`${baseClass} hover:bg-vga-magenta cursor-pointer`} onClick={() => onCellClick(teamId, stat)}>
        {value}
      </td>
    );
  };

  return (
    <div className="w-full overflow-x-auto border-4 border-vga-white bg-vga-gray p-2 vga-panel">
      <h2 className="text-vga-yellow text-center mb-4 text-sm">CLASIFICACIÓN - DIVISIÓN DE HONOR</h2>
      <table className="w-full text-[8px] text-left border-collapse">
        <thead>
          <tr className="bg-vga-blue text-vga-bright-white uppercase text-[7px]">
            <th className="p-1 border border-vga-white">POS</th>
            <th className="p-1 border border-vga-white text-left">EQUIPO</th>
            <th className="p-1 border border-vga-white text-center">PJ</th>
            <th className="p-1 border border-vga-white text-center">PG</th>
            <th className="p-1 border border-vga-white text-center">PE</th>
            <th className="p-1 border border-vga-white text-center">PP</th>
            <th className="p-1 border border-vga-white text-center">GF</th>
            <th className="p-1 border border-vga-white text-center">GC</th>
            <th className="p-1 border border-vga-white text-center">PTS</th>
            {schedule && <th className="p-1 border border-vga-white text-center">FORMA</th>}
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((team, index) => {
            const isUser = userTeamId && team.teamId === userTeamId;
            const baseBg = index % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray';
            const rowClass = isUser ? 'bg-vga-blue' : baseBg;
            const form = schedule ? lastFiveForm(team.teamId, schedule) : [];
            return (
              <tr key={team.teamId} className={rowClass}>
                <td className="p-1 border border-vga-white text-vga-yellow font-bold text-center">{index + 1}</td>
                <td className={`p-1 border border-vga-white truncate max-w-[140px] ${isUser ? 'text-vga-yellow font-bold' : ''} ${onTeamClick ? 'cursor-pointer hover:bg-vga-magenta' : ''}`}
                    onClick={onTeamClick ? () => onTeamClick(team.teamId) : undefined}>
                  <div className="flex items-center gap-1.5">
                    <TeamCrest colors={colorsById.get(team.teamId)} size="xs" />
                    <span className="truncate underline decoration-dotted underline-offset-2">{namesById.get(team.teamId) ?? team.name}</span>
                  </div>
                </td>
                {cell(team.teamId, 'played', team.played)}
                {cell(team.teamId, 'won', team.won, 'text-vga-light-green')}
                {cell(team.teamId, 'drawn', team.drawn, 'text-vga-white')}
                {cell(team.teamId, 'lost', team.lost, 'text-vga-light-red')}
                {cell(team.teamId, 'goalsFor', team.goalsFor)}
                {cell(team.teamId, 'goalsAgainst', team.goalsAgainst)}
                {cell(team.teamId, 'points', team.points, 'text-vga-yellow font-bold')}
                {schedule && (
                  <td className="p-1 border border-vga-white text-center">
                    <div className="flex justify-center gap-px">
                      {form.length === 0 ? (
                        <span className="text-vga-gray text-[7px]">—</span>
                      ) : (
                        form.map((c, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 ${formColor(c)} border border-vga-black`}
                            title={c}
                          />
                        ))
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

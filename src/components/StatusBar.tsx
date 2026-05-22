import type { LeagueState } from '../store/leagueStore';
import { formatEuros } from '../data/economy';
import { TeamCrest } from './TeamCrest';

interface Props {
  league: LeagueState;
}

export const StatusBar = ({ league }: Props) => {
  if (!league.isStarted) return null;
  const userTeam = league.teams.find(t => t.id === league.userTeamId);
  if (!userTeam) return null;

  const sorted = Object.values(league.stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
  });
  const pos = sorted.findIndex(s => s.teamId === userTeam.id) + 1;
  const total = sorted.length;
  const my = league.stats[userTeam.id];
  const diff = my ? my.goalsFor - my.goalsAgainst : 0;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

  const posColor =
    pos === 1 ? 'text-vga-yellow' :
    pos <= 3 ? 'text-vga-light-green' :
    pos >= total - 2 ? 'text-vga-light-red' :
    'text-vga-bright-white';

  const cashColor =
    userTeam.budget < 0 ? 'text-vga-light-red' :
    userTeam.budget < 1_000_000 ? 'text-vga-yellow' :
    'text-vga-light-green';

  return (
    <div className="bg-vga-blue border-2 border-vga-white vga-panel px-3 py-1 flex flex-wrap gap-x-4 gap-y-1 items-center text-[8px] mb-3 cool:bg-rc-panel cool:border-rc-primary">
      <div className="flex items-center gap-2">
        <TeamCrest colors={userTeam.colors} size="sm" title={userTeam.name} teamId={userTeam.id} />
        <span className="text-vga-bright-white truncate max-w-[180px] cool:text-rc-accent">{userTeam.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-vga-cyan cool:text-rc-accent">POS</span>
        <span className={`font-bold ${posColor}`}>{pos}/{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-vga-cyan cool:text-rc-accent">JOR</span>
        <span className="text-vga-bright-white cool:text-rc-accent">{league.currentJornada}/{league.schedule.length}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-vga-cyan cool:text-rc-accent">PTS</span>
        <span className="text-vga-yellow font-bold cool:text-rc-primary">{my?.points ?? 0}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-vga-cyan cool:text-rc-accent">DIF</span>
        <span className={diff >= 0 ? 'text-vga-light-green' : 'text-vga-light-red'}>{diffStr}</span>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-vga-cyan cool:text-rc-accent">CAJA</span>
        <span className={`font-bold ${cashColor}`}>{formatEuros(userTeam.budget)}</span>
      </div>
    </div>
  );
};

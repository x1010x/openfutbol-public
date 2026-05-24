import type { LeagueState } from '../store/leagueStore';
import { formatEuros } from '../data/economy';
import { TeamCrest } from './TeamCrest';
import { useT } from '../i18n';
import { objectiveLabel, clampMeter } from '../engine/florentinometro';

interface Props {
  league: LeagueState;
  onBoardAlert?: () => void;
  onCareer?: () => void;
}

export const StatusBar = ({ league, onBoardAlert, onCareer }: Props) => {
  const t = useT();
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

  const showFlorentino = league.gameMode === 'promanager';
  const meter = clampMeter(league.florentinometro ?? 5);
  const meterColor =
    meter >= 7 ? 'text-vga-light-green' :
    meter >= 5 ? 'text-vga-yellow' :
    'text-vga-light-red';
  const barColor =
    meter >= 7 ? 'bg-vga-light-green' :
    meter >= 5 ? 'bg-vga-yellow' :
    meter >= 2 ? 'bg-vga-light-red' :
    'bg-vga-red';
  const warnings = league.boardWarnings ?? 0;
  const objective = league.boardObjective ?? 'avoid_relegation';

  return (
    <div className="bg-vga-blue border-2 border-vga-white vga-panel px-3 py-1 mb-3 cool:bg-rc-panel cool:border-rc-primary">
      {/* Row 1: team status */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[8px]">
        <div className="flex items-center gap-2">
          <TeamCrest colors={userTeam.colors} size="sm" title={userTeam.name} teamId={userTeam.id} />
          <span className="text-vga-bright-white truncate max-w-[180px] cool:text-rc-accent">{userTeam.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-vga-cyan cool:text-rc-accent">{t('status.pos')}</span>
          <span className={`font-bold ${posColor}`}>{pos}/{total}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-vga-cyan cool:text-rc-accent">{t('status.round')}</span>
          <span className="text-vga-bright-white cool:text-rc-accent">{league.currentJornada}/{league.schedule.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-vga-cyan cool:text-rc-accent">{t('status.points')}</span>
          <span className="text-vga-yellow font-bold cool:text-rc-primary">{my?.points ?? 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-vga-cyan cool:text-rc-accent">{t('status.diff')}</span>
          <span className={diff >= 0 ? 'text-vga-light-green' : 'text-vga-light-red'}>{diffStr}</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-vga-cyan cool:text-rc-accent">{t('status.cash')}</span>
          <span className={`font-bold ${cashColor}`}>{formatEuros(userTeam.budget)}</span>
        </div>
      </div>

      {/* Row 2: florentinometro (promanager only) */}
      {showFlorentino && (
        <div className="flex items-center gap-2 mt-1 text-[7px] border-t border-vga-gray pt-1">
          <img
            src="/assets/misc/florentimometro.png"
            alt="F"
            className="w-4 h-4 object-contain shrink-0"
            style={{ imageRendering: 'pixelated' }}
          />
          <span className="text-vga-gray uppercase shrink-0">{t('florentino.meter')}</span>
          <div className="w-24 bg-vga-black h-2 border border-vga-gray relative shrink-0">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${(meter / 10) * 100}%` }} />
          </div>
          <span className={`font-bold shrink-0 ${meterColor}`}>{meter.toFixed(1)}</span>
          <span className="text-vga-cyan shrink-0">{objectiveLabel(objective)}</span>
          {warnings > 0 && !league.boardFired && onBoardAlert && (
            <button
              onClick={onBoardAlert}
              className="text-vga-light-red font-bold animate-pulse shrink-0 cursor-pointer hover:text-vga-yellow underline"
              title={t('florentino.warning')}
            >
              ⚠ ×{warnings}
            </button>
          )}
          {warnings > 0 && !league.boardFired && !onBoardAlert && (
            <span className="text-vga-light-red font-bold animate-pulse shrink-0">⚠ ×{warnings}</span>
          )}
          {league.boardFired && onBoardAlert && (
            <button
              onClick={onBoardAlert}
              className="text-vga-light-red font-bold animate-pulse shrink-0 cursor-pointer hover:text-vga-yellow underline"
              title={t('florentino.fired')}
            >
              {t('florentino.fired')}
            </button>
          )}
          {league.boardFired && !onBoardAlert && (
            <span className="text-vga-light-red font-bold animate-pulse shrink-0">{t('florentino.fired')}</span>
          )}
          {league.managerReputation !== undefined && (
            <span className="text-vga-gray text-[6px] shrink-0">
              REP <span className={`font-bold ${league.managerReputation >= 70 ? 'text-vga-light-green' : league.managerReputation >= 45 ? 'text-vga-yellow' : 'text-vga-light-red'}`}>{Math.round(league.managerReputation)}</span>
            </span>
          )}
          {league.managerName && onCareer && (
            <button
              onClick={onCareer}
              className="text-vga-magenta truncate ml-auto hover:text-vga-yellow underline decoration-dotted underline-offset-2 flex items-center gap-1"
              title={t('nav.managerCareer')}
            >
              <span className="text-[6px] text-vga-cyan opacity-70">📋</span>
              {league.managerName}
            </button>
          )}
          {league.managerName && !onCareer && (
            <span className="text-vga-magenta truncate ml-auto">{league.managerName}</span>
          )}
        </div>
      )}
    </div>
  );
};

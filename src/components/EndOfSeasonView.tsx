import type { Team } from '../types/game.d.ts';
import type { TeamStats } from '../store/leagueStore';
import { MAX_SEASON_YEAR } from '../store/leagueStore';
import { playerAge } from '../data/economy';
import { extractDbId, getRetireAge } from '../data/mockTeams';
import { PlayerName } from './PlayerName';
import { useT } from '../i18n';

interface Props {
  teams: Team[];
  stats: Record<string, TeamStats>;
  userTeamId: string;
  onContinueSameTeam: () => void;
  onAdvanceAndChangeTeam: () => void;
  onResetGame: () => void;
}

export const EndOfSeasonView = ({ teams, stats, userTeamId, onContinueSameTeam, onAdvanceAndChangeTeam, onResetGame }: Props) => {
  const t = useT();
  const year = teams[0]?.year ?? 0;
  const atCap = year >= MAX_SEASON_YEAR;

  const sortedStats = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const dgA = a.goalsFor - a.goalsAgainst;
    const dgB = b.goalsFor - b.goalsAgainst;
    if (dgB !== dgA) return dgB - dgA;
    return b.goalsFor - a.goalsFor;
  });

  const champion = sortedStats[0];
  const userIsChampion = champion?.teamId === userTeamId;

  const allPlayers = teams.flatMap(team => team.players.map(p => ({ ...p, teamName: team.name })));
  const topScorer = [...allPlayers].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)[0];
  const topAssister = [...allPlayers].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists)[0];

  const totalGoals = sortedStats.reduce((sum, s) => sum + s.goalsFor, 0);
  const matchesPlayed = sortedStats.reduce((sum, s) => sum + s.played, 0) / 2;
  const avgGoalsPerMatch = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(2) : '0.00';

  const bestAttack = [...sortedStats].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...sortedStats].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

  const teamsAvgAge = teams.map(team => {
    const starters = team.players.filter(p => team.lineup.includes(p.id));
    const avg = starters.length === 0 ? 0 : starters.reduce((s, p) => s + playerAge(p, year), 0) / starters.length;
    return { team, avgAge: avg };
  });
  const youngestTeam = [...teamsAvgAge].sort((a, b) => a.avgAge - b.avgAge)[0];
  const oldestTeam = [...teamsAvgAge].sort((a, b) => b.avgAge - a.avgAge)[0];
  const scorers = allPlayers.filter(p => p.seasonStats.goals > 0);
  const youngestScorer = [...scorers].sort((a, b) => playerAge(a, year) - playerAge(b, year))[0];
  const teamCards = teams.map(team => ({
    team,
    yellow: team.players.reduce((s, p) => s + p.seasonStats.yellowCards, 0),
    red: team.players.reduce((s, p) => s + p.seasonStats.redCards, 0),
  }));
  const cardsScored = teamCards.map(c => ({ ...c, total: c.yellow + c.red * 3 }));
  const mostViolent = [...cardsScored].sort((a, b) => b.total - a.total)[0];
  const mostFair = [...cardsScored].sort((a, b) => a.total - b.total)[0];
  const zamoraTeamStats = [...sortedStats].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
  const zamoraTeam = teams.find(team => team.id === zamoraTeamStats?.teamId);
  const zamoraKeeper = zamoraTeam?.players
    .filter(p => p.position === 'POR' && zamoraTeam.lineup.includes(p.id))
    .sort((a, b) => b.media - a.media)[0];

  const userTeam = teams.find(team => team.id === userTeamId);
  const retiringUserPlayers = (userTeam?.players ?? [])
    .filter(p => (year + 1) - p.birthYear >= getRetireAge(extractDbId(p.id), p.preferredPos))
    .sort((a, b) => (year - a.birthYear) - (year - b.birthYear) || a.position.localeCompare(b.position));

  const curio = (label: string, primary: string, secondary?: string) => (
    <div className="bg-vga-black border border-vga-magenta p-2 text-[8px]">
      <div className="text-vga-magenta text-[7px] uppercase mb-1">{label}</div>
      <div className="text-vga-bright-white truncate">{primary}</div>
      {secondary && <div className="text-vga-cyan text-[7px] truncate">{secondary}</div>}
    </div>
  );

  const yy = (y: number) => (y + 1).toString().slice(-2);

  return (
    <div className="w-full max-w-md flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-yellow border-4 border-vga-bright-white p-4 text-center vga-panel">
        <h2 className="text-vga-black text-xs font-bold uppercase mb-2">{t('section.endSeason', { year: String(year) })}</h2>
        <div className="bg-vga-black p-3 border-2 border-vga-bright-white">
          <p className="text-vga-yellow text-[10px] mb-2">{t('section.champion')}</p>
          <p className="text-vga-bright-white text-base font-bold uppercase">{champion?.name}</p>
          <p className="text-vga-light-green text-[8px] mt-2">{t('misc.pointsShort', { n: String(champion?.points ?? 0) })}</p>
        </div>
        {userIsChampion ? (
          <p className="text-vga-black text-[9px] mt-3 font-bold uppercase animate-pulse">{t('misc.youAreChampion')}</p>
        ) : (
          <p className="text-vga-black text-[8px] mt-3 uppercase">{t('misc.betterLuck')}</p>
        )}
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-2">
        <h3 className="text-vga-blue text-[10px] font-bold mb-2 text-center border-b border-vga-blue">{t('section.finalTable')}</h3>
        <table className="w-full text-[7px]">
          <thead>
            <tr className="text-vga-blue">
              <th className="text-left">#</th>
              <th className="text-left">{t('table.team')}</th>
              <th className="text-right">{t('table.played')}</th>
              <th className="text-right">{t('table.won')}</th>
              <th className="text-right">{t('table.drawn')}</th>
              <th className="text-right">{t('table.lost')}</th>
              <th className="text-right">{t('table.gf')}</th>
              <th className="text-right">{t('table.gc')}</th>
              <th className="text-right">DG</th>
              <th className="text-right">{t('table.points')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s, i) => {
              const dg = s.goalsFor - s.goalsAgainst;
              const isUser = s.teamId === userTeamId;
              return (
                <tr key={s.teamId} className={`${i === 0 ? 'bg-vga-yellow text-vga-black' : i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray'} ${isUser && i !== 0 ? 'text-vga-light-cyan' : ''}`}>
                  <td className={i === 0 ? 'text-vga-black font-bold' : 'text-vga-yellow font-bold'}>{i + 1}</td>
                  <td className="truncate max-w-[60px]">{s.name}</td>
                  <td className="text-right">{s.played}</td>
                  <td className="text-right">{s.won}</td>
                  <td className="text-right">{s.drawn}</td>
                  <td className="text-right">{s.lost}</td>
                  <td className="text-right">{s.goalsFor}</td>
                  <td className="text-right">{s.goalsAgainst}</td>
                  <td className="text-right">{dg > 0 ? `+${dg}` : dg}</td>
                  <td className="text-right font-bold">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">{t('section.pichichi')}</p>
          {topScorer && topScorer.seasonStats.goals > 0 ? (
            <>
              <p className="text-vga-black text-[9px] truncate">{topScorer.name}</p>
              <p className="text-vga-blue text-[7px] truncate">{topScorer.teamName}</p>
              <p className="text-vga-light-green text-[10px] font-bold mt-1">{t('misc.goalsCount', { n: String(topScorer.seasonStats.goals) })}</p>
            </>
          ) : <p className="text-vga-black text-[7px]">{t('label.noData')}</p>}
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">{t('section.topAssists')}</p>
          {topAssister && topAssister.seasonStats.assists > 0 ? (
            <>
              <p className="text-vga-black text-[9px] truncate">{topAssister.name}</p>
              <p className="text-vga-blue text-[7px] truncate">{topAssister.teamName}</p>
              <p className="text-vga-light-cyan text-[10px] font-bold mt-1">{t('misc.assistsCount', { n: String(topAssister.seasonStats.assists) })}</p>
            </>
          ) : <p className="text-vga-black text-[7px]">{t('label.noData')}</p>}
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">{t('section.bestAttack')}</p>
          <p className="text-vga-black text-[9px] truncate">{bestAttack?.name}</p>
          <p className="text-vga-light-green text-[10px] font-bold mt-1">{t('misc.goalsCount', { n: String(bestAttack?.goalsFor ?? 0) })}</p>
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">{t('section.bestDefense')}</p>
          <p className="text-vga-black text-[9px] truncate">{bestDefense?.name}</p>
          <p className="text-vga-light-red text-[10px] font-bold mt-1">{t('misc.concededCount', { n: String(bestDefense?.goalsAgainst ?? 0) })}</p>
        </div>
      </div>

      <div className="bg-vga-black border-2 border-vga-white p-2 text-center">
        <p className="text-vga-yellow text-[8px]">{t('section.leagueTotals')}</p>
        <div className="flex justify-around mt-2">
          <div>
            <p className="text-vga-white text-[7px]">{t('misc.matchTotal')}</p>
            <p className="text-vga-bright-white text-[10px] font-bold">{matchesPlayed}</p>
          </div>
          <div>
            <p className="text-vga-white text-[7px]">{t('misc.goalsTotal')}</p>
            <p className="text-vga-light-green text-[10px] font-bold">{totalGoals}</p>
          </div>
          <div>
            <p className="text-vga-white text-[7px]">{t('misc.avgLabel')}</p>
            <p className="text-vga-light-cyan text-[10px] font-bold">{avgGoalsPerMatch}</p>
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-magenta p-2">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 text-center border-b border-vga-magenta">{t('section.curiosities')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {youngestTeam && curio(t('misc.curioYoungest'), youngestTeam.team.name, t('misc.ageYears', { age: youngestTeam.avgAge.toFixed(1) }))}
          {oldestTeam && curio(t('misc.curioOldest'), oldestTeam.team.name, t('misc.ageYears', { age: oldestTeam.avgAge.toFixed(1) }))}
          {youngestScorer && curio(t('misc.curioYoungScorer'), youngestScorer.name, `${t('misc.ageYears', { age: String(playerAge(youngestScorer, year)) })} · ${youngestScorer.seasonStats.goals}G`)}
          {zamoraKeeper && curio(t('misc.curioZamora'), zamoraKeeper.name, zamoraTeam?.name)}
          {mostFair && curio(t('misc.curioFairPlay'), mostFair.team.name, `${mostFair.yellow}TA · ${mostFair.red}TR`)}
          {mostViolent && curio(t('misc.curioRoughest'), mostViolent.team.name, `${mostViolent.yellow}TA · ${mostViolent.red}TR`)}
        </div>
      </div>

      {retiringUserPlayers.length > 0 && (
        <div className="bg-vga-black border-4 border-vga-yellow p-3">
          <h3 className="text-vga-yellow text-[10px] font-bold mb-2 text-center uppercase">
            {t('misc.retirement', { team: userTeam?.name ?? '' })}
          </h3>
          <p className="text-vga-bright-white text-[8px] mb-2 text-center">
            {retiringUserPlayers.length === 1
              ? t('misc.retiring1')
              : t('misc.retiringN', { n: String(retiringUserPlayers.length) })}
          </p>
          <div className="flex flex-col gap-1">
            {retiringUserPlayers.map(p => (
              <div key={p.id} className="bg-vga-blue border border-vga-yellow px-2 py-1 text-[8px] flex justify-between items-center">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-vga-yellow font-bold mr-1">{p.position}</span>
                  <PlayerName player={p} className="text-vga-bright-white" />
                </div>
                <span className="text-vga-light-cyan shrink-0 ml-2">{t('misc.ageYears', { age: String(playerAge(p, year)) })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {atCap ? (
        <div className="flex flex-col gap-2">
          <div className="bg-vga-black border-2 border-vga-yellow p-3 text-center">
            <p className="text-vga-yellow text-xs font-bold uppercase">{t('misc.gameOver')}</p>
            <p className="text-vga-bright-white text-[8px] mt-2 uppercase">
              {t('misc.atCap', { year: String(MAX_SEASON_YEAR), yy: yy(MAX_SEASON_YEAR) })}
            </p>
          </div>
          <button
            onClick={onResetGame}
            className="w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold"
          >
            {t('btn.newGame')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinueSameTeam}
            className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold"
          >
            {t('misc.continueNextSeason', { year: String(year + 1), yy: yy(year + 1) })}
          </button>
          <button
            onClick={onAdvanceAndChangeTeam}
            className="w-full bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold"
          >
            {t('btn.changeTeam')}
          </button>
        </div>
      )}
    </div>
  );
};

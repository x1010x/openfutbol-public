import type { Team } from '../types/game.d.ts';
import type { TeamStats } from '../store/leagueStore';
import { MAX_SEASON_YEAR } from '../store/leagueStore';
import { playerAge } from '../data/economy';
import { extractDbId, getRetireAge } from '../data/mockTeams';
import { PlayerName } from './PlayerName';

interface Props {
  teams: Team[];
  stats: Record<string, TeamStats>;
  userTeamId: string;
  onContinueSameTeam: () => void;
  onAdvanceAndChangeTeam: () => void;
  onResetGame: () => void;
}

export const EndOfSeasonView = ({ teams, stats, userTeamId, onContinueSameTeam, onAdvanceAndChangeTeam, onResetGame }: Props) => {
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

  const allPlayers = teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })));
  const topScorer = [...allPlayers].sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)[0];
  const topAssister = [...allPlayers].sort((a, b) => b.seasonStats.assists - a.seasonStats.assists)[0];

  const totalGoals = sortedStats.reduce((sum, s) => sum + s.goalsFor, 0);
  const matchesPlayed = sortedStats.reduce((sum, s) => sum + s.played, 0) / 2;
  const avgGoalsPerMatch = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(2) : '0.00';

  const bestAttack = [...sortedStats].sort((a, b) => b.goalsFor - a.goalsFor)[0];
  const bestDefense = [...sortedStats].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];

  // Datos curiosos
  const teamsAvgAge = teams.map(t => {
    const starters = t.players.filter(p => t.lineup.includes(p.id));
    const avg = starters.length === 0 ? 0 : starters.reduce((s, p) => s + playerAge(p, year), 0) / starters.length;
    return { team: t, avgAge: avg };
  });
  const youngestTeam = [...teamsAvgAge].sort((a, b) => a.avgAge - b.avgAge)[0];
  const oldestTeam = [...teamsAvgAge].sort((a, b) => b.avgAge - a.avgAge)[0];
  const scorers = allPlayers.filter(p => p.seasonStats.goals > 0);
  const youngestScorer = [...scorers].sort((a, b) => playerAge(a, year) - playerAge(b, year))[0];
  const teamCards = teams.map(t => ({
    team: t,
    yellow: t.players.reduce((s, p) => s + p.seasonStats.yellowCards, 0),
    red: t.players.reduce((s, p) => s + p.seasonStats.redCards, 0),
  }));
  const cardsScored = teamCards.map(c => ({ ...c, total: c.yellow + c.red * 3 }));
  const mostViolent = [...cardsScored].sort((a, b) => b.total - a.total)[0];
  const mostFair = [...cardsScored].sort((a, b) => a.total - b.total)[0];
  const zamoraTeamStats = [...sortedStats].sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0];
  const zamoraTeam = teams.find(t => t.id === zamoraTeamStats?.teamId);
  const zamoraKeeper = zamoraTeam?.players
    .filter(p => p.position === 'POR' && zamoraTeam.lineup.includes(p.id))
    .sort((a, b) => b.media - a.media)[0];

  const userTeam = teams.find(t => t.id === userTeamId);
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

  return (
    <div className="w-full max-w-md flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-yellow border-4 border-vga-bright-white p-4 text-center vga-panel">
        <h2 className="text-vga-black text-xs font-bold uppercase mb-2">FIN DE TEMPORADA {teams[0]?.year}</h2>
        <div className="bg-vga-black p-3 border-2 border-vga-bright-white">
          <p className="text-vga-yellow text-[10px] mb-2">CAMPEÓN DE LIGA</p>
          <p className="text-vga-bright-white text-base font-bold uppercase">{champion?.name}</p>
          <p className="text-vga-light-green text-[8px] mt-2">{champion?.points} PUNTOS</p>
        </div>
        {userIsChampion ? (
          <p className="text-vga-black text-[9px] mt-3 font-bold uppercase animate-pulse">¡FELICIDADES, ERES EL CAMPEÓN!</p>
        ) : (
          <p className="text-vga-black text-[8px] mt-3 uppercase">Mejor suerte la próxima temporada</p>
        )}
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-2">
        <h3 className="text-vga-blue text-[10px] font-bold mb-2 text-center border-b border-vga-blue">CLASIFICACIÓN FINAL</h3>
        <table className="w-full text-[7px]">
          <thead>
            <tr className="text-vga-blue">
              <th className="text-left">#</th>
              <th className="text-left">EQUIPO</th>
              <th className="text-right">PJ</th>
              <th className="text-right">G</th>
              <th className="text-right">E</th>
              <th className="text-right">P</th>
              <th className="text-right">GF</th>
              <th className="text-right">GC</th>
              <th className="text-right">DG</th>
              <th className="text-right">PT</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((t, i) => {
              const dg = t.goalsFor - t.goalsAgainst;
              const isUser = t.teamId === userTeamId;
              return (
                <tr key={t.teamId} className={`${i === 0 ? 'bg-vga-yellow text-vga-black' : i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray'} ${isUser && i !== 0 ? 'text-vga-light-cyan' : ''}`}>
                  <td className={i === 0 ? 'text-vga-black font-bold' : 'text-vga-yellow font-bold'}>{i + 1}</td>
                  <td className="truncate max-w-[60px]">{t.name}</td>
                  <td className="text-right">{t.played}</td>
                  <td className="text-right">{t.won}</td>
                  <td className="text-right">{t.drawn}</td>
                  <td className="text-right">{t.lost}</td>
                  <td className="text-right">{t.goalsFor}</td>
                  <td className="text-right">{t.goalsAgainst}</td>
                  <td className="text-right">{dg > 0 ? `+${dg}` : dg}</td>
                  <td className="text-right font-bold">{t.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">PICHICHI</p>
          {topScorer && topScorer.seasonStats.goals > 0 ? (
            <>
              <p className="text-vga-black text-[9px] truncate">{topScorer.name}</p>
              <p className="text-vga-blue text-[7px] truncate">{topScorer.teamName}</p>
              <p className="text-vga-light-green text-[10px] font-bold mt-1">{topScorer.seasonStats.goals} GOLES</p>
            </>
          ) : <p className="text-vga-black text-[7px]">SIN DATOS</p>}
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">MÁS ASISTENCIAS</p>
          {topAssister && topAssister.seasonStats.assists > 0 ? (
            <>
              <p className="text-vga-black text-[9px] truncate">{topAssister.name}</p>
              <p className="text-vga-blue text-[7px] truncate">{topAssister.teamName}</p>
              <p className="text-vga-light-cyan text-[10px] font-bold mt-1">{topAssister.seasonStats.assists} ASIST.</p>
            </>
          ) : <p className="text-vga-black text-[7px]">SIN DATOS</p>}
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">MEJOR ATAQUE</p>
          <p className="text-vga-black text-[9px] truncate">{bestAttack?.name}</p>
          <p className="text-vga-light-green text-[10px] font-bold mt-1">{bestAttack?.goalsFor} GOLES</p>
        </div>

        <div className="bg-vga-gray border-2 border-vga-blue p-2">
          <p className="text-vga-blue text-[8px] font-bold mb-1">MEJOR DEFENSA</p>
          <p className="text-vga-black text-[9px] truncate">{bestDefense?.name}</p>
          <p className="text-vga-light-red text-[10px] font-bold mt-1">{bestDefense?.goalsAgainst} ENCAJADOS</p>
        </div>
      </div>

      <div className="bg-vga-black border-2 border-vga-white p-2 text-center">
        <p className="text-vga-yellow text-[8px]">TOTALES DE LA LIGA</p>
        <div className="flex justify-around mt-2">
          <div>
            <p className="text-vga-white text-[7px]">PARTIDOS</p>
            <p className="text-vga-bright-white text-[10px] font-bold">{matchesPlayed}</p>
          </div>
          <div>
            <p className="text-vga-white text-[7px]">GOLES</p>
            <p className="text-vga-light-green text-[10px] font-bold">{totalGoals}</p>
          </div>
          <div>
            <p className="text-vga-white text-[7px]">PROMEDIO</p>
            <p className="text-vga-light-cyan text-[10px] font-bold">{avgGoalsPerMatch}</p>
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-magenta p-2">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 text-center border-b border-vga-magenta">DATOS CURIOSOS</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {youngestTeam && curio('MÁS JOVEN', youngestTeam.team.name, `${youngestTeam.avgAge.toFixed(1)} años`)}
          {oldestTeam && curio('MÁS VETERANA', oldestTeam.team.name, `${oldestTeam.avgAge.toFixed(1)} años`)}
          {youngestScorer && curio('GOLEADOR MÁS JOVEN', youngestScorer.name, `${playerAge(youngestScorer, year)} años · ${youngestScorer.seasonStats.goals}G`)}
          {zamoraKeeper && curio('TROFEO ZAMORA', zamoraKeeper.name, zamoraTeam?.name)}
          {mostFair && curio('JUEGO LIMPIO', mostFair.team.name, `${mostFair.yellow}TA · ${mostFair.red}TR`)}
          {mostViolent && curio('EQUIPO MÁS DURO', mostViolent.team.name, `${mostViolent.yellow}TA · ${mostViolent.red}TR`)}
        </div>
      </div>

      {retiringUserPlayers.length > 0 && (
        <div className="bg-vga-black border-4 border-vga-yellow p-3">
          <h3 className="text-vga-yellow text-[10px] font-bold mb-2 text-center uppercase">
            Retiros — {userTeam?.name}
          </h3>
          <p className="text-vga-bright-white text-[8px] mb-2 text-center">
            {retiringUserPlayers.length === 1
              ? 'Un jugador cuelga las botas tras esta temporada.'
              : `${retiringUserPlayers.length} jugadores cuelgan las botas tras esta temporada.`}
          </p>
          <div className="flex flex-col gap-1">
            {retiringUserPlayers.map(p => (
              <div key={p.id} className="bg-vga-blue border border-vga-yellow px-2 py-1 text-[8px] flex justify-between items-center">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-vga-yellow font-bold mr-1">{p.position}</span>
                  <PlayerName player={p} className="text-vga-bright-white" />
                </div>
                <span className="text-vga-light-cyan shrink-0 ml-2">{playerAge(p, year)} años</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {atCap ? (
        <div className="flex flex-col gap-2">
          <div className="bg-vga-black border-2 border-vga-yellow p-3 text-center">
            <p className="text-vga-yellow text-xs font-bold uppercase">FIN DEL JUEGO</p>
            <p className="text-vga-bright-white text-[8px] mt-2 uppercase">
              Has llegado al final de la temporada {MAX_SEASON_YEAR}/{(MAX_SEASON_YEAR + 1).toString().slice(-2)}.
            </p>
          </div>
          <button
            onClick={onResetGame}
            className="w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold"
          >
            EMPEZAR NUEVO JUEGO
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinueSameTeam}
            className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold"
          >
            CONTINUAR — TEMPORADA {year + 1}/{(year + 2).toString().slice(-2)}
          </button>
          <button
            onClick={onAdvanceAndChangeTeam}
            className="w-full bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold"
          >
            CAMBIAR DE EQUIPO
          </button>
        </div>
      )}
    </div>
  );
};

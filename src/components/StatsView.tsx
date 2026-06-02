import type { Player, Team } from '../types/game.d.ts';
import { PlayerName } from './PlayerName';
import { PlayerPhoto } from './PlayerPhoto';
import { TeamCrest } from './TeamCrest';
import { useT } from '../i18n';

interface Props {
  teams: Team[];
  onPlayerClick?: (playerId: string) => void;
  onBack: () => void;
}

type EnrichedPlayer = Player & { teamName: string; teamId: string; teamColors?: string[] };

const Panel = ({ title, accent = 'text-vga-magenta', children, className = '' }: {
  title: string; accent?: string; children: React.ReactNode; className?: string;
}) => (
  <div className={`bg-vga-black border border-vga-blue flex flex-col ${className}`}>
    <div className={`${accent} text-[9px] uppercase tracking-widest px-2 py-1 border-b border-vga-blue`}>{title}</div>
    <div className="flex-1">{children}</div>
  </div>
);

const PodiumCard = ({ rank, player, value, valueColor, onClick }: {
  rank: number;
  player: EnrichedPlayer;
  value: string;
  valueColor: string;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`bg-vga-black border ${rank === 1 ? 'border-vga-yellow' : 'border-vga-blue'} p-2 flex items-center gap-2 ${onClick ? 'cursor-pointer hover:border-vga-magenta' : ''}`}
  >
    <div className={`text-[14px] font-bold w-5 text-center ${rank === 1 ? 'text-vga-yellow' : rank === 2 ? 'text-vga-cyan' : 'text-vga-magenta'}`}>{rank}</div>
    <PlayerPhoto sourceId={player.source_id} size="md" className="border border-vga-blue" />
    <div className="min-w-0 flex-1 flex items-center gap-1.5">
      <TeamCrest size="xs" teamId={player.teamId} colors={player.teamColors} title={player.teamName} />
      <div className="text-vga-bright-white text-[9px] truncate"><PlayerName player={player} /></div>
    </div>
    <div className={`${valueColor} text-[12px] font-bold tabular-nums`}>{value}</div>
  </div>
);

const RankRow = ({ rank, player, value, valueColor, onClick }: {
  rank: number;
  player: EnrichedPlayer;
  value: string;
  valueColor: string;
  onClick?: () => void;
}) => (
  <tr onClick={onClick} className={`${onClick ? 'cursor-pointer hover:bg-vga-blue/30' : ''}`}>
    <td className="text-vga-magenta pl-2 py-0.5 w-5">{rank}</td>
    <td className="text-vga-bright-white truncate max-w-[160px]"><PlayerName player={player} /></td>
    <td className="py-0.5 w-5" title={player.teamName}>
      <TeamCrest size="xs" teamId={player.teamId} colors={player.teamColors} title={player.teamName} />
    </td>
    <td className={`text-right pr-2 font-bold tabular-nums ${valueColor}`}>{value}</td>
  </tr>
);

const MiniRankRow = ({ rank, player, valueNode, onPlayerClick }: {
  rank: number;
  player: EnrichedPlayer;
  valueNode: React.ReactNode;
  onPlayerClick?: (id: string) => void;
}) => (
  <tr onClick={onPlayerClick ? () => onPlayerClick(player.id) : undefined} className={onPlayerClick ? 'cursor-pointer hover:bg-vga-blue/30' : ''}>
    <td className="pl-2 text-vga-magenta py-0.5 w-5">{rank}</td>
    <td className="text-vga-bright-white truncate max-w-[120px]"><PlayerName player={player} /></td>
    <td className="py-0.5 w-5" title={player.teamName}>
      <TeamCrest size="xs" teamId={player.teamId} colors={player.teamColors} title={player.teamName} />
    </td>
    <td className="text-right pr-2">{valueNode}</td>
  </tr>
);

export const StatsView = ({ teams, onPlayerClick, onBack }: Props) => {
  const t = useT();
  const allPlayers: EnrichedPlayer[] = teams.flatMap(team => team.players.map(p => ({ ...p, teamName: team.name, teamId: team.id, teamColors: team.colors })));
  const withApps = allPlayers.filter(p => p.seasonStats.appearances > 0);
  // Scale the "regular" threshold to the season's progress: the most-used
  // player gives us an upper bound on matches played, so a regular needs at
  // least ~40% of that, with a floor of 5 to filter out 1-game wonders.
  const maxAppsAny = withApps.reduce((m, p) => Math.max(m, p.seasonStats.appearances), 0);
  const minAppsRegular = Math.max(5, Math.floor(maxAppsAny * 0.4));

  const goalsRanked = [...allPlayers].filter(p => p.seasonStats.goals > 0).sort((a, b) => b.seasonStats.goals - a.seasonStats.goals);
  const assistsRanked = [...allPlayers].filter(p => p.seasonStats.assists > 0).sort((a, b) => b.seasonStats.assists - a.seasonStats.assists);
  const cardsRanked = [...allPlayers]
    .filter(p => p.seasonStats.yellowCards > 0 || p.seasonStats.redCards > 0)
    .sort((a, b) => (b.seasonStats.redCards * 5 + b.seasonStats.yellowCards) - (a.seasonStats.redCards * 5 + a.seasonStats.yellowCards));

  const ratingRanked = [...withApps]
    .filter(p => p.seasonStats.appearances >= minAppsRegular)
    .sort((a, b) => (b.seasonStats.ratingSum / b.seasonStats.appearances) - (a.seasonStats.ratingSum / a.seasonStats.appearances));

  const minutesRanked = [...withApps].sort((a, b) => b.seasonStats.minutes - a.seasonStats.minutes);

  const cleanSheetsRanked = [...allPlayers]
    .filter(p => p.preferredPos === 'POR' && p.seasonStats.cleanSheets > 0)
    .sort((a, b) => b.seasonStats.cleanSheets - a.seasonStats.cleanSheets);

  const goalContribRanked = [...allPlayers]
    .filter(p => (p.seasonStats.goals + p.seasonStats.assists) > 0)
    .sort((a, b) => (b.seasonStats.goals + b.seasonStats.assists) - (a.seasonStats.goals + a.seasonStats.assists));

  const handlePlayer = (id: string) => () => onPlayerClick?.(id);

  return (
    <div className="w-full flex flex-col gap-3 animate-in fade-in duration-300 px-2">
      {/* Header */}
      <div className="bg-vga-black border border-vga-blue px-3 py-2 flex items-center justify-between">
        <span className="text-vga-magenta text-[10px] uppercase tracking-widest">{t('section.rankings')}</span>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red font-bold">
          {t('btn.back')}
        </button>
      </div>

      {/* Podium row — top 3 scorers, top 3 assisters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title="Bota de oro · Pichichi">
          <div className="flex flex-col gap-1 p-2">
            {goalsRanked.slice(0, 3).map((p, i) => (
              <PodiumCard key={p.id} rank={i + 1} player={p} value={`${p.seasonStats.goals}G`} valueColor="text-vga-light-green" onClick={handlePlayer(p.id)} />
            ))}
            {goalsRanked.length === 0 && <div className="text-vga-gray text-[8px] p-2">Sin goleadores aún.</div>}
          </div>
        </Panel>
        <Panel title="Rey de la asistencia">
          <div className="flex flex-col gap-1 p-2">
            {assistsRanked.slice(0, 3).map((p, i) => (
              <PodiumCard key={p.id} rank={i + 1} player={p} value={`${p.seasonStats.assists}A`} valueColor="text-vga-light-cyan" onClick={handlePlayer(p.id)} />
            ))}
            {assistsRanked.length === 0 && <div className="text-vga-gray text-[8px] p-2">Sin asistencias todavía.</div>}
          </div>
        </Panel>
      </div>

      {/* Two-column row: full rankings table for goals & assists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Panel title={`Máximos goleadores · top 10`}>
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase">
              <th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">G</th>
            </tr></thead>
            <tbody>
              {goalsRanked.slice(0, 10).map((p, i) => (
                <RankRow key={p.id} rank={i + 1} player={p} value={String(p.seasonStats.goals)} valueColor="text-vga-light-green" onClick={handlePlayer(p.id)} />
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Máximos asistentes · top 10">
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase">
              <th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">A</th>
            </tr></thead>
            <tbody>
              {assistsRanked.slice(0, 10).map((p, i) => (
                <RankRow key={p.id} rank={i + 1} player={p} value={String(p.seasonStats.assists)} valueColor="text-vga-light-cyan" onClick={handlePlayer(p.id)} />
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Four-column: rating · contrib · minutes · clean sheets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <Panel title="Mejor media">
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase"><th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">Avg</th></tr></thead>
            <tbody>
              {ratingRanked.slice(0, 8).map((p, i) => (
                <MiniRankRow key={p.id} rank={i + 1} player={p} onPlayerClick={onPlayerClick}
                  valueNode={<span className="text-vga-yellow font-bold tabular-nums">{(p.seasonStats.ratingSum / p.seasonStats.appearances).toFixed(2)}</span>}
                />
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="G + A">
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase"><th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">G+A</th></tr></thead>
            <tbody>
              {goalContribRanked.slice(0, 8).map((p, i) => (
                <MiniRankRow key={p.id} rank={i + 1} player={p} onPlayerClick={onPlayerClick}
                  valueNode={<span className="text-vga-light-green font-bold tabular-nums">{p.seasonStats.goals + p.seasonStats.assists}</span>}
                />
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Más minutos">
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase"><th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">Min</th></tr></thead>
            <tbody>
              {minutesRanked.slice(0, 8).map((p, i) => (
                <MiniRankRow key={p.id} rank={i + 1} player={p} onPlayerClick={onPlayerClick}
                  valueNode={<span className="text-vga-light-cyan font-bold tabular-nums">{p.seasonStats.minutes}'</span>}
                />
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Porterías a cero">
          <table className="w-full text-[9px]">
            <thead><tr className="text-vga-magenta text-[7px] uppercase"><th className="pl-2 text-left">#</th><th className="text-left">Portero</th><th></th><th className="text-right pr-2">CS</th></tr></thead>
            <tbody>
              {cleanSheetsRanked.slice(0, 8).map((p, i) => (
                <MiniRankRow key={p.id} rank={i + 1} player={p} onPlayerClick={onPlayerClick}
                  valueNode={<span className="text-vga-light-green font-bold tabular-nums">{p.seasonStats.cleanSheets}</span>}
                />
              ))}
              {cleanSheetsRanked.length === 0 && (
                <tr><td colSpan={4} className="text-vga-gray text-[8px] text-center p-2">Aún ningún portero ha dejado la portería a cero.</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Disciplina — same table format as mini rankings above */}
      <Panel title="Ranking disciplinario" accent="text-vga-light-red">
        <table className="w-full text-[9px]">
          <thead><tr className="text-vga-light-red text-[7px] uppercase"><th className="pl-2 text-left">#</th><th className="text-left">Jugador</th><th></th><th className="text-right pr-2">Tarjetas</th></tr></thead>
          <tbody>
            {cardsRanked.slice(0, 10).map((p, i) => (
              <MiniRankRow key={p.id} rank={i + 1} player={p} onPlayerClick={onPlayerClick}
                valueNode={
                  <span className="inline-flex gap-1.5 font-bold tabular-nums">
                    {p.seasonStats.yellowCards > 0 && (
                      <span className="text-vga-yellow flex items-center gap-0.5"><span className="w-1.5 h-2 bg-vga-yellow inline-block border border-black" />{p.seasonStats.yellowCards}</span>
                    )}
                    {p.seasonStats.redCards > 0 && (
                      <span className="text-vga-light-red flex items-center gap-0.5"><span className="w-1.5 h-2 bg-vga-light-red inline-block border border-black" />{p.seasonStats.redCards}</span>
                    )}
                  </span>
                }
              />
            ))}
            {cardsRanked.length === 0 && (
              <tr><td colSpan={4} className="text-vga-gray text-[8px] text-center p-2">Liga ejemplar: nadie ha visto una tarjeta todavía.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
};

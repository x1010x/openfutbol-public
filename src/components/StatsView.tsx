import type { Team } from '../types/game.d.ts';

interface Props {
  teams: Team[];
  onPlayerClick?: (playerId: string) => void;
  onBack: () => void;
}

export const StatsView = ({ teams, onPlayerClick, onBack }: Props) => {
  const allPlayers = teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name, teamId: t.id })));

  const pichichi = [...allPlayers]
    .filter(p => p.seasonStats.goals > 0)
    .sort((a, b) => b.seasonStats.goals - a.seasonStats.goals)
    .slice(0, 10);

  const assistants = [...allPlayers]
    .filter(p => p.seasonStats.assists > 0)
    .sort((a, b) => b.seasonStats.assists - a.seasonStats.assists)
    .slice(0, 10);

  const badBoys = [...allPlayers]
    .filter(p => p.seasonStats.yellowCards > 0 || p.seasonStats.redCards > 0)
    .sort((a, b) => (b.seasonStats.redCards * 5 + b.seasonStats.yellowCards) - (a.seasonStats.redCards * 5 + a.seasonStats.yellowCards))
    .slice(0, 10);

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">RANKINGS DE LA TEMPORADA</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black">
          VOLVER
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PICHICHI */}
        <div className="bg-vga-gray border-4 border-vga-blue p-2">
          <h3 className="text-vga-blue text-[10px] font-bold mb-2 text-center border-b border-vga-blue">MÁXIMOS GOLEADORES</h3>
          <table className="w-full text-[7px]">
            <thead>
              <tr className="text-vga-gray-700">
                <th className="text-left">JUGADOR</th>
                <th className="text-left">CLUB</th>
                <th className="text-right">G</th>
              </tr>
            </thead>
            <tbody>
              {pichichi.map((p, i) => (
                <tr key={i} className="border-b border-vga-white/20">
                  <td className="text-vga-black">
                    {onPlayerClick ? (
                      <button onClick={() => onPlayerClick(p.id)} className="hover:text-vga-blue underline decoration-dotted underline-offset-2">{p.name}</button>
                    ) : p.name}
                  </td>
                  <td className="text-vga-blue truncate max-w-[100px]">{p.teamName}</td>
                  <td className="text-right text-vga-light-green font-bold">{p.seasonStats.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ASISTENTES */}
        <div className="bg-vga-gray border-4 border-vga-blue p-2">
          <h3 className="text-vga-blue text-[10px] font-bold mb-2 text-center border-b border-vga-blue">MÁXIMOS ASISTENTES</h3>
          <table className="w-full text-[7px]">
            <thead>
              <tr className="text-vga-gray-700">
                <th className="text-left">JUGADOR</th>
                <th className="text-left">CLUB</th>
                <th className="text-right">A</th>
              </tr>
            </thead>
            <tbody>
              {assistants.map((p, i) => (
                <tr key={i} className="border-b border-vga-white/20">
                  <td className="text-vga-black">
                    {onPlayerClick ? (
                      <button onClick={() => onPlayerClick(p.id)} className="hover:text-vga-blue underline decoration-dotted underline-offset-2">{p.name}</button>
                    ) : p.name}
                  </td>
                  <td className="text-vga-blue truncate max-w-[100px]">{p.teamName}</td>
                  <td className="text-right text-vga-light-cyan font-bold">{p.seasonStats.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DISCIPLINA */}
        <div className="bg-vga-gray border-4 border-vga-red p-2 md:col-span-2">
          <h3 className="text-vga-red text-[10px] font-bold mb-2 text-center border-b border-vga-red">RANKING DISCIPLINARIO</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {badBoys.map((p, i) => (
              <div key={i} className="bg-vga-black p-1 border border-vga-white flex flex-col items-center">
                {onPlayerClick ? (
                  <button onClick={() => onPlayerClick(p.id)} className="text-vga-white text-[6px] text-center truncate w-full hover:text-vga-yellow underline decoration-dotted">{p.name}</button>
                ) : (
                  <span className="text-vga-white text-[6px] text-center truncate w-full">{p.name}</span>
                )}
                <div className="flex gap-1 mt-1">
                  <div className="flex items-center">
                    <div className="w-2 h-3 bg-vga-yellow"></div>
                    <span className="text-vga-yellow text-[8px] ml-1">{p.seasonStats.yellowCards}</span>
                  </div>
                  <div className="flex items-center ml-2">
                    <div className="w-2 h-3 bg-vga-red"></div>
                    <span className="text-vga-red text-[8px] ml-1">{p.seasonStats.redCards}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

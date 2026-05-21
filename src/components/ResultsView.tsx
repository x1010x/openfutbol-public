import { useState } from 'react';
import type { Jornada } from '../engine/calendar';
import type { Team } from '../types/game.d.ts';
import { MatchDetails } from './JornadaResultsView';

interface Props {
  schedule: Jornada[];
  teams: Team[];
  onBack: () => void;
  currentJornada: number;
  userTeamId: string;
}

export const ResultsView = ({ schedule, teams, onBack, currentJornada, userTeamId }: Props) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || '???';

  return (
    <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">RESULTADOS DE LA LIGA</h2>
        <button
          onClick={onBack}
          className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red"
        >
          VOLVER
        </button>
      </div>

      <div className="bg-vga-black border-4 border-vga-blue h-[32rem] overflow-y-auto p-2">
        {schedule.map((jornada) => (
          <div key={jornada.number} className="mb-6 border-b border-vga-gray pb-4">
            <h3 className={`text-[10px] text-center mb-3 ${jornada.number === currentJornada ? 'text-vga-light-green' : 'text-vga-cyan'}`}>
              JORNADA {jornada.number} {jornada.number === currentJornada ? '(ACTUAL)' : ''}
            </h3>
            <div className="flex flex-col gap-2">
              {jornada.matches.map((match, i) => {
                const key = `${jornada.number}_${i}`;
                const isOpen = openKey === key;
                const isUser = match.homeId === userTeamId || match.awayId === userTeamId;
                const hasEvents = !!match.events && match.events.length > 0;
                const canOpen = match.played && hasEvents;
                return (
                  <div key={i} className={`bg-vga-black border-2 ${isUser ? 'border-vga-yellow' : 'border-vga-gray'}`}>
                    <button
                      onClick={() => canOpen && setOpenKey(isOpen ? null : key)}
                      disabled={!canOpen}
                      className={`w-full grid grid-cols-7 items-center gap-2 p-2 text-[9px] ${canOpen ? 'cursor-pointer hover:bg-vga-gray/20' : 'cursor-default'}`}
                    >
                      <div className="col-span-3 text-vga-bright-white truncate text-right">{getTeamName(match.homeId)}</div>
                      <div className="col-span-1 text-center font-mono text-vga-yellow text-[11px]">
                        {match.played ? `${match.homeScore} - ${match.awayScore}` : '—'}
                      </div>
                      <div className="col-span-3 text-vga-bright-white truncate text-left flex items-center justify-between">
                        <span className="truncate">{getTeamName(match.awayId)}</span>
                        {canOpen && <span className="text-vga-cyan text-[8px] ml-1">{isOpen ? '−' : '+'}</span>}
                      </div>
                    </button>
                    {isOpen && <MatchDetails match={match} teams={teams} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-vga-blue p-2 border-2 border-vga-white text-[7px] text-vga-bright-white text-center">
        TOCA UN PARTIDO PARA VER GOLES Y TARJETAS
      </div>
    </div>
  );
};

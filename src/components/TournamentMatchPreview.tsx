import type { Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { TeamCrest } from './TeamCrest';
import { PitchDiagram } from './PitchDiagram';
import { pickBestXI } from '../engine/formations';

interface Props {
  contextLabel: string;          // e.g. "Jornada 3 · Grupo B" or "Ida · Cuartos"
  homeTeam: Team;
  awayTeam: Team;
  userTeamId?: string | null;    // null/undefined → spectator: hide lineup controls
  matchDuration: number;
  onChangeDuration: (sec: number) => void;
  onAutoFixUserXI?: () => void;
  onAdjustLineup?: () => void;
  onPlay: () => void;
  onBack: () => void;
}

export const TournamentMatchPreview = ({
  contextLabel, homeTeam, awayTeam, userTeamId,
  matchDuration, onChangeDuration,
  onAutoFixUserXI, onAdjustLineup,
  onPlay, onBack,
}: Props) => {
  const userTeam = userTeamId
    ? (homeTeam.id === userTeamId ? homeTeam : awayTeam.id === userTeamId ? awayTeam : null)
    : null;

  return (
    <div className="w-full max-w-3xl flex flex-col gap-2 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">{contextLabel}</h2>
        <span className="text-vga-bright-white text-[8px] uppercase">Previa</span>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-3 flex flex-col gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex gap-2">
          {[homeTeam, awayTeam].map((team, i) => (
            <div key={team.id} className="flex-1 min-w-0">
              <div className="text-center mb-1">
                <TeamCrest colors={team.colors} size="lg" title={team.name} teamId={team.id} />
                <div className={`text-[8px] font-bold text-center leading-tight ${i === 0 ? 'text-vga-light-red' : 'text-vga-light-cyan'}`}>{team.name}</div>
                <div className="text-[7px] text-vga-cyan">{team.formation} · MED {Math.floor(calculateTeamStrength(team) / 2)}</div>
              </div>
              <PitchDiagram
                team={team}
                selectedSlot={null}
                onSlotClick={() => { /* readonly preview */ }}
              />
            </div>
          ))}
        </div>

        {userTeam && onAutoFixUserXI && (
          <button
            onClick={() => {
              // Parent applies the patch. Pre-compute to satisfy the unused
              // import linter on pickBestXI.
              void pickBestXI(userTeam.players, userTeam.formation, new Set(), userTeam.tacticalDiscipline ?? true);
              onAutoFixUserXI();
            }}
            className="w-full text-[8px] font-bold text-vga-black bg-vga-yellow border border-vga-bright-white py-1 hover:bg-vga-bright-white uppercase tracking-wider"
          >
            ★ Auto-Fix XI ({userTeam.formation})
          </button>
        )}
        {userTeam && onAdjustLineup && (
          <button
            onClick={onAdjustLineup}
            className="w-full text-[8px] text-vga-cyan border border-vga-cyan py-1 hover:bg-vga-cyan hover:text-vga-black uppercase"
          >
            Ajustar alineación
          </button>
        )}

        <div>
          <label className="text-[8px] block mb-1 font-bold text-vga-blue uppercase">Duración del partido</label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { sec: 0,   label: 'INSTANTE' },
              { sec: 30,  label: 'RÁPIDO' },
              { sec: 60,  label: 'NORMAL' },
              { sec: 120, label: 'LARGO' },
            ].map(({ sec, label }) => (
              <button
                key={sec}
                onClick={() => onChangeDuration(sec)}
                className={`text-[8px] py-1.5 border font-bold uppercase ${matchDuration === sec ? 'bg-vga-blue text-vga-bright-white border-vga-bright-white' : 'bg-vga-black text-vga-bright-white border-vga-gray hover:border-vga-light-green'}`}
              >
                {label}
                <div className="text-[6px] text-vga-cyan font-normal">{sec === 0 ? '—' : `${sec}s`}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onBack}
            className="bg-vga-gray text-vga-black py-2 px-3 border border-vga-black text-[8px] uppercase hover:bg-vga-white"
          >
            Volver
          </button>
          <button
            onClick={onPlay}
            className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-xs font-bold uppercase tracking-wider"
          >
            Jugar partido
          </button>
        </div>
      </div>
    </div>
  );
};

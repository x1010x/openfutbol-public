import { useState } from 'react';
import type { FormationId, Position, Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { ALL_FORMATIONS, FORMATIONS, effectiveMedia, isOOP, liveMed, pickBestXI, reslotLineup } from '../engine/formations';
import { PitchDiagram } from './PitchDiagram';
import { SwapModal } from './SwapModal';
import { moodStateOf, MOOD } from '../engine/playerMood';
import { PlayerName } from './PlayerName';

interface Props {
  team: Team;
  onUpdate: (patch: { lineup: string[]; formation: FormationId }) => void;
  onBack: () => void;
  onToggleDiscipline: () => void;
}

const StaminaBar = ({ value }: { value: number }) => {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  const col = pct >= 60 ? 'bg-vga-light-green' : pct >= 30 ? 'bg-vga-yellow' : 'bg-vga-light-red';
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 h-1.5 bg-vga-black border border-vga-gray">
        <div className={`h-full ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[6px] text-vga-gray font-mono">{pct}</span>
    </div>
  );
};

const getPositionColor = (pos: string) => {
  switch (pos) {
    case 'POR': return 'text-vga-yellow';
    case 'DEF': return 'text-vga-light-cyan';
    case 'MED': return 'text-vga-light-green';
    case 'DEL': return 'text-vga-light-red';
    case 'AML':
    case 'AMR': return 'text-vga-light-magenta';
    default: return 'text-vga-white';
  }
};

export const AlignmentView = ({ team, onUpdate, onBack, onToggleDiscipline }: Props) => {
  const teamMED = Math.floor(calculateTeamStrength(team));
  const slots = FORMATIONS[team.formation];
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const slotOfPlayer = new Map<string, number>();
  team.lineup.forEach((id, idx) => { if (id) slotOfPlayer.set(id, idx); });

  const currentTitulars = team.lineup.filter(Boolean);
  const titularCount = currentTitulars.length;

  const handleFormationChange = (f: FormationId) => {
    if (f === team.formation) return;
    const newLineup = reslotLineup(team, currentTitulars, f);
    onUpdate({ lineup: newLineup, formation: f });
  };

  const handleAutoFix = () => {
    const { lineup } = pickBestXI(team.players, team.formation, new Set(), team.tacticalDiscipline ?? true);
    onUpdate({ lineup, formation: team.formation });
  };

  // Asignación directa a un slot concreto (desde la modal del pitch).
  const assignToSlot = (slotIdx: number, playerId: string | null) => {
    const newLineup: string[] = [];
    for (let i = 0; i < slots.length; i++) newLineup.push(team.lineup[i] ?? '');

    if (playerId === null) {
      newLineup[slotIdx] = '';
    } else {
      const existingSlot = newLineup.indexOf(playerId);
      if (existingSlot !== -1) {
        // Rotacional: el que estaba en slotIdx pasa al hueco que deja el otro
        newLineup[existingSlot] = newLineup[slotIdx];
      }
      newLineup[slotIdx] = playerId;
    }
    while (newLineup.length > 0 && newLineup[newLineup.length - 1] === '') newLineup.pop();
    onUpdate({ lineup: newLineup, formation: team.formation });
    setSelectedSlot(null);
  };

  // Toggle desde la tabla — usa el algoritmo greedy (re-asigna slots).
  const togglePlayer = (playerId: string) => {
    const player = team.players.find(p => p.id === playerId);
    if (!player) return;
    if (player.suspensionMatches > 0) {
      alert(`${player.name} está sancionado y no puede jugar.`);
      return;
    }
    if ((player.injuryWeeksRemaining ?? 0) > 0) {
      alert(`${player.name} está lesionado (${player.injuryWeeksRemaining} semanas).`);
      return;
    }

    const isCurrentlyTitular = slotOfPlayer.has(playerId);
    let newTitulars: string[];
    if (isCurrentlyTitular) {
      newTitulars = currentTitulars.filter(id => id !== playerId);
    } else {
      if (titularCount >= 11) {
        alert('Alineación completa. Quita un titular antes de añadir otro.');
        return;
      }
      newTitulars = [...currentTitulars, playerId];
    }
    const newLineup = reslotLineup(team, newTitulars, team.formation);
    onUpdate({ lineup: newLineup, formation: team.formation });
  };

  const sortedPlayers = [...team.players].sort((a, b) => {
    const ta = slotOfPlayer.has(a.id) ? 0 : 1;
    const tb = slotOfPlayer.has(b.id) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (ta === 0) {
      return (slotOfPlayer.get(a.id)! - slotOfPlayer.get(b.id)!);
    }
    return b.media - a.media;
  });

  const slotModal = selectedSlot !== null ? (() => {
    const slotPos: Position = slots[selectedSlot];
    const currentId = team.lineup[selectedSlot] ?? null;
    const currentPlayer = currentId ? team.players.find(p => p.id === currentId) ?? null : null;
    const candidates = team.players
      .filter(p => p.suspensionMatches === 0 && (p.injuryWeeksRemaining ?? 0) === 0)
      .sort((a, b) => effectiveMedia(b, slotPos) - effectiveMedia(a, slotPos));
    const inLineup = new Set(team.lineup.filter(Boolean));
    return (
      <SwapModal
        slotPos={slotPos}
        currentPlayer={currentPlayer}
        candidates={candidates}
        inLineup={inLineup}
        onSelect={(pid) => assignToSlot(selectedSlot, pid)}
        onClear={currentId ? () => assignToSlot(selectedSlot, null) : undefined}
        onClose={() => setSelectedSlot(null)}
      />
    );
  })() : null;

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex flex-col">
          <h2 className="text-vga-yellow text-[10px] uppercase font-bold">ALINEACIÓN: {team.name}</h2>
          <span className="text-[7px] text-vga-bright-white">ENTRENADOR: {team.manager}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] bg-vga-black text-vga-yellow px-2 border border-vga-white">
            MED: {teamMED}
          </span>
          <span className="text-[10px] bg-vga-black text-vga-light-green px-2 border border-vga-white">
            {titularCount}/11
          </span>
          <button
            onClick={onBack}
            className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red"
          >
            GUARDAR Y SALIR
          </button>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-vga-blue text-[8px] font-bold uppercase mr-1">FORMACIÓN:</span>
          {ALL_FORMATIONS.map(f => (
            <button
              key={f}
              onClick={() => handleFormationChange(f)}
              className={`px-2 py-1 text-[8px] border-2 font-bold ${
                f === team.formation
                  ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
                  : 'bg-vga-blue text-vga-bright-white border-vga-gray hover:bg-vga-light-blue'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={onToggleDiscipline}
            title={team.tacticalDiscipline ? 'Posicional: jugadores en su posición natural. Clic para cambiar.' : 'Libre: elige por MED máxima sin restricción de posición. Clic para cambiar.'}
            className={`ml-auto px-2 py-1 text-[7px] border-2 font-bold ${team.tacticalDiscipline ? 'bg-vga-cyan text-vga-black border-vga-black' : 'bg-vga-magenta text-vga-bright-white border-vga-black'}`}
          >
            {team.tacticalDiscipline ? 'TAC:POS' : 'TAC:LIBRE'}
          </button>
          <button
            onClick={handleAutoFix}
            title="Rellena los 11 slots con el mejor encaje de toda la plantilla"
            className="px-2 py-1 text-[8px] border-2 font-bold bg-vga-green text-vga-bright-white border-vga-black hover:bg-vga-light-green"
          >
            AUTO-FIX 11
          </button>
        </div>
      </div>

      <PitchDiagram
        team={team}
        selectedSlot={selectedSlot}
        onSlotClick={(idx) => setSelectedSlot(idx === selectedSlot ? null : idx)}
      />

      <div className="bg-vga-blue p-2 border-2 border-vga-white text-[7px] text-vga-bright-white text-center">
        CLICA UNA POSICIÓN DEL CAMPO PARA ASIGNAR JUGADOR. EN LA TABLA, CLIC PARA AUTO-COLOCAR EN EL MEJOR HUECO.
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-2">
        <table className="w-full text-[8px] text-left border-collapse">
          <thead>
            <tr className="bg-vga-black text-vga-cyan uppercase">
              <th className="p-1 border border-vga-gray">SLOT</th>
              <th className="p-1 border border-vga-gray">POS</th>
              <th className="p-1 border border-vga-gray">NOMBRE</th>
              <th className="p-1 border border-vga-gray text-center">MED</th>
              <th className="p-1 border border-vga-gray text-center">CAN</th>
              <th className="p-1 border border-vga-gray text-center">ANI</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(player => {
              const slotIdx = slotOfPlayer.get(player.id);
              const isTitular = slotIdx !== undefined;
              const slotPos: Position | null = isTitular ? slots[slotIdx!] : null;
              const oop = isTitular && slotPos ? isOOP(player, slotPos) : false;
              const isSuspended = player.suspensionMatches > 0;
              const isInjured = (player.injuryWeeksRemaining ?? 0) > 0;
              const effMed = isTitular && slotPos ? Math.round(effectiveMedia(player, slotPos)) : player.media;
              const stamina = player.stamina ?? 99;
              const mood = moodStateOf(player, isTitular);
              const moodInfo = MOOD[mood];
              return (
                <tr
                  key={player.id}
                  className={`cursor-pointer hover:bg-vga-blue group ${isTitular ? 'bg-vga-blue/30' : 'bg-vga-black/10'} ${(isSuspended || isInjured) ? 'opacity-50 grayscale' : ''}`}
                  onClick={() => togglePlayer(player.id)}
                >
                  <td className="p-1 border border-vga-gray text-center">
                    {isTitular && slotPos ? (
                      <span className={`font-bold ${getPositionColor(slotPos)}`}>
                        {slotPos}
                        {oop && <span className="ml-0.5 text-vga-red" title="Fuera de posición">!</span>}
                      </span>
                    ) : (
                      <span className={(isSuspended || isInjured) ? 'text-vga-red' : 'text-vga-black opacity-40'}>
                        {(isSuspended || isInjured) ? 'X' : '—'}
                      </span>
                    )}
                  </td>
                  <td className={`p-1 border border-vga-gray font-bold ${getPositionColor(player.position)}`}>
                    <div className="flex items-center gap-1">
                      {player.position}
                      {player.seasonStats.yellowCards > 0 && <div className="w-1 h-2 bg-vga-yellow border-[0.5px] border-black"></div>}
                      {player.seasonStats.redCards > 0 && <div className="w-1 h-2 bg-vga-red border-[0.5px] border-black"></div>}
                    </div>
                  </td>
                  <td className={`p-1 border border-vga-gray ${isTitular ? 'text-vga-bright-white font-bold' : 'text-vga-black'}`}>
                    <PlayerName player={player} />
                    {isSuspended && <span className="ml-1 text-[6px] text-vga-red font-bold">[SAN]</span>}
                    {isInjured && <span className="ml-1 text-[6px] text-vga-light-red font-bold">[LES {player.injuryWeeksRemaining}s]</span>}
                  </td>
                  <td className="p-1 border border-vga-gray text-center font-mono">
                    <div className={oop ? 'text-vga-light-red' : isTitular ? 'text-vga-light-green' : 'text-vga-bright-white'}>
                      {isTitular && slotPos ? effMed : player.media}{oop && <span className="text-[6px] opacity-70"> *</span>}
                    </div>
                    <div className="text-[7px] text-vga-cyan">
                      {liveMed(player, stamina, isTitular && slotPos ? slotPos : undefined)}
                    </div>
                  </td>
                  <td className="p-1 border border-vga-gray">
                    <StaminaBar value={stamina} />
                  </td>
                  <td className={`p-1 border border-vga-gray text-center text-[9px] font-bold ${moodInfo.colorClass}`}>
                    {moodInfo.symbol}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {slotModal}
    </div>
  );
};

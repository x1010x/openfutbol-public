import type { Player, Position } from '../types/game.d.ts';
import { effectiveMedia, isOOP, liveMed } from '../engine/formations';
import { PlayerName } from './PlayerName';

const POS_ORDER: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3, AML: 4, AMR: 5 };

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-yellow', DEF: 'text-vga-light-cyan',
  MED: 'text-vga-light-green', DEL: 'text-vga-light-red',
  AML: 'text-vga-light-magenta', AMR: 'text-vga-light-magenta',
};

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

interface Props {
  slotPos: Position;
  currentPlayer: Player | null;
  candidates: Player[];
  inLineup: Set<string>;
  onSelect: (playerId: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

export const SwapModal = ({ slotPos, currentPlayer, candidates, inLineup, onSelect, onClear, onClose }: Props) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
      <div className="bg-vga-gray border-4 border-vga-yellow p-2 max-w-sm w-full max-h-[90vh] flex flex-col gap-2">
        <div className="bg-vga-yellow text-vga-black text-[10px] p-2 flex justify-between items-center uppercase font-bold">
          <span>
            {currentPlayer
              ? <>SALE: <span className="font-bold">{currentPlayer.name}</span></>
              : <>SLOT <span className={POS_COLOR[slotPos] ?? ''}>{slotPos}</span> — elige jugador</>}
          </span>
          <button
            onClick={onClose}
            className="bg-vga-black text-vga-bright-white px-2 py-0.5 text-[8px] border border-vga-black hover:bg-vga-red font-bold"
          >
            X
          </button>
        </div>

        {onClear && currentPlayer && (
          <button
            onClick={onClear}
            className="w-full bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-1 px-2 text-[8px] uppercase border border-vga-black font-bold"
          >
            VACIAR SLOT
          </button>
        )}

        <div className="flex-1 overflow-y-auto bg-vga-black border border-vga-gray">
          <table className="w-full text-[8px]">
            <thead className="sticky top-0 bg-vga-blue text-vga-bright-white uppercase">
              <tr>
                <th className="p-1 text-left">POS</th>
                <th className="p-1 text-left">NOMBRE</th>
                <th className="p-1 text-center">MED</th>
                <th className="p-1 text-center">LIVE</th>
                <th className="p-1">CAN</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 && (
                <tr><td colSpan={5} className="p-2 text-vga-gray italic text-center">Sin jugadores disponibles</td></tr>
              )}
              {[...candidates]
                .sort((a, b) => {
                  const aTitular = inLineup.has(a.id) ? 1 : 0;
                  const bTitular = inLineup.has(b.id) ? 1 : 0;
                  if (aTitular !== bTitular) return aTitular - bTitular;
                  // Matching slot position comes first
                  const aMatch = a.position === slotPos ? 0 : 1;
                  const bMatch = b.position === slotPos ? 0 : 1;
                  if (aMatch !== bMatch) return aMatch - bMatch;
                  // Among same-match group, sort by LIVE desc
                  const aLive = liveMed(a, a.stamina ?? 99, slotPos);
                  const bLive = liveMed(b, b.stamina ?? 99, slotPos);
                  if (bLive !== aLive) return bLive - aLive;
                  return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
                })
                .map(p => {
                const oop = isOOP(p, slotPos);
                const effMed = Math.round(effectiveMedia(p, slotPos));
                const stam = p.stamina ?? 99;
                const pLiveMed = liveMed(p, stam, slotPos);
                const isCurrent = p.id === currentPlayer?.id;
                const isTitular = !isCurrent && inLineup.has(p.id);
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`cursor-pointer border-b border-vga-gray/30 hover:bg-vga-green/30 ${isCurrent ? 'bg-vga-yellow/20' : ''}`}
                  >
                    <td className={`p-1 font-bold ${POS_COLOR[p.position] ?? 'text-vga-bright-white'}`}>{p.position}</td>
                    <td className="p-1 text-vga-bright-white">
                      <PlayerName player={p} />
                      {isCurrent && <span className="ml-1 text-[6px] text-vga-yellow">(actual)</span>}
                      {isTitular && <span className="ml-1 text-[6px] text-vga-cyan">(titular)</span>}
                    </td>
                    <td className={`p-1 text-center font-mono ${oop ? 'text-vga-light-red' : 'text-vga-light-green'}`}>
                      {effMed}{oop && <span className="text-[6px]"> !</span>}
                    </td>
                    <td className={`p-1 text-center font-mono ${pLiveMed < p.media ? 'text-vga-light-red' : 'text-vga-light-green'}`}>
                      {pLiveMed}
                    </td>
                    <td className="p-1"><StaminaBar value={stam} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

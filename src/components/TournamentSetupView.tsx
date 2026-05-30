import { useMemo, useState } from 'react';
import type { TeamTemplate } from '../data/mockTeams';
import { getPackTemplates } from '../data/packTeamBuilder';
import { usePack } from '../state/PackContext';
import { TeamSelector } from './TeamSelector';

interface Props {
  onConfirm: (name: string, selectedClubIds: string[], userClubId: string) => void;
  onBack: () => void;
}

const ALLOWED_SIZES = [4, 8, 16, 32] as const;
type Size = typeof ALLOWED_SIZES[number];

export const TournamentSetupView = ({ onConfirm, onBack }: Props) => {
  const { pack } = usePack();
  const [size, setSize] = useState<Size>(8);
  const [name, setName] = useState('Copa Custom');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userClubId, setUserClubId] = useState<string | null>(null);

  const templates = useMemo((): TeamTemplate[] => {
    if (!pack) return [];
    return getPackTemplates(pack).map(pt => ({
      id: pt.clubId,
      name: pt.name,
      colors: pt.colors ? [pt.colors.background, pt.colors.foreground] : undefined,
      playerCount: pt.playerCount,
      country: pt.countryCode || 'unknown',
    }));
  }, [pack]);

  const n = selected.size;
  const canConfirm = n === size && !!userClubId && selected.has(userClubId);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (userClubId === id) setUserClubId(null); }
      else if (next.size < size) {
        next.add(id);
        // Default: first team picked is "yours". The user can still reassign.
        if (!userClubId) setUserClubId(id);
      }
      return next;
    });

  const selectedList = templates.filter(t => selected.has(t.id));

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">Crear torneo</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          Volver
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Format + name */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Nombre del torneo</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-vga-black border-2 border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Formato</label>
            <div className="text-vga-yellow text-[10px] uppercase border-2 border-vga-blue bg-vga-black px-2 py-1">
              Copa eliminatoria
            </div>
          </div>
        </div>

        {/* Size selector */}
        <div className="flex flex-col gap-1">
          <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Número de equipos</label>
          <div className="flex gap-2">
            {ALLOWED_SIZES.map(s => (
              <button
                key={s}
                onClick={() => { setSize(s); setSelected(new Set()); setUserClubId(null); }}
                className={`px-3 py-2 text-[10px] uppercase font-bold border-2 ${size === s
                  ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
                  : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
              >
                {s} equipos
              </button>
            ))}
          </div>
          <div className="text-vga-gray text-[8px] uppercase">
            {size === 4 ? 'Semifinales + Final' : size === 8 ? 'Cuartos + Semifinales + Final' : size === 16 ? 'Octavos a Final' : 'Dieciseisavos a Final'}
          </div>
        </div>

        {/* Team picker */}
        <TeamSelector
          templates={templates}
          selected={selected}
          onToggle={toggle}
          maxTeams={size}
        />

        {/* Choose your team */}
        {selectedList.length > 0 && (
          <div className="border-2 border-vga-blue p-2 bg-vga-black">
            <div className="text-vga-cyan text-[8px] uppercase tracking-widest mb-1">Tu equipo en el torneo</div>
            <div className="flex flex-wrap gap-1">
              {selectedList.map(t => {
                const isMine = userClubId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setUserClubId(t.id)}
                    className={`px-2 py-1 text-[9px] uppercase border-2 ${isMine
                      ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}
                  >
                    {isMine ? '★ ' : ''}{t.name}
                  </button>
                );
              })}
            </div>
            <div className="text-vga-gray text-[7px] uppercase mt-1">
              {userClubId
                ? `★ ${selectedList.find(t => t.id === userClubId)?.name} es tu equipo. Pincha otro para cambiarlo.`
                : 'Pincha un equipo para marcarlo como tuyo.'}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t-2 border-vga-blue pt-2">
          <div className="text-[9px] text-vga-bright-white uppercase">
            {n}/{size} elegidos {userClubId ? '· tu equipo seleccionado' : '· elige tu equipo'}
          </div>
          <button
            onClick={() => userClubId && onConfirm(name.trim() || 'Copa', [...selected], userClubId)}
            disabled={!canConfirm}
            className={`px-4 py-2 text-[10px] uppercase font-bold border-2 ${canConfirm
              ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
              : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
          >
            Empezar torneo
          </button>
        </div>
      </div>
    </div>
  );
};

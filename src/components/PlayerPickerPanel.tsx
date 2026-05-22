import { useState } from 'react';
import type { LeagueState } from '../store/leagueStore';
import { getAllDBPlayerEntries, extractDbId } from '../data/mockTeams';
import { PlayerName } from './PlayerName';

interface Props {
  teamId: string;
  year: number;
  league: LeagueState;
  onPick: (dbId: string) => void;
  onBack: () => void;
}

export const PlayerPickerPanel = ({ teamId, year: _year, league, onPick, onBack }: Props) => {
  const [search, setSearch] = useState('');

  const allDB = getAllDBPlayerEntries();

  // Track where each dbId currently lives in the league
  const whereInLeague = new Map<string, string>();
  league.freeAgents.forEach(p => whereInLeague.set(extractDbId(p.id), 'Libre'));
  league.teams.forEach(t => t.players.forEach(p => whereInLeague.set(extractDbId(p.id), t.name)));

  // IDs already on the target team — exclude them
  const targetTeam = league.teams.find(t => t.id === teamId);
  const alreadyOnTeam = new Set(targetTeam?.players.map(p => extractDbId(p.id)) ?? []);

  const q = search.trim().toLowerCase();
  const filtered = allDB
    .filter(p => !alreadyOnTeam.has(p.dbId))
    .filter(p =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q)
    )
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red"
        >
          VOLVER
        </button>
        <span className="text-vga-black text-[8px] font-bold uppercase">
          Añadir a {targetTeam?.name ?? ''}
        </span>
      </div>

      <input
        autoFocus
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar jugador..."
        className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border-2 border-vga-black font-mono w-full"
      />

      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <span className="text-vga-black text-[8px] opacity-60 p-2">Sin resultados.</span>
        )}
        {filtered.map(p => {
          const where = whereInLeague.get(p.dbId);
          return (
            <div
              key={p.dbId}
              className="flex items-center gap-2 bg-vga-bright-white border border-vga-blue px-2 py-1"
            >
              <span className="text-vga-blue text-[8px] w-8 shrink-0">{p.preferredPos}</span>
              <div className="flex flex-col flex-1 min-w-0">
                <PlayerName player={p} useShirt className="text-vga-black text-[8px] font-bold truncate" />
                <PlayerName player={p} className="text-vga-black text-[7px] opacity-60 truncate" />
              </div>
              <span className="text-vga-black text-[7px] w-8 shrink-0">{p.birthYear}</span>
              {where && (
                <span className="text-vga-blue text-[7px] shrink-0 max-w-16 truncate">{where}</span>
              )}
              <button
                onClick={() => onPick(p.dbId)}
                className="text-[7px] bg-vga-green text-vga-bright-white px-2 py-0.5 border border-vga-black shrink-0"
              >
                FICHAR
              </button>
            </div>
          );
        })}
      </div>

      <span className="text-vga-black text-[7px] opacity-50 text-center">
        {filtered.length === 5 ? 'Top 5 — escribe para filtrar' : `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
      </span>
    </div>
  );
};

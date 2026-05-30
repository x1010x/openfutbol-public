import { useMemo, useState } from 'react';
import type { Player, Team } from '../types/game.d.ts';
import { PlayerName } from './PlayerName';

type SortKey = 'pos' | 'name' | 'team' | 'age' | 'apps' | 'minutes' | 'goals' | 'assists' | 'yellows' | 'reds' | 'cs' | 'rating';
type Dir = 'asc' | 'desc';

interface EnrichedPlayer extends Player {
  teamName: string;
  teamId: string;
}

interface Props {
  teams: Team[];
  seasonYear: number;
  onPlayerClick?: (id: string) => void;
}

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-yellow',
  DEF: 'text-vga-light-cyan',
  MED: 'text-vga-light-green',
  AML: 'text-vga-light-magenta',
  AMR: 'text-vga-light-magenta',
  DEL: 'text-vga-light-red',
};

const POS_ORDER: Record<string, number> = { POR: 0, DEF: 1, MED: 2, AML: 3, AMR: 4, DEL: 5 };

const avgRating = (p: Player): number =>
  p.seasonStats.appearances > 0 ? p.seasonStats.ratingSum / p.seasonStats.appearances : 0;

export const SeasonStatsTable = ({ teams, seasonYear, onPlayerClick }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>('minutes');
  const [dir, setDir] = useState<Dir>('desc');
  const [filter, setFilter] = useState<'ALL' | 'POR' | 'DEF' | 'MED' | 'EXT' | 'DEL'>('ALL');
  const [search, setSearch] = useState('');

  const enriched: EnrichedPlayer[] = useMemo(() =>
    teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name, teamId: t.id }))),
    [teams]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter(p => p.seasonStats.appearances > 0)
      .filter(p => {
        if (filter === 'ALL') return true;
        if (filter === 'EXT') return p.position === 'AML' || p.position === 'AMR';
        return p.position === filter;
      })
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q));
  }, [enriched, filter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mult = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'pos':     return ((POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)) * mult;
        case 'name':    return a.name.localeCompare(b.name) * mult;
        case 'team':    return a.teamName.localeCompare(b.teamName) * mult;
        case 'age':     return ((seasonYear - a.birthYear) - (seasonYear - b.birthYear)) * mult;
        case 'apps':    return (a.seasonStats.appearances - b.seasonStats.appearances) * mult;
        case 'minutes': return (a.seasonStats.minutes - b.seasonStats.minutes) * mult;
        case 'goals':   return (a.seasonStats.goals - b.seasonStats.goals) * mult;
        case 'assists': return (a.seasonStats.assists - b.seasonStats.assists) * mult;
        case 'yellows': return (a.seasonStats.yellowCards - b.seasonStats.yellowCards) * mult;
        case 'reds':    return (a.seasonStats.redCards - b.seasonStats.redCards) * mult;
        case 'cs':      return (a.seasonStats.cleanSheets - b.seasonStats.cleanSheets) * mult;
        case 'rating':  return (avgRating(a) - avgRating(b)) * mult;
      }
    });
    return arr;
  }, [filtered, sortKey, dir, seasonYear]);

  const click = (key: SortKey) => {
    if (sortKey === key) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setDir(key === 'name' || key === 'team' || key === 'pos' ? 'asc' : 'desc'); }
  };

  const Th = ({ k, label, w }: { k: SortKey; label: string; w?: string }) => (
    <th
      onClick={() => click(k)}
      className={`text-right px-1 py-1 cursor-pointer select-none hover:text-vga-yellow ${w ?? ''} ${sortKey === k ? 'text-vga-yellow' : 'text-vga-cyan'}`}
    >
      {label}{sortKey === k ? (dir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-1 flex-wrap">
        {(['ALL', 'POR', 'DEF', 'MED', 'EXT', 'DEL'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[8px] uppercase border ${filter === f ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
          >
            {f === 'ALL' ? 'Todos' : f}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="ml-auto bg-vga-black border border-vga-blue text-vga-bright-white text-[9px] px-2 py-1 outline-none focus:border-vga-yellow min-w-[140px]"
        />
        <span className="text-vga-gray text-[8px] uppercase">{sorted.length} jug.</span>
      </div>

      {/* Table */}
      <div className="max-h-[70vh] overflow-auto border border-vga-blue">
        <table className="w-full text-[8px] font-mono">
          <thead className="bg-vga-blue/40 sticky top-0">
            <tr>
              <Th k="pos"     label="POS" />
              <th onClick={() => click('name')} className={`text-left px-1 py-1 cursor-pointer hover:text-vga-yellow ${sortKey === 'name' ? 'text-vga-yellow' : 'text-vga-cyan'}`}>
                JUGADOR{sortKey === 'name' ? (dir === 'desc' ? ' ▼' : ' ▲') : ''}
              </th>
              <th onClick={() => click('team')} className={`text-left px-1 py-1 cursor-pointer hover:text-vga-yellow ${sortKey === 'team' ? 'text-vga-yellow' : 'text-vga-cyan'}`}>
                EQUIPO{sortKey === 'team' ? (dir === 'desc' ? ' ▼' : ' ▲') : ''}
              </th>
              <Th k="age"     label="EDAD" />
              <Th k="apps"    label="PJ" />
              <Th k="minutes" label="MIN" />
              <Th k="goals"   label="G" />
              <Th k="assists" label="A" />
              <Th k="yellows" label="TA" />
              <Th k="reds"    label="TR" />
              <Th k="cs"      label="POR" />
              <Th k="rating"  label="MEDIA" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const avg = avgRating(p);
              const rowBg = i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-blue/10';
              return (
                <tr
                  key={p.id}
                  onClick={onPlayerClick ? () => onPlayerClick(p.id) : undefined}
                  className={`${rowBg} ${onPlayerClick ? 'cursor-pointer hover:bg-vga-blue/30' : ''} border-b border-vga-blue/30`}
                >
                  <td className={`text-right px-1 py-0.5 font-bold ${POS_COLOR[p.position] ?? 'text-vga-bright-white'}`}>{p.position}</td>
                  <td className="text-left px-1 py-0.5 text-vga-bright-white truncate max-w-[140px]"><PlayerName player={p} /></td>
                  <td className="text-left px-1 py-0.5 text-vga-gray uppercase truncate max-w-[120px]">{p.teamName}</td>
                  <td className="text-right px-1 py-0.5 text-vga-gray">{seasonYear - p.birthYear}</td>
                  <td className="text-right px-1 py-0.5 text-vga-bright-white">{p.seasonStats.appearances}</td>
                  <td className="text-right px-1 py-0.5 text-vga-bright-white">{p.seasonStats.minutes}</td>
                  <td className={`text-right px-1 py-0.5 ${p.seasonStats.goals > 0 ? 'text-vga-light-green' : 'text-vga-gray'}`}>{p.seasonStats.goals}</td>
                  <td className={`text-right px-1 py-0.5 ${p.seasonStats.assists > 0 ? 'text-vga-light-cyan' : 'text-vga-gray'}`}>{p.seasonStats.assists}</td>
                  <td className={`text-right px-1 py-0.5 ${p.seasonStats.yellowCards > 0 ? 'text-vga-yellow' : 'text-vga-gray'}`}>{p.seasonStats.yellowCards}</td>
                  <td className={`text-right px-1 py-0.5 ${p.seasonStats.redCards > 0 ? 'text-vga-light-red' : 'text-vga-gray'}`}>{p.seasonStats.redCards}</td>
                  <td className={`text-right px-1 py-0.5 ${p.preferredPos === 'POR' && p.seasonStats.cleanSheets > 0 ? 'text-vga-light-cyan' : 'text-vga-gray'}`}>{p.preferredPos === 'POR' ? p.seasonStats.cleanSheets : '—'}</td>
                  <td className={`text-right px-1 py-0.5 font-bold ${avg >= 7.5 ? 'text-vga-light-green' : avg >= 6.5 ? 'text-vga-yellow' : 'text-vga-gray'}`}>{avg > 0 ? avg.toFixed(2) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

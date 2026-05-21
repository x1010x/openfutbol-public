import { useState, useRef } from 'react';
import type { Team, Player, Position, PlayerStats } from '../types/game.d.ts';
import type { LeagueState } from '../store/leagueStore';
import { TeamCrest } from './TeamCrest';
import { StatBar } from './StatBar';
import { PlayerEditorPanel } from './PlayerEditorPanel';
import { PlayerPickerPanel } from './PlayerPickerPanel';
import { getTeamDefaults, extractDbId, buildPlayerForYear, getAllDBPlayerEntries, buildTeamFromSeason } from '../data/mockTeams';
import { exportTeamPack, exportPlayerPack, loadPackFromFile } from '../data/packLoader';
import { pickBestFormation, computePositionWeightedMedia } from '../engine/formations';

interface Props {
  league: LeagueState;
  onUpdateLeague: (updater: (prev: LeagueState) => LeagueState) => void;
  onBack: () => void;
}

type Tab = 'TEAMS' | 'FREE_AGENTS';
type SubView =
  | { kind: 'LIST' }
  | { kind: 'TEAM_DETAIL'; teamId: string }
  | { kind: 'PLAYER_EDIT'; playerId: string; source: 'team'; teamId: string }
  | { kind: 'PLAYER_EDIT'; playerId: string; source: 'fa' }
  | { kind: 'PLAYER_PICK'; teamId: string }
  | { kind: 'NEW_PLAYER'; targetTeamId?: string }
  | { kind: 'NEW_TEAM' };

const POSITIONS: Position[] = ['POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'];

const defaultStats = (pos: Position): PlayerStats => {
  const b = 70;
  switch (pos) {
    case 'POR': return { speed: 55, dribbling: 40, passing: 55, shooting: 30, defending: b + 5, physical: b, goalkeeping: 80 };
    case 'DEF': return { speed: b - 5, dribbling: b - 10, passing: b - 5, shooting: b - 15, defending: b + 5, physical: b, goalkeeping: 10 };
    case 'MED': return { speed: b - 5, dribbling: b, passing: b + 5, shooting: b - 5, defending: b - 10, physical: b - 5, goalkeeping: 10 };
    case 'AML':
    case 'AMR': return { speed: b + 5, dribbling: b + 5, passing: b, shooting: b - 5, defending: b - 20, physical: b - 5, goalkeeping: 10 };
    case 'DEL': return { speed: b, dribbling: b, passing: b - 5, shooting: b + 5, defending: b - 25, physical: b - 5, goalkeeping: 10 };
  }
};

const avgStats = (s: PlayerStats, pos: Position) =>
  Math.round(computePositionWeightedMedia(s, pos));

const normalizeColors = (c: string[] | undefined): [string, string, string] => {
  const a = c?.[0] ?? '#888888';
  const b = c?.[1] ?? a;
  const d = c?.[2] ?? b;
  return [a, b, d];
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'equipo';

// ---- Team metadata editor ----
const TeamMetaEditor = ({ team, onSave, onBack, onExport, onClone }: {
  team: Team;
  onSave: (patch: Partial<Team>) => void;
  onBack: () => void;
  onExport: () => void;
  onClone: () => void;
}) => {
  const init = normalizeColors(team.colors);
  const [name, setName] = useState(team.name);
  const [manager, setManager] = useState(team.manager);
  const [stadium, setStadium] = useState(team.stadiumName);
  const [capacity, setCapacity] = useState(team.stadiumCapacity);
  const [ticket, setTicket] = useState(team.ticketPrice);
  const [budget, setBudget] = useState(team.budget);
  const [shirtL, setShirtL] = useState(init[0]);
  const [shirtR, setShirtR] = useState(init[1]);
  const [shorts, setShorts] = useState(init[2]);

  const save = () => onSave({
    name: name.trim() || team.name,
    manager,
    stadiumName: stadium,
    stadiumCapacity: capacity,
    ticketPrice: ticket,
    budget,
    colors: [shirtL, shirtR, shorts],
  });

  const reset = () => {
    const d = getTeamDefaults(team.year, team.id);
    if (!d) return;
    const [a, b2, c2] = normalizeColors(d.colors);
    setName(d.name); setShirtL(a); setShirtR(b2); setShorts(c2);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black">VOLVER</button>
        <TeamCrest colors={[shirtL, shirtR, shorts]} size="sm" title={name} />
        <span className="text-vga-black text-[8px] font-bold uppercase flex-1 truncate">{name}</span>
        <button onClick={onClone} className="bg-vga-magenta text-vga-bright-white px-2 py-1 text-[7px] border border-vga-black hover:opacity-80">CLONAR +1</button>
        <button onClick={onExport} className="bg-vga-cyan text-vga-black px-2 py-1 text-[7px] border border-vga-black hover:opacity-80">EXPORTAR</button>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          {([
            { label: 'Nombre', val: name, set: setName as (v: string) => void, max: 32 },
            { label: 'Entrenador', val: manager, set: setManager as (v: string) => void, max: 32 },
            { label: 'Estadio', val: stadium, set: setStadium as (v: string) => void, max: 40 },
          ] as { label: string; val: string; set: (v: string) => void; max: number }[]).map(({ label, val, set, max }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">{label}</label>
              <input value={val} onChange={e => set(e.target.value)} maxLength={max}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Aforo</label>
            <input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} min={1000}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Entrada (€)</label>
            <input type="number" value={ticket} onChange={e => setTicket(Number(e.target.value))} min={1}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Presupuesto (€)</label>
            <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={0}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
          </div>
        </div>
        <div className="border-t border-vga-blue pt-2">
          <span className="text-vga-blue text-[7px] uppercase font-bold block mb-1">Colores del kit</span>
          <div className="flex gap-3">
            {([
              { label: 'Cam. Izq.', val: shirtL, set: setShirtL },
              { label: 'Cam. Dcha.', val: shirtR, set: setShirtR },
              { label: 'Pantalón', val: shorts, set: setShorts },
            ] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
              <label key={label} className="flex flex-col items-center gap-1">
                <span className="text-vga-black text-[7px] uppercase">{label}</span>
                <input type="color" value={val} onChange={e => set(e.target.value)}
                  className="w-10 h-10 border border-vga-black cursor-pointer" />
                <span className="text-[7px] font-mono text-vga-black">{val.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={reset} className="bg-vga-gray border border-vga-black py-2 px-3 text-[9px] font-bold uppercase hover:bg-vga-bright-white">REINICIAR</button>
        <button onClick={save} className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 border-b-4 border-r-4 border-vga-black text-[10px] font-bold uppercase">GUARDAR EQUIPO</button>
      </div>
    </div>
  );
};

// ---- Main editor ----
export const EditorView = ({ league, onUpdateLeague, onBack }: Props) => {
  const [tab, setTab] = useState<Tab>('TEAMS');
  const [sub, setSub] = useState<SubView>({ kind: 'LIST' });
  const [teamSearch, setTeamSearch] = useState('');
  const [faSearch, setFaSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const teamImportRef = useRef<HTMLInputElement>(null);

  const [newPlayerForm, setNewPlayerForm] = useState<{
    name: string; fullName: string; birthYear: number; peakAge: number; pos: Position; stats: PlayerStats;
  }>({ name: '', fullName: '', birthYear: 1975, peakAge: 28, pos: 'DEL', stats: defaultStats('DEL') });

  const [newTeamForm, setNewTeamForm] = useState({
    name: '', manager: '', stadium: 'Estadio Nuevo', capacity: 20000,
    ticket: 10, budget: 10000000,
    shirtL: '#0000aa', shirtR: '#ffffff', shorts: '#0000aa',
  });

  const goList = () => setSub({ kind: 'LIST' });

  const findPlayer = (id: string): Player | undefined => {
    for (const t of league.teams) { const p = t.players.find(p => p.id === id); if (p) return p; }
    return league.freeAgents.find(p => p.id === id);
  };
  const findTeam = (id: string) => league.teams.find(t => t.id === id);

  // ---- Mutators ----
  const updatePlayer = (updated: Player, source: 'team' | 'fa', teamId?: string) => {
    onUpdateLeague(prev => source === 'team' && teamId
      ? { ...prev, teams: prev.teams.map(t => t.id === teamId ? { ...t, players: t.players.map(p => p.id === updated.id ? updated : p) } : t) }
      : { ...prev, freeAgents: prev.freeAgents.map(p => p.id === updated.id ? updated : p) }
    );
  };

  const removeFromTeam = (playerId: string, teamId: string) => {
    onUpdateLeague(prev => {
      const team = prev.teams.find(t => t.id === teamId);
      const player = team?.players.find(p => p.id === playerId);
      if (!team || !player) return prev;
      const newPlayers = team.players.filter(p => p.id !== playerId);
      const { formation, lineup } = pickBestFormation(newPlayers, new Set(), team.tacticalDiscipline);
      const faPlayer = { ...player, id: `FA_${extractDbId(player.id)}` };
      return {
        ...prev,
        freeAgents: [...prev.freeAgents, faPlayer],
        teams: prev.teams.map(t => t.id === teamId ? { ...t, players: newPlayers, lineup, formation } : t),
      };
    });
  };

  const pickPlayer = (dbId: string, teamId: string) => {
    onUpdateLeague(prev => {
      const team = prev.teams.find(t => t.id === teamId);
      if (!team) return prev;

      // Already in league as FA?
      const faMatch = prev.freeAgents.find(p => extractDbId(p.id) === dbId);
      // Already on another team?
      let fromTeam: Team | undefined;
      let fromTeamPlayer: Player | undefined;
      for (const t of prev.teams) {
        const found = t.players.find(p => extractDbId(p.id) === dbId);
        if (found) { fromTeam = t; fromTeamPlayer = found; break; }
      }

      const sourcePlayer = faMatch ?? fromTeamPlayer ?? buildPlayerForYear(dbId, prev.year);
      if (!sourcePlayer) return prev;

      const movedPlayer = { ...sourcePlayer, id: `${teamId}_${dbId}` };
      const newPlayers = [...team.players, movedPlayer];
      const { formation, lineup } = pickBestFormation(newPlayers, new Set(), team.tacticalDiscipline);

      let newFa = faMatch ? prev.freeAgents.filter(p => p.id !== faMatch.id) : prev.freeAgents;
      let newTeams = prev.teams.map(t => {
        if (t.id === teamId) return { ...t, players: newPlayers, lineup, formation };
        if (fromTeam && t.id === fromTeam.id) {
          const rem = t.players.filter(p => p.id !== fromTeamPlayer!.id);
          const { formation: f2, lineup: l2 } = pickBestFormation(rem, new Set(), t.tacticalDiscipline);
          newFa = [...newFa, { ...fromTeamPlayer!, id: `FA_${dbId}` }];
          return { ...t, players: rem, lineup: l2, formation: f2 };
        }
        return t;
      });

      return { ...prev, freeAgents: newFa, teams: newTeams };
    });
    setSub({ kind: 'TEAM_DETAIL', teamId });
  };

  const createPlayer = (targetTeamId?: string) => {
    const id = `custom_${Date.now().toString(36)}`;
    const stats = { ...newPlayerForm.stats };
    const player: Player = {
      id: targetTeamId ? `${targetTeamId}_${id}` : `FA_${id}`,
      name: newPlayerForm.name || 'Nuevo',
      fullName: newPlayerForm.fullName || newPlayerForm.name || 'Nuevo Jugador',
      position: newPlayerForm.pos,
      preferredPos: newPlayerForm.pos,
      allowedPositions: [newPlayerForm.pos],
      number: 99,
      stats,
      media: avgStats(stats, newPlayerForm.pos),
      birthYear: newPlayerForm.birthYear,
      peakAge: newPlayerForm.peakAge,
      seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
      suspensionMatches: 0,
      stamina: 99,
      injuryWeeksRemaining: 0,
    };
    if (targetTeamId) {
      onUpdateLeague(prev => ({
        ...prev,
        teams: prev.teams.map(t => {
          if (t.id !== targetTeamId) return t;
          const newPlayers = [...t.players, player];
          const { formation, lineup } = pickBestFormation(newPlayers, new Set(), t.tacticalDiscipline);
          return { ...t, players: newPlayers, lineup, formation };
        }),
      }));
      setSub({ kind: 'TEAM_DETAIL', teamId: targetTeamId });
    } else {
      onUpdateLeague(prev => ({ ...prev, freeAgents: [...prev.freeAgents, player] }));
      setSub({ kind: 'LIST' });
    }
    setNewPlayerForm({ name: '', fullName: '', birthYear: 1975, peakAge: 28, pos: 'DEL', stats: defaultStats('DEL') });
  };

  const createTeam = () => {
    const id = slugify(newTeamForm.name) || `equipo_${Date.now().toString(36)}`;
    const colors = [newTeamForm.shirtL, newTeamForm.shirtR, newTeamForm.shorts];
    const newTeam: Team = {
      id,
      name: newTeamForm.name || 'Nuevo Equipo',
      colors,
      year: league.year,
      manager: newTeamForm.manager || 'Sin entrenador',
      stadiumName: newTeamForm.stadium,
      stadiumCapacity: newTeamForm.capacity,
      ticketPrice: newTeamForm.ticket,
      budget: newTeamForm.budget,
      players: [],
      lineup: [],
      formation: '4-4-2',
      tacticalDiscipline: true,
    };
    onUpdateLeague(prev => ({
      ...prev,
      teams: [...prev.teams, newTeam],
      stats: { ...prev.stats, [id]: { teamId: id, name: newTeam.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 } },
      finances: { ...prev.finances, [id]: { seasonIncome: 0, seasonSalaries: 0, weeks: [] } },
    }));
    setSub({ kind: 'TEAM_DETAIL', teamId: id });
    setNewTeamForm({ name: '', manager: '', stadium: 'Estadio Nuevo', capacity: 20000, ticket: 10, budget: 10000000, shirtL: '#0000aa', shirtR: '#ffffff', shorts: '#0000aa' });
  };

  const updateTeamMeta = (teamId: string, patch: Partial<Team>) => {
    onUpdateLeague(prev => ({
      ...prev,
      teams: prev.teams.map(t => t.id === teamId ? { ...t, ...patch } : t),
      stats: patch.name ? { ...prev.stats, [teamId]: { ...prev.stats[teamId], name: patch.name! } } : prev.stats,
    }));
  };

  const exportTeam = (team: Team) => {
    exportTeamPack({
      id: team.id, name: team.name, country: 'unknown',
      seasons: [{ year: team.year, colors: team.colors, manager: team.manager, stadiumName: team.stadiumName, stadiumCapacity: team.stadiumCapacity, ticketPrice: team.ticketPrice, budget: team.budget, players: team.players.map(p => ({ player_id: extractDbId(p.id), number: p.number })) }],
    }, [], `${team.name} ${team.year}`).catch(() => {});
  };

  const cloneTeamNextYear = (team: Team) => {
    exportTeamPack({
      id: team.id, name: team.name, country: 'unknown',
      seasons: [{ year: team.year + 1, colors: team.colors, manager: team.manager, stadiumName: team.stadiumName, stadiumCapacity: team.stadiumCapacity, ticketPrice: team.ticketPrice, budget: team.budget, players: team.players.map(p => ({ player_id: extractDbId(p.id), number: p.number })) }],
    }, [], `${team.name} ${team.year + 1}`).catch(() => {});
  };

  const handleImportPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const pack = await loadPackFromFile(file);
    if (!pack) { setImportError('Archivo no válido.'); return; }
    const rawPlayers =
      pack.meta.type === 'player_pack'
        ? (pack as import('../types/game.d.ts').PlayerPack).players
        : (pack as import('../types/game.d.ts').TeamPack).players ?? [];
    if (rawPlayers.length === 0) { setImportError('No se encontraron jugadores en el pack.'); return; }
    const newFAs = rawPlayers
      .map(p => buildPlayerForYear(p.id, league.year) ?? {
        id: `FA_${p.id}`,
        name: p.shirt_name,
        fullName: p.full_name,
        position: p.preferred_pos,
        preferredPos: p.preferred_pos,
        allowedPositions: [p.preferred_pos],
        number: 0,
        stats: Object.values(p.positions)[0] ?? defaultStats(p.preferred_pos),
        media: 70,
        birthYear: p.birth_year,
        peakAge: p.peak_age,
        seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
        suspensionMatches: 0, stamina: 99, injuryWeeksRemaining: 0,
      } as Player);
    onUpdateLeague(prev => ({ ...prev, freeAgents: [...prev.freeAgents, ...newFAs] }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImportTeamPack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const pack = await loadPackFromFile(file);
    if (!pack) { setImportError('Archivo no válido.'); return; }
    if (pack.meta.type === 'player_pack') { setImportError('Este pack no contiene equipos.'); return; }
    const tp = pack as import('../types/game.d.ts').TeamPack;
    const newTeams: Team[] = tp.teams.flatMap(rt => {
      const season = rt.seasons.find(s => s.year === league.year) ?? rt.seasons[0];
      if (!season) return [];
      try {
        return [buildTeamFromSeason({ id: rt.id, name: rt.name, ...season })];
      } catch {
        return [];
      }
    });
    const rawPlayers = tp.players ?? [];
    const newFAs = rawPlayers
      .map(p => buildPlayerForYear(p.id, league.year) ?? {
        id: `FA_${p.id}`,
        name: p.shirt_name,
        fullName: p.full_name,
        position: p.preferred_pos,
        preferredPos: p.preferred_pos,
        allowedPositions: [p.preferred_pos],
        number: 0,
        stats: Object.values(p.positions)[0] ?? defaultStats(p.preferred_pos),
        media: 70,
        birthYear: p.birth_year,
        peakAge: p.peak_age,
        seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, appearances: 0, minutes: 0, ratingSum: 0, cleanSheets: 0, goalsAgainst: 0 },
        suspensionMatches: 0, stamina: 99, injuryWeeksRemaining: 0,
      } as Player);
    onUpdateLeague(prev => {
      const existingIds = new Set(prev.teams.map(t => t.id));
      const teams = [...prev.teams, ...newTeams.filter(t => !existingIds.has(t.id))];
      const stats = { ...prev.stats };
      const finances = { ...prev.finances };
      for (const t of newTeams) {
        if (!existingIds.has(t.id)) {
          stats[t.id] = { teamId: t.id, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
          finances[t.id] = { seasonIncome: 0, seasonSalaries: 0, weeks: [] };
        }
      }
      return { ...prev, teams, stats, finances, freeAgents: [...prev.freeAgents, ...newFAs] };
    });
    if (teamImportRef.current) teamImportRef.current.value = '';
  };

  // ---- Sub-view renders ----

  if (sub.kind === 'PLAYER_EDIT') {
    const player = findPlayer(sub.playerId);
    if (!player) { goList(); return null; }
    const back = sub.source === 'team' ? { kind: 'TEAM_DETAIL' as const, teamId: sub.teamId } : { kind: 'LIST' as const };
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
        <div className="bg-vga-blue p-2 border-2 border-vga-white vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">EDITOR — JUGADOR</h2>
        </div>
        <PlayerEditorPanel
          player={player}
          onSave={updated => { updatePlayer(updated, sub.source, sub.source === 'team' ? sub.teamId : undefined); setSub(back); }}
          onBack={() => setSub(back)}
        />
      </div>
    );
  }

  if (sub.kind === 'PLAYER_PICK') {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
        <div className="bg-vga-blue p-2 border-2 border-vga-white vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">AÑADIR JUGADOR</h2>
        </div>
        <div className="bg-vga-gray border-2 border-vga-blue p-3">
          <PlayerPickerPanel
            teamId={sub.teamId}
            year={league.year}
            league={league}
            onPick={dbId => pickPlayer(dbId, sub.teamId)}
            onBack={() => setSub({ kind: 'TEAM_DETAIL', teamId: sub.teamId })}
          />
        </div>
      </div>
    );
  }

  if (sub.kind === 'TEAM_DETAIL') {
    const team = findTeam(sub.teamId);
    if (!team) { goList(); return null; }
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
        <div className="bg-vga-blue p-2 border-2 border-vga-white vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">EDITOR — {team.name.toUpperCase()}</h2>
        </div>
        <TeamMetaEditor
          team={team}
          onSave={patch => updateTeamMeta(sub.teamId, patch)}
          onBack={goList}
          onExport={() => exportTeam(team)}
          onClone={() => cloneTeamNextYear(team)}
        />
        <div className="bg-vga-gray border-2 border-vga-blue p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-vga-blue text-[8px] font-bold uppercase">Plantilla ({team.players.length})</span>
            <div className="flex gap-2">
              <button onClick={() => setSub({ kind: 'NEW_PLAYER', targetTeamId: sub.teamId })}
                className="bg-vga-blue text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black hover:opacity-80">NUEVO</button>
              <button onClick={() => setSub({ kind: 'PLAYER_PICK', teamId: sub.teamId })}
                className="bg-vga-green text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black hover:opacity-80">AÑADIR</button>
            </div>
          </div>
          {team.players.length === 0 && (
            <span className="text-vga-black text-[8px] opacity-60">Sin jugadores — usa AÑADIR o NUEVO.</span>
          )}
          {team.players.map(p => {
            const dbId = extractDbId(p.id);
            const sel = exportSelected.has(dbId);
            return (
              <div key={p.id} className="flex items-center gap-2 border border-vga-blue bg-vga-bright-white px-2 py-1">
                <input type="checkbox" checked={sel} onChange={() => setExportSelected(prev => { const n = new Set(prev); sel ? n.delete(dbId) : n.add(dbId); return n; })}
                  className="w-3 h-3 shrink-0" />
                <span className="text-vga-blue text-[8px] w-8">{p.preferredPos}</span>
                <span className="text-vga-black text-[8px] flex-1 font-bold">{p.name}</span>
                <StatBar label="" value={p.media} size="sm" segments={8} />
                <span className="text-vga-black text-[8px] w-5 text-right">{p.media}</span>
                <button onClick={() => setSub({ kind: 'PLAYER_EDIT', playerId: p.id, source: 'team', teamId: sub.teamId })}
                  className="text-[7px] bg-vga-blue text-vga-bright-white px-1 py-0.5 border border-vga-black">EDITAR</button>
                <button onClick={() => removeFromTeam(p.id, sub.teamId)}
                  className="text-[7px] bg-vga-red text-vga-bright-white px-1 py-0.5 border border-vga-black">QUITAR</button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => {
            const allRaw = team.players.map(p => ({ id: extractDbId(p.id), full_name: p.fullName, shirt_name: p.name, birth_year: p.birthYear, peak_age: p.peakAge, preferred_pos: p.preferredPos, positions: { [p.preferredPos]: p.stats } }));
            const toExport = exportSelected.size > 0 ? allRaw.filter(p => exportSelected.has(p.id)) : allRaw;
            exportPlayerPack(toExport, `${team.name} ${team.year} — Jugadores`).catch(() => {});
          }}
          className="bg-vga-cyan hover:opacity-80 text-vga-black border border-vga-black py-1 text-[8px] font-bold uppercase"
        >
          EXPORTAR PACK JUGADORES{exportSelected.size > 0 ? ` (${exportSelected.size} sel.)` : ''}
        </button>
      </div>
    );
  }

  if (sub.kind === 'NEW_PLAYER') {
    const { targetTeamId } = sub;
    const f = newPlayerForm;
    const STAT_KEYS: (keyof PlayerStats)[] = ['speed', 'dribbling', 'passing', 'shooting', 'defending', 'physical', 'goalkeeping'];
    const LABELS: Record<string, string> = { speed: 'VEL', dribbling: 'REG', passing: 'PAS', shooting: 'DIS', defending: 'DEF', physical: 'FIS', goalkeeping: 'POR' };
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
        <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">NUEVO JUGADOR</h2>
          <button onClick={() => setSub(targetTeamId ? { kind: 'TEAM_DETAIL', teamId: targetTeamId } : { kind: 'LIST' })}
            className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black">VOLVER</button>
        </div>
        <div className="bg-vga-gray border-2 border-vga-blue p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Dorsal nombre</label>
              <input value={f.name} onChange={e => setNewPlayerForm(p => ({ ...p, name: e.target.value }))} maxLength={16} placeholder="ej. RAÚL"
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Posición</label>
              <select value={f.pos} onChange={e => { const pos = e.target.value as Position; setNewPlayerForm(p => ({ ...p, pos, stats: defaultStats(pos) })); }}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono">
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Nombre completo</label>
              <input value={f.fullName} onChange={e => setNewPlayerForm(p => ({ ...p, fullName: e.target.value }))} maxLength={40}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex flex-col gap-1">
                <label className="text-vga-blue text-[7px] uppercase font-bold">Año nac.</label>
                <input type="number" value={f.birthYear} onChange={e => setNewPlayerForm(p => ({ ...p, birthYear: Number(e.target.value) }))} min={1940} max={2010}
                  className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-vga-blue text-[7px] uppercase font-bold">Peak</label>
                <input type="number" value={f.peakAge} onChange={e => setNewPlayerForm(p => ({ ...p, peakAge: Number(e.target.value) }))} min={20} max={40}
                  className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
              </div>
            </div>
          </div>
          <div className="border-t border-vga-blue pt-2 flex flex-col gap-1.5">
            <span className="text-vga-blue text-[7px] uppercase font-bold">Estadísticas</span>
            {STAT_KEYS.map(key => {
              const val = f.stats[key];
              const pct = (val / 99) * 100;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-vga-cyan text-[8px] w-6 shrink-0">{LABELS[key]}</span>
                  <input type="range" min={1} max={99} value={val}
                    onChange={e => setNewPlayerForm(p => ({ ...p, stats: { ...p.stats, [key]: Number(e.target.value) } }))}
                    className="flex-1 h-2 appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #008800 ${pct}%, #555555 ${pct}%)` }} />
                  <span className="text-[9px] w-5 text-right font-mono font-bold text-vga-black">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => createPlayer()} className="flex-1 bg-vga-blue hover:opacity-80 text-vga-bright-white py-2 border-b-4 border-r-4 border-vga-black text-[10px] font-bold uppercase">CREAR AGENTE LIBRE</button>
          {targetTeamId && (
            <button onClick={() => createPlayer(targetTeamId)} className="flex-1 bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 border-b-4 border-r-4 border-vga-black text-[10px] font-bold uppercase">CREAR EN EQUIPO</button>
          )}
        </div>
      </div>
    );
  }

  if (sub.kind === 'NEW_TEAM') {
    const f = newTeamForm;
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
        <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">NUEVO EQUIPO</h2>
          <button onClick={goList} className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black">VOLVER</button>
        </div>
        <div className="bg-vga-gray border-2 border-vga-blue p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Nombre', key: 'name', max: 32 },
              { label: 'Entrenador', key: 'manager', max: 32 },
              { label: 'Estadio', key: 'stadium', max: 40 },
            ] as { label: string; key: keyof typeof f; max: number }[]).map(({ label, key, max }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-vga-blue text-[7px] uppercase font-bold">{label}</label>
                <input value={String(f[key])} onChange={e => setNewTeamForm(p => ({ ...p, [key]: e.target.value }))} maxLength={max}
                  className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Aforo</label>
              <input type="number" value={f.capacity} onChange={e => setNewTeamForm(p => ({ ...p, capacity: Number(e.target.value) }))} min={1000}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Entrada (€)</label>
              <input type="number" value={f.ticket} onChange={e => setNewTeamForm(p => ({ ...p, ticket: Number(e.target.value) }))} min={1}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Presupuesto (€)</label>
              <input type="number" value={f.budget} onChange={e => setNewTeamForm(p => ({ ...p, budget: Number(e.target.value) }))} min={0}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono" />
            </div>
          </div>
          <div className="border-t border-vga-blue pt-2">
            <span className="text-vga-blue text-[7px] uppercase font-bold block mb-1">Colores del kit</span>
            <div className="flex gap-3">
              {([
                { label: 'Cam. Izq.', key: 'shirtL' },
                { label: 'Cam. Dcha.', key: 'shirtR' },
                { label: 'Pantalón', key: 'shorts' },
              ] as { label: string; key: keyof typeof f }[]).map(({ label, key }) => (
                <label key={key} className="flex flex-col items-center gap-1">
                  <span className="text-vga-black text-[7px] uppercase">{label}</span>
                  <input type="color" value={String(f[key])} onChange={e => setNewTeamForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-10 h-10 border border-vga-black cursor-pointer" />
                  <span className="text-[7px] font-mono">{String(f[key]).toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <TeamCrest colors={[f.shirtL, f.shirtR, f.shorts]} size="sm" title={f.name} />
            <span className="text-vga-black text-[8px]">Vista previa — {f.name || 'Nuevo Equipo'}</span>
          </div>
        </div>
        <button onClick={createTeam}
          className="bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 border-b-4 border-r-4 border-vga-black text-[10px] font-bold uppercase">
          CREAR EQUIPO
        </button>
      </div>
    );
  }

  // ---- LIST view ----
  const filteredTeams = league.teams
    .filter(t => !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // FA tab: show all DB players (unrostered) + custom FAs in league
  const allDB = getAllDBPlayerEntries();
  const rosteredDbIds = new Set(league.teams.flatMap(t => t.players.map(p => extractDbId(p.id))));
  const customFAs = league.freeAgents.filter(p => extractDbId(p.id).startsWith('custom_'));
  const unrosteredDB = allDB.filter(p => !rosteredDbIds.has(p.dbId));

  type FaListEntry =
    | { kind: 'league'; player: Player }
    | { kind: 'db'; dbId: string; name: string; fullName: string; preferredPos: string; birthYear: number };

  const q = faSearch.trim().toLowerCase();
  const allFaEntries: FaListEntry[] = [
    ...customFAs.map(p => ({ kind: 'league' as const, player: p })),
    ...unrosteredDB.map(p => ({ kind: 'db' as const, dbId: p.dbId, name: p.name, fullName: p.fullName, preferredPos: p.preferredPos, birthYear: p.birthYear })),
  ];
  const filteredFAEntries = allFaEntries
    .filter(e => {
      if (!q) return true;
      const name = e.kind === 'league' ? e.player.name : e.name;
      const full = e.kind === 'league' ? e.player.fullName : e.fullName;
      return name.toLowerCase().includes(q) || full.toLowerCase().includes(q);
    })
    .slice(0, 5);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-200">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">EDITOR</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">SALIR EDITOR</button>
      </div>

      <div className="flex border-2 border-vga-blue">
        {(['TEAMS', 'FREE_AGENTS'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[9px] font-bold uppercase border-r last:border-r-0 border-vga-blue ${tab === t ? 'bg-vga-blue text-vga-yellow' : 'bg-vga-gray text-vga-black hover:bg-vga-bright-white'}`}>
            {t === 'TEAMS' ? `EQUIPOS (${league.teams.length})` : `JUGADORES`}
          </button>
        ))}
      </div>

      {tab === 'TEAMS' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Buscar equipo..."
              className="flex-1 bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border-2 border-vga-black font-mono" />
            <button onClick={() => setSub({ kind: 'NEW_TEAM' })}
              className="bg-vga-green text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black font-bold uppercase hover:opacity-80">+ NUEVO</button>
            <button onClick={() => teamImportRef.current?.click()}
              className="bg-vga-cyan text-vga-black px-2 py-1 text-[8px] border border-vga-black font-bold uppercase hover:opacity-80">IMPORTAR</button>
            <input ref={teamImportRef} type="file" accept=".ofb,.json" onChange={handleImportTeamPack} className="hidden" />
          </div>
          <div className="flex flex-col gap-1 max-h-[480px] overflow-y-auto pr-1">
            {filteredTeams.map(team => (
              <button key={team.id} onClick={() => setSub({ kind: 'TEAM_DETAIL', teamId: team.id })}
                className="flex items-center gap-3 bg-vga-gray border-2 border-vga-blue px-3 py-2 hover:bg-vga-bright-white text-left shrink-0">
                <TeamCrest colors={team.colors ?? ['#888', '#888', '#888']} size="sm" title={team.name} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-vga-black text-[9px] font-bold uppercase truncate">{team.name}</span>
                  <span className="text-vga-blue text-[7px]">{team.players.length} jugadores · {team.manager}</span>
                </div>
                <span className="text-vga-blue text-[8px]">{'>'}</span>
              </button>
            ))}
          </div>
          <span className="text-vga-black text-[7px] opacity-50 text-center">
            {filteredTeams.length} de {league.teams.length} equipos
          </span>
        </div>
      )}

      {tab === 'FREE_AGENTS' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={faSearch} onChange={e => setFaSearch(e.target.value)} placeholder="Buscar jugador..."
              className="flex-1 bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border-2 border-vga-black font-mono" />
            <button onClick={() => setSub({ kind: 'NEW_PLAYER' })}
              className="bg-vga-blue text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black font-bold uppercase hover:opacity-80">+ NUEVO</button>
            <button onClick={() => fileRef.current?.click()}
              className="bg-vga-cyan text-vga-black px-2 py-1 text-[8px] border border-vga-black font-bold uppercase hover:opacity-80">IMPORTAR</button>
            <input ref={fileRef} type="file" accept=".ofb,.json" onChange={handleImportPack} className="hidden" />
          </div>
          {importError && <span className="text-vga-red text-[8px]">{importError}</span>}
          {filteredFAEntries.length === 0 && (
            <span className="text-vga-black text-[8px] opacity-60 p-2">
              {faSearch ? 'Sin resultados.' : 'No hay jugadores disponibles.'}
            </span>
          )}
          {filteredFAEntries.map(entry => {
            if (entry.kind === 'league') {
              const p = entry.player;
              const dbId = extractDbId(p.id);
              const sel = exportSelected.has(dbId);
              return (
                <div key={p.id} className="flex items-center gap-2 bg-vga-gray border border-vga-blue px-2 py-1">
                  <input type="checkbox" checked={sel} onChange={() => setExportSelected(prev => { const n = new Set(prev); sel ? n.delete(dbId) : n.add(dbId); return n; })}
                    className="w-3 h-3 shrink-0" />
                  <span className="text-vga-blue text-[8px] w-8">{p.preferredPos}</span>
                  <span className="text-vga-black text-[8px] flex-1 font-bold">{p.name}</span>
                  <span className="text-vga-black text-[8px] w-5 text-right">{p.media}</span>
                  <button onClick={() => setSub({ kind: 'PLAYER_EDIT', playerId: p.id, source: 'fa' })}
                    className="text-[7px] bg-vga-blue text-vga-bright-white px-1 py-0.5 border border-vga-black">EDITAR</button>
                </div>
              );
            } else {
              const sel = exportSelected.has(entry.dbId);
              return (
                <div key={entry.dbId} className="flex items-center gap-2 bg-vga-bright-white border border-vga-black px-2 py-1">
                  <input type="checkbox" checked={sel} onChange={() => setExportSelected(prev => { const n = new Set(prev); sel ? n.delete(entry.dbId) : n.add(entry.dbId); return n; })}
                    className="w-3 h-3 shrink-0" />
                  <span className="text-vga-blue text-[8px] w-8">{entry.preferredPos}</span>
                  <span className="text-vga-black text-[8px] flex-1 font-bold">{entry.name}</span>
                  <button onClick={() => {
                    const p = buildPlayerForYear(entry.dbId, league.year);
                    if (!p) return;
                    onUpdateLeague(prev => ({ ...prev, freeAgents: [...prev.freeAgents, p] }));
                    setSub({ kind: 'PLAYER_EDIT', playerId: p.id, source: 'fa' });
                  }}
                    className="text-[7px] bg-vga-blue text-vga-bright-white px-1 py-0.5 border border-vga-black">EDITAR</button>
                </div>
              );
            }
          })}
          <span className="text-vga-black text-[7px] opacity-50 text-center">
            {filteredFAEntries.length === 5 ? 'Top 5 — escribe para filtrar' : `${filteredFAEntries.length} resultado${filteredFAEntries.length !== 1 ? 's' : ''}`}
          </span>
          {(customFAs.length > 0 || exportSelected.size > 0) && (
            <button
              onClick={() => {
                const sourceList = exportSelected.size > 0
                  ? league.freeAgents.filter(p => exportSelected.has(extractDbId(p.id)))
                  : league.freeAgents;
                exportPlayerPack(
                  sourceList.map(p => ({ id: extractDbId(p.id), full_name: p.fullName, shirt_name: p.name, birth_year: p.birthYear, peak_age: p.peakAge, preferred_pos: p.preferredPos, positions: { [p.preferredPos]: p.stats } })),
                  'Agentes Libres',
                ).catch(() => {});
              }}
              className="bg-vga-cyan hover:opacity-80 text-vga-black border border-vga-black py-1 text-[8px] font-bold uppercase"
            >
              EXPORTAR PACK JUGADORES{exportSelected.size > 0 ? ` (${exportSelected.size} sel.)` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

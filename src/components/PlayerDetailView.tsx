import type { Player } from '../types/game.d.ts';
import type { PlayerSeasonRecord } from '../store/leagueStore';
import { formatEuros, computePrice, playerAge } from '../data/economy';
import { StatBar } from './StatBar';
import { StatRadar } from './StatRadar';
import { PlayerPhoto } from './PlayerPhoto';
import { PlayerName } from './PlayerName';

interface Props {
  player: Player;
  teamName: string | null; // null if free agent
  history: PlayerSeasonRecord[];
  seasonYear: number;
  onBack: () => void;
}

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-light-cyan',
  DEF: 'text-vga-light-green',
  MED: 'text-vga-yellow',
  AML: 'text-vga-light-magenta',
  AMR: 'text-vga-light-magenta',
  DEL: 'text-vga-light-red',
};

const STAT_LABELS: { key: keyof Player['stats']; label: string }[] = [
  { key: 'speed', label: 'VEL' },
  { key: 'dribbling', label: 'REG' },
  { key: 'passing', label: 'PAS' },
  { key: 'shooting', label: 'TIR' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'FIS' },
  { key: 'goalkeeping', label: 'POR' },
];

const ageFactor = (a: number, peakAge: number): number => {
  const f = 1 - Math.abs(a - peakAge) * 0.02;
  return Math.max(0.7, Math.min(1.0, f));
};

const mediaAtAge = (currentMedia: number, currentAge: number, peakAge: number, targetAge: number): number => {
  const cur = ageFactor(currentAge, peakAge);
  const tgt = ageFactor(targetAge, peakAge);
  if (cur === 0) return currentMedia;
  return Math.round(currentMedia * (tgt / cur));
};

export const PlayerDetailView = ({ player, teamName, history, seasonYear, onBack }: Props) => {
  const age = playerAge(player, seasonYear);
  const price = computePrice(player, seasonYear);
  const sortedHistory = [...history].sort((a, b) => a.year - b.year);
  const totalGoals = sortedHistory.reduce((s, r) => s + r.goals, 0) + player.seasonStats.goals;
  const totalAssists = sortedHistory.reduce((s, r) => s + r.assists, 0) + player.seasonStats.assists;
  const totalSeasons = sortedHistory.length + 1;


  return (
    <div className="w-full max-w-3xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold truncate">FICHA DE JUGADOR</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red shrink-0">
          VOLVER
        </button>
      </div>

      <div className="bg-vga-blue border-4 border-vga-bright-white p-3 text-vga-bright-white vga-panel">
        <div className="flex items-baseline gap-3 border-b border-vga-cyan pb-2 mb-3">
          <span className={`text-[16px] font-bold ${POS_COLOR[player.position] ?? 'text-vga-yellow'}`}>{player.position}</span>
          <PlayerName player={player} useShirt className="text-[18px] font-bold truncate" />
          <span className="text-[10px] text-vga-cyan">#{player.number}</span>
        </div>
        <div className="text-[8px] text-vga-cyan mb-3 truncate">{player.fullName}</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[8px]">
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">Equipo</div>
            <div className="text-vga-bright-white text-[10px] truncate">{teamName ?? 'LIBRE'}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">Edad</div>
            <div className="text-vga-bright-white text-[10px]">{age} años</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">Pico</div>
            <div className="text-vga-bright-white text-[10px]">{player.peakAge} años</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-vga-cyan text-[7px] uppercase">Valor</div>
            <div className="text-vga-light-green text-[10px]">{formatEuros(price)}</div>
          </div>
        </div>

        <div className="flex gap-3 items-stretch flex-wrap">
          <div className="flex flex-col items-center justify-center bg-vga-black vga-panel-inset px-3 py-2 min-w-[80px]">
            <PlayerPhoto playerId={player.id} size="lg" className="mb-1" />
            <span className="text-[8px] text-vga-cyan">MEDIA</span>
            <span className="text-3xl text-vga-light-green leading-none">{player.media}</span>
          </div>
          <div className="flex-1 flex flex-col gap-1 justify-center min-w-[180px]">
            {STAT_LABELS.map(s => (
              <StatBar key={s.key} label={s.label} value={player.stats[s.key]} />
            ))}
          </div>
          <div className="bg-vga-black vga-panel-inset p-2 flex items-center justify-center">
            <StatRadar stats={player.stats} size={140} />
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-2">
        <h3 className="text-vga-blue text-[10px] font-bold mb-2 uppercase border-b border-vga-blue pb-1">
          Temporada actual {seasonYear}/{(seasonYear + 1).toString().slice(-2)}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] text-center">
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Part.</div>
            <div className="text-vga-bright-white font-bold">{player.seasonStats.appearances}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Min.</div>
            <div className="text-vga-bright-white font-bold">{player.seasonStats.minutes}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Goles</div>
            <div className="text-vga-light-green font-bold">{player.seasonStats.goals}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Asist.</div>
            <div className="text-vga-light-cyan font-bold">{player.seasonStats.assists}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Amar.</div>
            <div className="text-vga-yellow font-bold">{player.seasonStats.yellowCards}</div>
          </div>
          <div className="bg-vga-black border border-vga-gray p-2">
            <div className="text-[7px] text-vga-cyan uppercase">Rojas</div>
            <div className="text-vga-light-red font-bold">{player.seasonStats.redCards}</div>
          </div>
        </div>
      </div>

      <div className="bg-vga-gray border-2 border-vga-magenta p-2">
        <h3 className="text-vga-magenta text-[10px] font-bold mb-2 uppercase border-b border-vga-magenta pb-1">
          Trayectoria · {totalSeasons} temporada{totalSeasons === 1 ? '' : 's'} · {totalGoals}G · {totalAssists}A
        </h3>
        {sortedHistory.length === 0 ? (
          <div className="text-[8px] text-vga-black text-center p-2">
            Sin temporadas anteriores registradas. El historial se guarda al avanzar de temporada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[8px]">
              <thead>
                <tr className="text-vga-blue text-left border-b border-vga-blue">
                  <th className="px-1 py-1">AÑO</th>
                  <th className="px-1 py-1">EQUIPO</th>
                  <th className="px-1 py-1 text-center">POS</th>
                  <th className="px-1 py-1 text-center">EDAD</th>
                  <th className="px-1 py-1 text-center">MED</th>
                  <th className="px-1 py-1 text-right">G</th>
                  <th className="px-1 py-1 text-right">A</th>
                  <th className="px-1 py-1 text-right">TA</th>
                  <th className="px-1 py-1 text-right">TR</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((r, i) => {
                  const medAtYear = mediaAtAge(player.media, age, player.peakAge, r.age);
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-vga-black' : 'bg-vga-gray'}>
                      <td className={`px-1 py-1 ${i % 2 === 0 ? 'text-vga-yellow' : 'text-vga-blue'}`}>{r.year}</td>
                      <td className={`px-1 py-1 truncate ${i % 2 === 0 ? 'text-vga-bright-white' : 'text-vga-black'}`}>{r.teamName}</td>
                      <td className={`px-1 py-1 text-center ${POS_COLOR[r.position] ?? 'text-vga-yellow'}`}>{r.position}</td>
                      <td className={`px-1 py-1 text-center ${i % 2 === 0 ? 'text-vga-bright-white' : 'text-vga-black'}`}>{r.age}</td>
                      <td className={`px-1 py-1 text-center font-bold ${i % 2 === 0 ? 'text-vga-light-green' : 'text-vga-blue'}`}>{medAtYear}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-green' : 'text-vga-blue'}`}>{r.goals}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-cyan' : 'text-vga-blue'}`}>{r.assists}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-yellow' : 'text-vga-blue'}`}>{r.yellowCards}</td>
                      <td className={`px-1 py-1 text-right ${i % 2 === 0 ? 'text-vga-light-red' : 'text-vga-blue'}`}>{r.redCards}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

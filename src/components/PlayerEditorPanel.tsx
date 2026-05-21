import { useState } from 'react';
import type { Player, PlayerStats, Position } from '../types/game.d.ts';
import { computePositionWeightedMedia } from '../engine/formations';

interface Props {
  player: Player;
  onSave: (updated: Player) => void;
  onBack: () => void;
}

const POSITIONS: Position[] = ['POR', 'DEF', 'MED', 'AML', 'AMR', 'DEL'];
const STAT_KEYS: (keyof PlayerStats)[] = ['speed', 'dribbling', 'passing', 'shooting', 'defending', 'physical', 'goalkeeping'];
const STAT_LABELS: Record<keyof PlayerStats, string> = {
  speed: 'VEL', dribbling: 'REG', passing: 'PAS', shooting: 'DIS', defending: 'DEF', physical: 'FIS', goalkeeping: 'POR'
};

const calculateMedia = (s: PlayerStats, pos: Position) => 
  Math.round(computePositionWeightedMedia(s, pos));

const barColor = (v: number) => {
  if (v >= 80) return 'bg-vga-light-green';
  if (v >= 60) return 'bg-vga-yellow';
  if (v >= 40) return 'bg-vga-brown';
  return 'bg-vga-light-red';
};

export const PlayerEditorPanel = ({ player, onSave, onBack }: Props) => {
  const [name, setName] = useState(player.name);
  const [fullName, setFullName] = useState(player.fullName);
  const [birthYear, setBirthYear] = useState(player.birthYear);
  const [peakAge, setPeakAge] = useState(player.peakAge);
  const [preferredPos, setPreferredPos] = useState<Position>(player.preferredPos);
  const [stats, setStats] = useState<PlayerStats>({ ...player.stats });

  const setStat = (key: keyof PlayerStats, val: number) =>
    setStats(prev => ({ ...prev, [key]: Math.max(1, Math.min(99, val)) }));

  const handleSave = () => {
    onSave({
      ...player,
      name,
      fullName,
      birthYear,
      peakAge,
      preferredPos,
      position: preferredPos,
      stats,
      media: calculateMedia(stats, preferredPos),
    });
  };

  const media = calculateMedia(stats, preferredPos);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-2 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          VOLVER
        </button>
        <span className="text-vga-black text-[8px] uppercase font-bold">{player.name}</span>
        <span className="ml-auto text-vga-blue text-[8px] font-bold">MEDIA {media}</span>
      </div>

      <div className="bg-vga-gray border-2 border-vga-blue p-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Dorsal nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={16}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Posición preferida</label>
            <select
              value={preferredPos}
              onChange={e => setPreferredPos(e.target.value as Position)}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono"
            >
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-vga-blue text-[7px] uppercase font-bold">Nombre completo</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              maxLength={40}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Año nac.</label>
              <input
                type="number"
                value={birthYear}
                onChange={e => setBirthYear(Number(e.target.value))}
                min={1940} max={2010}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-vga-blue text-[7px] uppercase font-bold">Edad peak</label>
              <input
                type="number"
                value={peakAge}
                onChange={e => setPeakAge(Number(e.target.value))}
                min={20} max={40}
                className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1 border border-vga-black font-mono"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-vga-blue pt-2 flex flex-col gap-1.5">
          <span className="text-vga-blue text-[7px] uppercase font-bold">Estadísticas</span>
          {STAT_KEYS.map(key => {
            const val = stats[key];
            const pct = (val / 99) * 100;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-vga-cyan text-[8px] w-6 shrink-0">{STAT_LABELS[key]}</span>
                <input
                  type="range"
                  min={1} max={99}
                  value={val}
                  onChange={e => setStat(key, Number(e.target.value))}
                  className="flex-1 h-2 appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${val >= 80 ? '#00aa00' : val >= 60 ? '#aaaa00' : val >= 40 ? '#aa5500' : '#aa0000'} ${pct}%, #555555 ${pct}%)`
                  }}
                />
                <span className={`text-[9px] w-5 text-right font-mono font-bold ${barColor(val).replace('bg-', 'text-').replace('vga-light-green', 'vga-green').replace('vga-light-red', 'vga-red')}`}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold uppercase tracking-wider"
      >
        GUARDAR JUGADOR
      </button>
    </div>
  );
};

import type { ReactNode } from 'react';
import type { Player } from '../types/game.d.ts';
import { playerAge } from '../data/economy';
import { StatBar } from './StatBar';
import { MOOD } from '../engine/playerMood';
import { PlayerPhoto } from './PlayerPhoto';
import { PlayerName } from './PlayerName';

interface Props {
  player: Player;
  seasonYear: number;
  highlight?: 'listed' | 'free' | 'rival' | null;
  onNameClick?: () => void;
  footer?: ReactNode;
  moodState?: number;
  displayMedValue?: number;
  liveMedValue?: number;
}

const POS_BG: Record<string, string> = {
  POR: 'bg-vga-light-cyan',
  DEF: 'bg-vga-light-green',
  MED: 'bg-vga-yellow',
  AML: 'bg-vga-light-magenta',
  AMR: 'bg-vga-light-magenta',
  DEL: 'bg-vga-light-red',
};

export const PlayerCard = ({ player, seasonYear, highlight, onNameClick, footer, moodState, displayMedValue, liveMedValue }: Props) => {
  const age = playerAge(player, seasonYear);
  const s = player.seasonStats;
  const effectiveHighlight = highlight ?? (player.forSale ? 'listed' : null);
  const medDisplay = displayMedValue ?? player.media;
  const mood = moodState !== undefined ? MOOD[moodState] : null;
  const borderClass =
    effectiveHighlight === 'listed' ? 'border-vga-yellow'
    : effectiveHighlight === 'free' ? 'border-vga-light-green'
    : effectiveHighlight === 'rival' ? 'border-vga-cyan'
    : 'border-vga-white';

  const posBg = POS_BG[player.position] ?? 'bg-vga-yellow';

  return (
    <div className={`relative bg-vga-blue border-2 p-2 pl-3 text-vga-bright-white w-full max-w-sm vga-panel ${borderClass}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${posBg}`} aria-hidden="true" />
      <div className="flex justify-between items-center mb-1 border-b border-vga-cyan pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] font-bold px-1 border border-vga-black ${posBg} text-vga-black`}>{player.position}</span>
          {onNameClick ? (
            <button
              onClick={onNameClick}
              className="text-[12px] truncate text-left hover:text-vga-yellow underline decoration-dotted underline-offset-2"
            >
              <PlayerName player={player} useShirt />
            </button>
          ) : (
            <PlayerName player={player} useShirt className="text-[12px] truncate" />
          )}
        </div>
        <span className="text-[8px] text-vga-cyan shrink-0">#{player.number}</span>
      </div>

      <div className="flex gap-2 mb-2">
        <div className="flex flex-col items-center justify-center bg-vga-black vga-panel-inset w-14 py-1">
          <PlayerPhoto playerId={player.id} size="sm" className="mb-0.5" />
          <span className="text-[7px] text-vga-cyan">MEDIA</span>
          <div className="flex items-center gap-1">
            <span className="text-xl text-vga-light-green leading-none">{medDisplay}</span>
            {mood && <span className={`text-[9px] leading-none ${mood.colorClass}`}>{mood.symbol}</span>}
          </div>
          {liveMedValue !== undefined && (
            <span className="text-[7px] text-vga-cyan leading-none">{liveMedValue}</span>
          )}
          <span className="text-[7px] text-vga-yellow mt-1">{age}a</span>
        </div>
        <div className="flex-1 flex flex-col gap-0.5">
          {player.current_ability != null ? (
            <>
              <StatBar label="CA" value={player.current_ability} max={200} segments={8} size="sm" />
              <StatBar label="PA" value={player.potential_ability ?? player.current_ability} max={200} segments={8} size="sm" />
              {(player.positions ?? []).slice(0, 5).map(pos => (
                <StatBar key={pos.code} label={pos.code} value={pos.level} max={20} segments={4} size="sm" />
              ))}
            </>
          ) : (
            <>
              <StatBar label="VEL" value={player.stats.speed} segments={6} size="sm" />
              <StatBar label="REG" value={player.stats.dribbling} segments={6} size="sm" />
              <StatBar label="PAS" value={player.stats.passing} segments={6} size="sm" />
              <StatBar label="TIR" value={player.stats.shooting} segments={6} size="sm" />
              <StatBar label="DEF" value={player.stats.defending} segments={6} size="sm" />
              <StatBar label="FIS" value={player.stats.physical} segments={6} size="sm" />
              <StatBar label="POR" value={player.stats.goalkeeping} segments={6} size="sm" />
            </>
          )}
        </div>
      </div>

      <div className="bg-vga-black border border-vga-gray px-2 py-1 mb-2 flex items-center justify-between text-[7px]">
        <span className="text-vga-cyan">TEMPORADA</span>
        <div className="flex gap-2 text-vga-bright-white">
          <span><span className="text-vga-light-green">{s.goals}</span>G</span>
          <span><span className="text-vga-light-cyan">{s.assists}</span>A</span>
          <span><span className="text-vga-yellow">{s.yellowCards}</span>TA</span>
          <span><span className="text-vga-light-red">{s.redCards}</span>TR</span>
        </div>
      </div>

      {footer}
    </div>
  );
};

import type { FormationId, Position, Team } from '../types/game.d.ts';
import { FORMATIONS, isOOP, liveMed } from '../engine/formations';
import { moodStateOf } from '../engine/playerMood';

interface Props {
  team: Team;
  selectedSlot: number | null;
  onSlotClick: (slotIdx: number) => void;
  onCircleClick?: (slotIdx: number) => void;
  onNameClick?: (playerId: string) => void;
  // Player ids that should render with a "incoming" highlight ring (e.g. staged subs).
  highlightIds?: string[];
}

const POS_FILL: Record<Position, string> = {
  POR: '#FFFF55',
  DEF: '#55FFFF',
  MED: '#55FF55',
  AML: '#FF55FF',
  AMR: '#FF55FF',
  DEL: '#FF5555',
};

// Coordenadas en viewBox 100x110. Ataque hacia arriba (y baja).
const FORMATION_LAYOUTS: Record<FormationId, [number, number][]> = {
  '4-4-2': [
    [50, 98],
    [18, 80], [38, 80], [62, 80], [82, 80],
    [18, 55], [38, 55], [62, 55], [82, 55],
    [35, 22], [65, 22],
  ],
  '5-3-2': [
    [50, 98],
    [12, 80], [32, 80], [50, 80], [68, 80], [88, 80],
    [25, 55], [50, 55], [75, 55],
    [35, 22], [65, 22],
  ],
  '4-3-3': [
    [50, 98],
    [18, 80], [38, 80], [62, 80], [82, 80],
    [25, 55], [50, 55], [75, 55],
    [15, 22], [50, 22], [85, 22],
  ],
  '4-2-4': [
    [50, 98],
    [18, 78], [38, 78], [62, 78], [82, 78],
    [35, 58], [65, 58],
    [12, 22], [38, 22], [62, 22], [88, 22],
  ],
  '5-4-1': [
    [50, 98],
    [12, 80], [32, 80], [50, 80], [68, 80], [88, 80],
    [18, 55], [38, 55], [62, 55], [82, 55],
    [50, 22],
  ],
  '3-4-3': [
    [50, 98],
    [25, 80], [50, 80], [75, 80],
    [18, 55], [38, 55], [62, 55], [82, 55],
    [15, 22], [50, 22], [85, 22],
  ],
};

const shortName = (name: string): string =>
  name.length > 12 ? name.slice(0, 11) + '.' : name;

const MOOD_COLORS = ['#FF5555', '#AA5500', '#FFFF55', '#55FFFF', '#55FF55'];
const MOOD_SYMBOLS = ['▼▼', '▼', '—', '▲', '▲▲'];

export const PitchDiagram = ({ team, selectedSlot, onSlotClick, onCircleClick, onNameClick, highlightIds }: Props) => {
  const slots = FORMATIONS[team.formation];
  const layout = FORMATION_LAYOUTS[team.formation];

  return (
    <div className="bg-vga-black border-4 border-vga-white p-2">
      <svg viewBox="0 0 100 115" className="w-full max-w-md mx-auto block" shapeRendering="crispEdges">
        {/* Pitch */}
        <rect x="0" y="0" width="100" height="115" fill="#006400" />
        <rect x="3" y="3" width="94" height="104" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
        {/* Mid line + center circle */}
        <line x1="3" y1="55" x2="97" y2="55" stroke="#FFFFFF" strokeWidth="0.4" />
        <circle cx="50" cy="55" r="9" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
        <circle cx="50" cy="55" r="0.8" fill="#FFFFFF" />
        {/* Top penalty / goal areas (opponent) */}
        <rect x="25" y="3" width="50" height="13" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
        <rect x="38" y="3" width="24" height="5" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
        {/* Bottom penalty / goal areas (us) */}
        <rect x="25" y="94" width="50" height="13" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />
        <rect x="38" y="102" width="24" height="5" fill="none" stroke="#FFFFFF" strokeWidth="0.4" />

        {/* Slot tokens */}
        {slots.map((slotPos, idx) => {
          const [x, y] = layout[idx];
          const playerId = team.lineup[idx];
          const player = playerId ? team.players.find(p => p.id === playerId) : null;
          const oop = player ? isOOP(player, slotPos) : false;
          const unavailable = player ? ((player.injuryWeeksRemaining ?? 0) > 0 || player.suspensionMatches > 0) : false;
          const color = unavailable ? '#555555' : POS_FILL[slotPos];
          const isSelected = selectedSlot === idx;
          const stamina = player ? (player.stamina ?? 99) : 99;
          const staminaPct = Math.max(0, Math.min(99, stamina)) / 99;
          const stamColor = stamina >= 60 ? '#55FF55' : stamina >= 30 ? '#FFFF55' : '#FF5555';
          const mood = player ? moodStateOf(player, true) : 2;
          const playerLiveMed = player ? liveMed(player, stamina, slotPos) : 0;
          const handleCircle = onCircleClick
            ? (e: React.MouseEvent) => { e.stopPropagation(); onCircleClick(idx); }
            : undefined;
          const handleName = onNameClick && player
            ? (e: React.MouseEvent) => { e.stopPropagation(); onNameClick(player.id); }
            : undefined;

          return (
            <g key={idx} onClick={onCircleClick ? undefined : () => onSlotClick(idx)}
              style={{ cursor: 'pointer', opacity: unavailable ? 0.45 : 1 }}>
              {isSelected && (
                <circle cx={x} cy={y} r={6.5} fill="none" stroke="#FFFF55" strokeWidth="0.7" />
              )}
              {player && highlightIds?.includes(player.id) && (
                <circle cx={x} cy={y} r={6.5} fill="none" stroke="#55FFFF" strokeWidth="0.7" strokeDasharray="1.5 1" />
              )}
              {player ? (
                <>
                  <g transform={`translate(${x - 4.5}, ${y - 4.5}) scale(0.375)`} shapeRendering="crispEdges"
                    onClick={handleCircle} style={{ cursor: 'pointer' }}>
                    <path d="M4 4 L20 4 L20 5 L23 5 L23 11 L20 11 L20 14 L18 14 L18 21 L6 21 L6 14 L4 14 L4 11 L1 11 L1 5 L4 5 Z"
                      fill={color} stroke="#000000" strokeWidth="1.1" />
                  </g>
                  <text x={x} y={y + 1.7} fontSize="3.4" textAnchor="middle" fill={unavailable ? '#AAAAAA' : '#000000'} fontWeight="bold"
                    onClick={handleCircle} style={{ cursor: 'pointer' }}>
                    {Math.round(playerLiveMed / 2)}
                  </text>
                  {(() => {
                    const sn = shortName(player.name);
                    return (
                      <text x={x} y={y + 8.5} fontSize="3" textAnchor="middle" fill="#FFFFFF" fontWeight="bold"
                        textLength={sn.length > 7 ? 16 : undefined}
                        lengthAdjust={sn.length > 7 ? "spacingAndGlyphs" : undefined}
                        onClick={handleName} style={{ cursor: handleName ? 'pointer' : 'default',
                          textDecoration: handleName ? 'underline' : 'none' }}>
                        {sn}
                      </text>
                    );
                  })()}
                  {/* unavailability icon */}
                  {unavailable && (
                    <text x={x + 3.6} y={y - 2.6} fontSize="3.5" fill="#FF5555" fontWeight="bold">
                      {(player.injuryWeeksRemaining ?? 0) > 0 ? '✕' : 'S'}
                    </text>
                  )}
                  {/* stamina bar */}
                  {!unavailable && <rect x={x - 4} y={y + 9.5} width={8} height={1} fill="#222222" />}
                  {!unavailable && <rect x={x - 4} y={y + 9.5} width={8 * staminaPct} height={1} fill={stamColor} />}
                  {/* mood symbol */}
                  {!unavailable && (
                    <text x={x} y={y + 13.2} fontSize="2.8" textAnchor="middle" fill={MOOD_COLORS[mood]} fontWeight="bold">
                      {MOOD_SYMBOLS[mood]}
                    </text>
                  )}
                  {oop && !unavailable && (
                    <text x={x + 3.6} y={y - 2.6} fontSize="3.5" fill="#FF5555" fontWeight="bold">!</text>
                  )}
                </>
              ) : (
                <>
                  <circle cx={x} cy={y} r={4.6} fill="#000000" stroke={color} strokeWidth="0.6" strokeDasharray="1.2,0.6"
                    onClick={handleCircle} style={{ cursor: handleCircle ? 'pointer' : 'default' }} />
                  <text x={x} y={y + 1.4} fontSize="3" textAnchor="middle" fill={color} fontWeight="bold"
                    onClick={handleCircle} style={{ cursor: handleCircle ? 'pointer' : 'default' }}>
                    {slotPos}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

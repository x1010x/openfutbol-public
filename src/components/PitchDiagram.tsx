import { useRef, useState } from 'react';
import type { FormationId, Position, Team } from '../types/game.d.ts';
import { FORMATIONS, isOOP, liveMed } from '../engine/formations';
import { moodStateOf } from '../engine/playerMood';

interface Props {
  team: Team;
  selectedSlot: number | null;
  onSlotClick: (slotIdx: number) => void;
  onCircleClick?: (slotIdx: number) => void;
  onNameClick?: (playerId: string) => void;
  // Drag-to-adjust (user team, pre-match only). When `draggable`, outfield
  // tokens can be dragged to shift their off-ball anchor; the resulting offset
  // (engine space: dx = forward toward opponent, dy = lateral) is reported via
  // `onDragOffset` and persisted to team.lineupOffsets by the caller.
  draggable?: boolean;
  offsets?: Record<number, { dx: number; dy: number }>;
  onDragOffset?: (slotIdx: number, off: { dx: number; dy: number }) => void;
  // Ids of players sent off during the live match. Their slot is greyed,
  // marked with an X, and locked from interaction (no click, no drag) — the
  // gap can only be covered by repositioning the remaining ten.
  sentOffIds?: string[];
}

// Inner pitch spans: x 3..97 (94 units wide ↔ engine lateral 0..1),
// y 3..107 (104 units tall ↔ engine forward 0..1, attack = up = -y).
const PITCH_W = 94;
const PITCH_H = 104;
// Full-pitch drag: the engine clamps the resulting baseSlot to 0.03..0.97
// (lineup.ts/baseSlot), so we allow the offset to span the whole field. The
// user covers a sent-off teammate's zone by dragging anyone into that space.
const OFF_DX_MIN = -0.95, OFF_DX_MAX = 0.95; // back / forward
const OFF_DY_ABS = 0.95;                      // lateral
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

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

export const PitchDiagram = ({ team, selectedSlot, onSlotClick, onCircleClick, onNameClick, draggable, offsets, onDragOffset, sentOffIds }: Props) => {
  const slots = FORMATIONS[team.formation];
  const layout = FORMATION_LAYOUTS[team.formation];
  const sentOff = new Set(sentOffIds ?? []);

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ slot: number; dx: number; dy: number; moved: boolean } | null>(null);
  const startRef = useRef<{ cx: number; cy: number; baseDx: number; baseDy: number } | null>(null);

  // Screen-pixel delta → engine-space offset delta. Up on screen (−viewBox y)
  // is "forward" (+dx toward the opponent goal); right is +dy lateral.
  const toEngineDelta = (dCx: number, dCy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { ddx: 0, ddy: 0 };
    const vbX = dCx * (100 / rect.width);
    const vbY = dCy * (115 / rect.height);
    return { ddx: -vbY / PITCH_H, ddy: vbX / PITCH_W };
  };

  const onTokenDown = (slotIdx: number, e: React.PointerEvent) => {
    if (!draggable || slotIdx === 0 || !team.lineup[slotIdx]) return; // GK / empty not draggable
    if (sentOff.has(team.lineup[slotIdx])) return; // expelled slot is locked
    e.stopPropagation();
    const cur = offsets?.[slotIdx] ?? { dx: 0, dy: 0 };
    startRef.current = { cx: e.clientX, cy: e.clientY, baseDx: cur.dx, baseDy: cur.dy };
    setDrag({ slot: slotIdx, dx: cur.dx, dy: cur.dy, moved: false });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!drag || !s) return;
    const { ddx, ddy } = toEngineDelta(e.clientX - s.cx, e.clientY - s.cy);
    const dx = clamp(s.baseDx + ddx, OFF_DX_MIN, OFF_DX_MAX);
    const dy = clamp(s.baseDy + ddy, -OFF_DY_ABS, OFF_DY_ABS);
    const moved = drag.moved || Math.abs(e.clientX - s.cx) > 2 || Math.abs(e.clientY - s.cy) > 2;
    setDrag({ slot: drag.slot, dx, dy, moved });
  };
  const onUp = () => {
    if (!drag) return;
    if (drag.moved) onDragOffset?.(drag.slot, { dx: +drag.dx.toFixed(4), dy: +drag.dy.toFixed(4) });
    else onSlotClick(drag.slot);
    setDrag(null);
    startRef.current = null;
  };

  return (
    <div className="bg-vga-black border-4 border-vga-white p-2">
      <svg ref={svgRef} viewBox="0 0 100 115" className="w-full max-w-md mx-auto block" shapeRendering="crispEdges"
        onPointerMove={draggable ? onMove : undefined}
        onPointerUp={draggable ? onUp : undefined}
        style={{ touchAction: draggable ? 'none' : undefined }}>
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
          const [baseX, baseY] = layout[idx];
          // Apply the persisted offset (or the live drag offset for the token
          // being dragged), converting engine space back to viewBox units.
          const off = drag && drag.slot === idx
            ? { dx: drag.dx, dy: drag.dy }
            : (offsets?.[idx] ?? { dx: 0, dy: 0 });
          const hasOff = off.dx !== 0 || off.dy !== 0;
          const x = clamp(baseX + off.dy * PITCH_W, 3, 97);
          const y = clamp(baseY - off.dx * PITCH_H, 3, 107);
          const playerId = team.lineup[idx];
          const player = playerId ? team.players.find(p => p.id === playerId) : null;
          const oop = player ? isOOP(player, slotPos) : false;
          const isSentOff = !!playerId && sentOff.has(playerId);
          const unavailable = isSentOff || (player ? ((player.injuryWeeksRemaining ?? 0) > 0 || player.suspensionMatches > 0) : false);
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

          const canDrag = draggable && idx !== 0 && !!player && !isSentOff;
          return (
            <g key={idx}
              onClick={(draggable || onCircleClick || isSentOff) ? undefined : () => onSlotClick(idx)}
              onPointerDown={canDrag ? (e) => onTokenDown(idx, e) : undefined}
              style={{ cursor: isSentOff ? 'not-allowed' : (canDrag ? 'grab' : 'pointer'), opacity: unavailable ? 0.45 : 1 }}>
              {/* Drag indicator: faint marker at the formation base + line to the
                  shifted position, so the adjustment relative to the slot reads. */}
              {hasOff && canDrag && (
                <>
                  <circle cx={baseX} cy={baseY} r={1.1} fill="#ffff55" opacity={0.5} />
                  <line x1={baseX} y1={baseY} x2={x} y2={y} stroke="#ffff55" strokeWidth={0.4} strokeDasharray="1,0.8" opacity={0.6} />
                </>
              )}
              {isSelected && (
                <circle cx={x} cy={y} r={6.5} fill="none" stroke="#FFFF55" strokeWidth="0.7" />
              )}
              {player ? (
                <>
                  <circle cx={x} cy={y} r={4.6} fill={color} stroke="#000000" strokeWidth="0.4"
                    onClick={handleCircle} style={{ cursor: 'pointer' }} />
                  <text x={x} y={y + 1.4} fontSize="3.6" textAnchor="middle" fill={unavailable ? '#AAAAAA' : '#000000'} fontWeight="bold"
                    onClick={handleCircle} style={{ cursor: 'pointer' }}>
                    {playerLiveMed}
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
                      {isSentOff ? 'R' : ((player.injuryWeeksRemaining ?? 0) > 0 ? '✕' : 'S')}
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

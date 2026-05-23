import type { Player, Position } from '../types/game.d.ts';
import { effectiveMedia, isOOP, liveMed } from '../engine/formations';
import { PlayerName } from './PlayerName';

const POS_ORDER: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3, AML: 4, AMR: 5 };
const POS_COLOR: Record<string, string> = {
  POR: '#ffff55', DEF: '#55ffff', MED: '#55ff55', DEL: '#ff5555', AML: '#ff55ff', AMR: '#ff55ff',
};

const byPosThenLive = (slotPos: Position) => (a: Player, b: Player) => {
  const posA = POS_ORDER[a.position] ?? 9;
  const posB = POS_ORDER[b.position] ?? 9;
  if (posA !== posB) return posA - posB;
  return liveMed(b, b.stamina ?? 99, slotPos) - liveMed(a, a.stamina ?? 99, slotPos);
};

const StaminaBar = ({ value }: { value: number }) => {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  const col = pct >= 60 ? '#55ff55' : pct >= 30 ? '#ffff55' : '#ff5555';
  return (
    <div style={{ width: 36, height: 5, background: '#000000', border: '1px solid #333355', flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col }} />
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
  const available = candidates.filter(p => !inLineup.has(p.id));
  const inField   = candidates.filter(p =>  inLineup.has(p.id));

  const inPos = available.filter(p => !isOOP(p, slotPos)).sort(byPosThenLive(slotPos));
  const oop   = available.filter(p =>  isOOP(p, slotPos)).sort(byPosThenLive(slotPos));
  const field = [...inField].sort((a, b) =>
    liveMed(b, b.stamina ?? 99, slotPos) - liveMed(a, a.stamina ?? 99, slotPos)
  );

  const makeRow = (p: Player, isTitular: boolean) => {
    const isCurrent = p.id === currentPlayer?.id;
    const oopFlag = isOOP(p, slotPos);
    const stam = p.stamina ?? 99;
    const pLiveMed = liveMed(p, stam, slotPos);
    const effMed = Math.round(effectiveMedia(p, slotPos));
    const baseBg = isCurrent ? 'rgba(255,255,85,0.12)' : isTitular ? 'rgba(0,0,170,0.35)' : 'transparent';
    return (
      <tr
        key={p.id}
        onClick={() => onSelect(p.id)}
        style={{ cursor: 'pointer', background: baseBg, borderBottom: '1px solid #111133' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(85,85,255,0.25)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = baseBg; }}
      >
        <td style={{ width: 14, textAlign: 'center', fontSize: 7, color: isCurrent ? '#ffff55' : '#333355', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {isCurrent ? '▶' : ''}
        </td>
        <td style={{ width: 26, textAlign: 'center', fontSize: 7, fontWeight: 'bold', color: POS_COLOR[p.position] ?? '#ffffff', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {p.position}
        </td>
        <td style={{ fontSize: 7, color: '#ffffff', padding: '2px 4px', borderRight: '1px solid #222244', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 100 }}>
          <PlayerName player={p} />
          {isCurrent && <span style={{ fontSize: 5, color: '#ffff55', marginLeft: 3 }}>(sale)</span>}
          {isTitular && !isCurrent && <span style={{ fontSize: 5, color: '#55ffff', marginLeft: 3 }}>(campo)</span>}
        </td>
        <td style={{ width: 28, textAlign: 'center', fontSize: 7, fontFamily: 'monospace', color: oopFlag ? '#ff5555' : '#55ff55', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {effMed}{oopFlag && <span style={{ fontSize: 5 }}> !</span>}
        </td>
        <td style={{ width: 28, textAlign: 'center', fontSize: 7, fontFamily: 'monospace', color: pLiveMed < p.media ? '#ff5555' : '#55ffff', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {pLiveMed}
        </td>
        <td style={{ padding: '2px 4px' }}>
          <StaminaBar value={stam} />
        </td>
      </tr>
    );
  };

  const rows: React.ReactNode[] = [
    ...inPos.map(p => makeRow(p, false)),
    ...(oop.length > 0 ? [
      <tr key="div-oop">
        <td colSpan={6} style={{ background: '#1a0000', borderTop: '1px solid #442222', borderBottom: '1px solid #442222', padding: '1px 4px', fontSize: 5, color: '#ff5555', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>
          ─── fuera de posición ───
        </td>
      </tr>,
      ...oop.map(p => makeRow(p, false)),
    ] : []),
    ...(field.length > 0 ? [
      <tr key="div-field">
        <td colSpan={6} style={{ background: '#000033', borderTop: '1px solid #2233aa', borderBottom: '1px solid #2233aa', padding: '1px 4px', fontSize: 5, color: '#55ffff', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>
          ─── en campo ───
        </td>
      </tr>,
      ...field.map(p => makeRow(p, true)),
    ] : []),
  ];

  if (rows.length === 0) {
    rows.push(
      <tr key="empty">
        <td colSpan={6} style={{ padding: 8, textAlign: 'center', fontSize: 6, color: '#555577', fontStyle: 'italic' }}>
          Sin jugadores disponibles
        </td>
      </tr>
    );
  }

  const slotColor = POS_COLOR[slotPos] ?? '#ffffff';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 8 }}>
      {/* ═══ MODAL FRAME ═══════════════════════════════════════════ */}
      <div style={{
        maxWidth: 360,
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        border: '4px solid #aaaaaa',
        boxShadow: 'inset 2px 2px 0 #ffffff, inset -2px -2px 0 #000000, 6px 6px 0 #000000',
        background: '#00000f',
      }}>

        {/* ─── HEADER ─────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(180deg, #0004e0 0%, #0000aa 100%)',
          borderBottom: '4px solid #aaaaaa',
          boxShadow: 'inset 2px 2px 0 #5555ff, inset -2px -2px 0 #000055',
          padding: '5px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 8, color: '#ffff55', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
              ▶ SLOT <span style={{ color: slotColor }}>{slotPos}</span> — ELIGE JUGADOR
            </div>
            {currentPlayer && (
              <div style={{ fontSize: 6, color: '#aaaaaa', textTransform: 'uppercase', marginTop: 1 }}>
                SALE: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{currentPlayer.name}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: '#000000', color: '#ff5555', border: '2px solid #aa0000', padding: '2px 6px', fontSize: 8, fontWeight: 'bold', cursor: 'pointer', boxShadow: 'inset 1px 1px 0 #ff5555, inset -1px -1px 0 #550000' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#aa0000'; (e.target as HTMLElement).style.color = '#ffffff'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#000000'; (e.target as HTMLElement).style.color = '#ff5555'; }}
          >
            ✕
          </button>
        </div>

        {/* ─── TABLE ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(180deg, #0004e0 0%, #0000cc 100%)', color: '#55ffff', fontSize: 6, textTransform: 'uppercase', letterSpacing: 1, position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 14, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>◉</th>
                <th style={{ width: 26, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>POS</th>
                <th style={{ textAlign: 'left', padding: '2px 4px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>NOMBRE</th>
                <th style={{ width: 28, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>MED</th>
                <th style={{ width: 28, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>VIV</th>
                <th style={{ width: 48, textAlign: 'center', padding: '2px 4px', borderBottom: '2px solid #333366' }}>CAN</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>

        {/* ─── ACTION BAR ─────────────────────────────────────────── */}
        <div style={{ background: '#000008', borderTop: '2px solid #333344', padding: '4px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
          {onClear && currentPlayer && (
            <button
              onClick={onClear}
              style={{ fontSize: 6, border: '1px solid #ff5555', color: '#ff5555', background: 'transparent', padding: '2px 8px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: 1 }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#aa0000'; (e.target as HTMLElement).style.color = '#ffffff'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#ff5555'; }}
            >
              ✕ VACIAR SLOT
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 5, color: '#333355', textTransform: 'uppercase', letterSpacing: 1 }}>
            CLIC PARA SELECCIONAR
          </div>
        </div>

      </div>
    </div>
  );
};

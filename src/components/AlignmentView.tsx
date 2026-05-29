import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { FormationId, Player, Position, Team } from '../types/game.d.ts';
import { calculateTeamStrength } from '../engine/simEngine';
import { ALL_FORMATIONS, FORMATIONS, effectiveMedia, isOOP, liveMed, pickBestXI, reslotLineup } from '../engine/formations';
import { PitchDiagram } from './PitchDiagram';
import { moodStateOf, MOOD } from '../engine/playerMood';
import { PlayerName } from './PlayerName';
import { useT } from '../i18n';

interface IngameProps {
  subsUsed: number;
  maxSubs: number;
  injuredIds: string[];
  sentOff: string[];
  htPaused: boolean;
  onSubstitute: (outId: string, inId: string) => void;
  onContinue: () => void;
  // If set, opens with this player's slot already selected (e.g. clicked from match pitch)
  initialSelectedPlayerId?: string | null;
}

interface Props {
  team: Team;
  onUpdate: (patch: { lineup: string[]; formation: FormationId }) => void;
  onBack: () => void;
  onToggleDiscipline: () => void;
  ingame?: IngameProps;
}

const POS_COLOR: Record<string, string> = {
  POR: 'text-vga-yellow', DEF: 'text-vga-light-cyan',
  MED: 'text-vga-light-green', DEL: 'text-vga-light-red',
  AML: 'text-vga-light-magenta', AMR: 'text-vga-light-magenta',
};
const getPositionColor = (pos: string) => POS_COLOR[pos] ?? 'text-vga-white';

const StaminaBar = ({ value }: { value: number }) => {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  const col = pct >= 60 ? '#55ff55' : pct >= 30 ? '#ffff55' : '#ff5555';
  return (
    <div style={{ width: 36, height: 5, background: '#000000', border: '1px solid #333355', flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: col }} />
    </div>
  );
};

const POS_ORDER: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3, AML: 4, AMR: 5 };

const byPosThenLive = (slotPos: Position) => (a: Player, b: Player) => {
  const posA = POS_ORDER[a.position] ?? 9;
  const posB = POS_ORDER[b.position] ?? 9;
  if (posA !== posB) return posA - posB;
  return liveMed(b, b.stamina ?? 99, slotPos) - liveMed(a, a.stamina ?? 99, slotPos);
};

const Divider = ({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) => (
  <tr>
    <td colSpan={6} style={{ background: bg, borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '1px 4px', fontSize: 9, color, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>
      ─── {label} ───
    </td>
  </tr>
);

// ─── Picker rows (slot selected) ────────────────────────────────────
const PickerRows = ({
  candidates, slotPos, currentSlotPlayerId, selectedSlot, assignToSlot, slotOfPlayer
}: {
  candidates: Player[]; slotPos: Position; currentSlotPlayerId: string | null;
  selectedSlot: number; assignToSlot: (idx: number, pid: string | null) => void;
  slotOfPlayer: Map<string, number>;
}) => {
  // Group: available in-position, available OOP, titulars (in field)
  const available = candidates.filter(p => !slotOfPlayer.has(p.id));
  const inField   = candidates.filter(p =>  slotOfPlayer.has(p.id));

  const inPos = available.filter(p => !isOOP(p, slotPos)).sort(byPosThenLive(slotPos));
  const oop   = available.filter(p =>  isOOP(p, slotPos)).sort(byPosThenLive(slotPos));
  const field = [...inField].sort((a, b) =>
    liveMed(b, b.stamina ?? 99, slotPos) - liveMed(a, a.stamina ?? 99, slotPos)
  );

  const makeRow = (p: Player, isTitular: boolean) => {
    const isCurrent = p.id === currentSlotPlayerId;
    const oopFlag = isOOP(p, slotPos);
    const stam = p.stamina ?? 99;
    const pLive = Math.round(liveMed(p, stam, slotPos) / 2);
    const effMed = Math.round(effectiveMedia(p, slotPos) / 2);
    const baseBg = isCurrent ? 'rgba(255,255,85,0.12)' : isTitular ? 'rgba(0,0,170,0.35)' : 'transparent';
    return (
      <tr
        key={p.id}
        onClick={() => assignToSlot(selectedSlot, p.id)}
        style={{ cursor: 'pointer', background: baseBg, borderBottom: '1px solid #111133' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(85,85,255,0.22)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = baseBg; }}
      >
        <td style={{ width: 56, textAlign: 'center', paddingLeft: 2, paddingRight: 2, fontSize: 13, color: '#ffff55', borderRight: '1px solid #222244' }}>
          {isCurrent ? '▶' : ''}
        </td>
        <td className={`font-bold ${getPositionColor(p.position)}`} style={{ width: 44, textAlign: 'center', fontSize: 13, borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {p.position}
        </td>
        <td style={{ fontSize: 13, color: '#ffffff', padding: '2px 3px', borderRight: '1px solid #222244', maxWidth: 80, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <PlayerName player={p} />
          {isTitular && <span style={{ fontSize: 9, color: '#55ffff', marginLeft: 3 }}>{t('misc.onFieldShort')}</span>}
        </td>
        <td style={{ width: 52, textAlign: 'center', fontSize: 13, fontFamily: 'monospace', color: oopFlag ? '#ff5555' : '#55ff55', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {effMed}
        </td>
        <td style={{ width: 52, textAlign: 'center', fontSize: 13, fontFamily: 'monospace', color: pLive < p.media ? '#ff5555' : '#55ffff', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {pLive}
        </td>
        <td style={{ padding: '2px 3px' }}>
          <StaminaBar value={stam} />
        </td>
      </tr>
    );
  };

  const t = useT();
  if (inPos.length === 0 && oop.length === 0 && field.length === 0) {
    return <tr><td colSpan={6} style={{ padding: 8, textAlign: 'center', fontSize: 11, color: '#555577', fontStyle: 'italic' }}>{t('misc.noSquadAvail')}</td></tr>;
  }

  return (
    <>
      {inPos.map(p => makeRow(p, false))}
      {oop.length > 0 && <Divider label={t('misc.outOfPosition')} color="#ff5555" bg="#1a0000" border="#442222" />}
      {oop.map(p => makeRow(p, false))}
      {field.length > 0 && <Divider label={t('misc.onField')} color="#55ffff" bg="#000033" border="#224444" />}
      {field.map(p => makeRow(p, true))}
    </>
  );
};

// ─── Roster rows (no slot selected) ─────────────────────────────────
const RosterRows = ({
  sortedPlayers, slots, slotOfPlayer, selectedSlot, setSelectedSlot, togglePlayer
}: {
  sortedPlayers: Player[]; slots: Position[];
  slotOfPlayer: Map<string, number>; selectedSlot: number | null;
  setSelectedSlot: (s: number | null) => void; togglePlayer: (pid: string) => void;
}) => {
  const t = useT();
  const rows: ReactNode[] = [];
  let suplenteDivider = false;

  for (const player of sortedPlayers) {
    const slotIdx = slotOfPlayer.get(player.id);
    const isTitular = slotIdx !== undefined;
    const slotPos: Position | null = isTitular ? slots[slotIdx!] : null;
    const oop = isTitular && slotPos ? isOOP(player, slotPos) : false;
    const isSuspended = player.suspensionMatches > 0;
    const isInjured = (player.injuryWeeksRemaining ?? 0) > 0;
    const unavailable = isSuspended || isInjured;
    const effMed = isTitular && slotPos ? Math.round(effectiveMedia(player, slotPos) / 2) : player.media;
    const stamina = player.stamina ?? 99;
    const mood = moodStateOf(player, isTitular);
    const moodInfo = MOOD[mood];
    const isSelected = isTitular && slotIdx === selectedSlot;

    if (!suplenteDivider && !isTitular) {
      suplenteDivider = true;
      rows.push(
        <tr key="div-suplentes">
          <td colSpan={6} style={{ background: '#001800', borderTop: '1px solid #114411', borderBottom: '1px solid #114411', padding: '1px 4px', fontSize: 9, color: '#55aa55', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 }}>
            ─── {t('misc.reserves')} ───
          </td>
        </tr>
      );
    }

    rows.push(
      <tr
        key={player.id}
        onClick={() => {
          if (unavailable) return;
          if (isTitular && slotIdx !== undefined) {
            setSelectedSlot(selectedSlot === slotIdx ? null : slotIdx);
          } else {
            togglePlayer(player.id);
          }
        }}
        style={{
          cursor: unavailable ? 'default' : 'pointer',
          opacity: unavailable ? 0.45 : 1,
          background: isSelected
            ? 'rgba(255,255,85,0.14)'
            : isTitular
              ? 'rgba(0,0,100,0.45)'
              : 'transparent',
          borderBottom: '1px solid #111133',
        }}
        onMouseEnter={e => { if (!unavailable) (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(255,255,85,0.22)' : 'rgba(85,85,255,0.14)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(255,255,85,0.14)' : isTitular ? 'rgba(0,0,100,0.45)' : 'transparent'; }}
      >
        {/* slot # */}
        <td style={{ width: 56, textAlign: 'center', fontSize: 13, color: isSelected ? '#ffff55' : '#555577', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {isTitular ? (isSelected ? '▶' : String(slotIdx! + 1)) : '—'}
        </td>
        {/* position */}
        <td style={{ width: 44, textAlign: 'center', fontSize: 13, borderRight: '1px solid #222244', padding: '2px 2px' }}>
          <span className={`font-bold ${isTitular ? getPositionColor(slotPos ?? player.position) : 'text-vga-gray'}`}>
            {isTitular ? slotPos : player.position}
          </span>
          {oop && <span style={{ fontSize: 9, color: '#ff5555', marginLeft: 1 }}>!</span>}
        </td>
        {/* name */}
        <td style={{ fontSize: 13, padding: '2px 3px', borderRight: '1px solid #222244', color: isTitular ? '#ffffff' : '#888899', maxWidth: 90, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <span style={{ fontWeight: isTitular ? 'bold' : 'normal' }}>
            <PlayerName player={player} />
          </span>
          {player.seasonStats?.yellowCards > 0 && <span style={{ display: 'inline-block', width: 4, height: 6, background: '#ffff55', border: '0.5px solid black', marginLeft: 2, verticalAlign: 'middle' }} />}
          {player.seasonStats?.redCards > 0 && <span style={{ display: 'inline-block', width: 4, height: 6, background: '#aa0000', border: '0.5px solid black', marginLeft: 2, verticalAlign: 'middle' }} />}
          {isSuspended && <span style={{ fontSize: 9, color: '#ff5555', marginLeft: 3, fontWeight: 'bold' }}>[SAN]</span>}
          {isInjured && <span style={{ fontSize: 9, color: '#ff8855', marginLeft: 3, fontWeight: 'bold' }}>[LES {player.injuryWeeksRemaining}s]</span>}
        </td>
        {/* MED */}
        <td style={{ width: 52, textAlign: 'center', fontSize: 13, fontFamily: 'monospace', color: oop ? '#ff5555' : isTitular ? '#55ff55' : '#888899', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {effMed}
        </td>
        {/* LIVE */}
        <td style={{ width: 52, textAlign: 'center', fontSize: 13, fontFamily: 'monospace', color: '#55ffff', borderRight: '1px solid #222244', padding: '2px 2px' }}>
          {Math.round(liveMed(player, stamina, isTitular && slotPos ? slotPos : undefined) / 2)}
        </td>
        {/* stamina + mood */}
        <td style={{ padding: '2px 3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <StaminaBar value={stamina} />
            <span className={moodInfo.colorClass} style={{ fontSize: 13, fontWeight: 'bold' }}>{moodInfo.symbol}</span>
          </div>
        </td>
      </tr>
    );
  }

  return <>{rows}</>;
};

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════
export const AlignmentView = ({ team, onUpdate, onBack, onToggleDiscipline, ingame }: Props) => {
  const t = useT();
  const teamMED = Math.floor(calculateTeamStrength(team) / 2);
  const slots = FORMATIONS[team.formation];
  const initialSelectedSlot = ingame?.initialSelectedPlayerId
    ? (() => { const i = team.lineup.indexOf(ingame.initialSelectedPlayerId); return i >= 0 ? i : null; })()
    : null;
  const [selectedSlot, setSelectedSlot] = useState<number | null>(initialSelectedSlot);

  const slotOfPlayer = new Map<string, number>();
  team.lineup.forEach((id, idx) => { if (id) slotOfPlayer.set(id, idx); });
  const currentTitulars = team.lineup.filter(Boolean);
  const titularCount = currentTitulars.length;

  const handleFormationChange = (f: FormationId) => {
    if (f === team.formation) return;
    const newLineup = reslotLineup(team, currentTitulars, f);
    onUpdate({ lineup: newLineup, formation: f });
  };

  const handleAutoFix = () => {
    const excl = ingame ? new Set([...ingame.sentOff, ...ingame.injuredIds]) : new Set<string>();
    const { lineup } = pickBestXI(team.players, team.formation, excl, team.tacticalDiscipline ?? true);
    onUpdate({ lineup, formation: team.formation });
  };

  const assignToSlot = (slotIdx: number, playerId: string | null) => {
    if (ingame) {
      // In-game mode: real substitution (permanent)
      if (playerId === null) { setSelectedSlot(null); return; }
      const outId = team.lineup[slotIdx];
      if (outId && ingame.subsUsed < ingame.maxSubs) {
        ingame.onSubstitute(outId, playerId);
      }
      setSelectedSlot(null);
      return;
    }
    const newLineup: string[] = [];
    for (let i = 0; i < slots.length; i++) newLineup.push(team.lineup[i] ?? '');
    if (playerId === null) {
      newLineup[slotIdx] = '';
    } else {
      const existingSlot = newLineup.indexOf(playerId);
      if (existingSlot !== -1) newLineup[existingSlot] = newLineup[slotIdx];
      newLineup[slotIdx] = playerId;
    }
    while (newLineup.length > 0 && newLineup[newLineup.length - 1] === '') newLineup.pop();
    onUpdate({ lineup: newLineup, formation: team.formation });
    setSelectedSlot(null);
  };

  const togglePlayer = (playerId: string) => {
    if (ingame) return; // no free toggles in-game
    const player = team.players.find(p => p.id === playerId);
    if (!player || player.suspensionMatches > 0 || (player.injuryWeeksRemaining ?? 0) > 0) return;
    const isTitular = slotOfPlayer.has(playerId);
    let newTitulars: string[];
    if (isTitular) {
      newTitulars = currentTitulars.filter(id => id !== playerId);
    } else {
      if (titularCount >= 11) return;
      newTitulars = [...currentTitulars, playerId];
    }
    onUpdate({ lineup: reslotLineup(team, newTitulars, team.formation), formation: team.formation });
  };

  const inPickMode = selectedSlot !== null;
  const slotPos: Position | null = inPickMode ? slots[selectedSlot!] : null;
  const currentSlotPlayerId = inPickMode ? (team.lineup[selectedSlot!] ?? null) : null;

  const candidates = slotPos
    ? team.players.filter(p => {
        if (p.suspensionMatches > 0 || (p.injuryWeeksRemaining ?? 0) > 0) return false;
        if (ingame) {
          // In-game: only bench players can come in, exclude injured/sentOff in match
          if (ingame.injuredIds.includes(p.id) || ingame.sentOff.includes(p.id)) return false;
          if (slotOfPlayer.has(p.id)) return false;
        }
        return true;
      })
    : [];

  const sortedPlayers = [...team.players].sort((a, b) => {
    const ta = slotOfPlayer.has(a.id) ? 0 : 1;
    const tb = slotOfPlayer.has(b.id) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (ta === 0) return (slotOfPlayer.get(a.id)! - slotOfPlayer.get(b.id)!);
    return b.media - a.media;
  });

  // ─── Style constants ─────────────────────────────────────────────
  const outerFrame: CSSProperties = {
    border: '4px solid #aaaaaa',
    boxShadow: 'inset 2px 2px 0 #ffffff, inset -2px -2px 0 #000000, 5px 5px 0 #000000',
    background: '#000000',
    width: '100%',
  };
  const headerStyle: CSSProperties = {
    background: 'linear-gradient(180deg, #0004e0 0%, #0000aa 100%)',
    borderBottom: '4px solid #aaaaaa',
    boxShadow: 'inset 2px 2px 0 #5555ff, inset -2px -2px 0 #000055',
    padding: '6px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
  const sectionLabel: CSSProperties = {
    background: 'linear-gradient(180deg, #0002aa 0%, #000088 100%)',
    borderBottom: '2px solid #333366',
    textAlign: 'center',
    padding: '2px 4px',
    fontSize: 11,
    color: '#ffff55',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  };
  const tableHead: CSSProperties = {
    background: 'linear-gradient(180deg, #0004e0 0%, #0000cc 100%)',
    color: '#55ffff',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0 4px' }}>
      <div style={outerFrame}>

        {/* ═══ HEADER BAR ═══════════════════════════════════════════ */}
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 15, color: '#ffff55', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 }}>
              {ingame ? t('misc.changesHeader') : t('misc.alignmentHeader')} — {team.name}
              {ingame?.htPaused && <span style={{ marginLeft: 8, fontSize: 11, color: '#55ffff' }}>{t('misc.halftime')}</span>}
            </div>
            <div style={{ fontSize: 11, color: '#aaaaaa', textTransform: 'uppercase', marginTop: 2 }}>
              ENT: {team.manager}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ background: '#000000', border: '2px solid #ffff55', padding: '2px 6px', fontSize: 14, color: '#ffff55', fontFamily: 'monospace', fontWeight: 'bold', boxShadow: 'inset 1px 1px 0 #888800, inset -1px -1px 0 #333300' }}>
              MED {teamMED}
            </div>
            {ingame ? (
              <div style={{ background: '#000000', border: `2px solid ${ingame.subsUsed >= ingame.maxSubs ? '#ff5555' : '#55ff55'}`, padding: '2px 6px', fontSize: 14, color: ingame.subsUsed >= ingame.maxSubs ? '#ff5555' : '#55ff55', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {t('misc.subsCountFmt', { used: String(ingame.subsUsed), max: String(ingame.maxSubs) })}
              </div>
            ) : (
              <div style={{ background: '#000000', border: `2px solid ${titularCount === 11 ? '#55ff55' : '#ff5555'}`, padding: '2px 6px', fontSize: 14, color: titularCount === 11 ? '#55ff55' : '#ff5555', fontFamily: 'monospace', fontWeight: 'bold' }}>
                {titularCount}/11
              </div>
            )}
            <button
              onClick={ingame ? ingame.onContinue : onBack}
              style={{ background: ingame ? '#0000aa' : '#aa0000', color: '#ffffff', border: '2px solid #aaaaaa', padding: '3px 10px', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', boxShadow: ingame ? 'inset 1px 1px 0 #5555ff, inset -1px -1px 0 #000055' : 'inset 1px 1px 0 #ff5555, inset -1px -1px 0 #550000' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = ingame ? '#0004e0' : '#ff5555'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = ingame ? '#0000aa' : '#aa0000'; }}
            >
              {ingame ? t('misc.continueIngame') : t('misc.saveAndExit')}
            </button>
          </div>
        </div>

        {/* ═══ FORMATION BAR (top) ══════════════════════════════════ */}
        <div style={{ background: 'linear-gradient(180deg, #0002cc 0%, #000088 100%)', borderTop: '4px solid #aaaaaa', borderBottom: '2px solid #333366', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#ffff55', fontWeight: 'bold', textTransform: 'uppercase', marginRight: 4, letterSpacing: 1 }}>{t('misc.formation')}</span>
          {ALL_FORMATIONS.map(f => {
            const active = f === team.formation;
            return (
              <button
                key={f}
                onClick={() => handleFormationChange(f)}
                style={{
                  padding: '2px 6px',
                  fontSize: 13,
                  fontWeight: 'bold',
                  border: active ? '2px solid #ffffff' : '2px solid #555577',
                  background: active ? '#ffff55' : '#000022',
                  color: active ? '#000000' : '#aaaaaa',
                  cursor: 'pointer',
                  boxShadow: active
                    ? 'inset 1px 1px 0 #ffff99, inset -1px -1px 0 #888800, 0 0 8px rgba(255,255,85,0.5)'
                    : 'inset 1px 1px 0 #333355, inset -1px -1px 0 #000000',
                }}
                onMouseEnter={e => { if (!active) { (e.target as HTMLElement).style.color = '#ffff55'; (e.target as HTMLElement).style.borderColor = '#aaaaaa'; } }}
                onMouseLeave={e => { if (!active) { (e.target as HTMLElement).style.color = '#aaaaaa'; (e.target as HTMLElement).style.borderColor = '#555577'; } }}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* ═══ COMMAND BAR (top) ════════════════════════════════════ */}
        <div style={{ background: '#000008', borderTop: '2px solid #333344', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {!ingame && (
            <CmdButton onClick={handleAutoFix} color="#55ff55" hoverBg="#00aa00">
              {t('misc.auto11')}
            </CmdButton>
          )}
          <CmdButton
            onClick={onToggleDiscipline}
            color={team.tacticalDiscipline ? '#55ffff' : '#ff55ff'}
            hoverBg={team.tacticalDiscipline ? '#00aaaa' : '#aa00aa'}
          >
            ■ {team.tacticalDiscipline ? t('misc.tactPos') : t('misc.tactFree')}
          </CmdButton>
          {inPickMode && (
            <CmdButton onClick={() => setSelectedSlot(null)} color="#ffff55" hoverBg="#888800">
              ■ {t('btn.cancel')}
            </CmdButton>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#333355' }}>
            {ingame
              ? (ingame.subsUsed >= ingame.maxSubs ? t('misc.subsExhausted') : inPickMode ? t('misc.pickIncoming') : t('misc.clickTitular'))
              : (inPickMode ? t('misc.clickPlayer') : t('misc.clickSlot'))}
          </div>
        </div>

        {/* ═══ TWO-COLUMN BODY ══════════════════════════════════════ */}
        <div style={{ display: 'flex', background: '#00000f' }}>

          {/* ─── LEFT: PITCH ─────────────────────────────────────── */}
          <div style={{ width: '40%', flexShrink: 0, borderRight: '4px solid #aaaaaa' }}>
            <div style={{ ...sectionLabel, color: inPickMode ? '#55ffff' : '#ffff55' }}>
              {inPickMode ? t('misc.slotMode', { pos: slotPos ?? '' }) : t('misc.fieldMode', { formation: team.formation })}
            </div>
            <PitchDiagram
              team={team}
              selectedSlot={selectedSlot}
              onSlotClick={(idx) => {
                if (ingame && ingame.subsUsed >= ingame.maxSubs) return;
                setSelectedSlot(idx === selectedSlot ? null : idx);
              }}
            />
            {inPickMode && currentSlotPlayerId && !ingame && (
              <button
                onClick={() => assignToSlot(selectedSlot!, null)}
                style={{ width: '100%', background: '#aa0000', color: '#ffffff', border: 'none', borderTop: '2px solid #555555', padding: '3px 0', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: 1 }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#ff5555'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = '#aa0000'; }}
              >
                {t('misc.clearSlot')}
              </button>
            )}
            {inPickMode && !currentSlotPlayerId && (
              <div style={{ textAlign: 'center', padding: '3px 0', fontSize: 11, color: '#555577', borderTop: '2px solid #333344' }}>
                {t('misc.emptySlot')}
              </div>
            )}
          </div>

          {/* ─── RIGHT: ROSTER / PICKER ──────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...sectionLabel, color: inPickMode ? '#55ffff' : '#ffff55' }}>
              {inPickMode ? t('misc.chooseFor', { pos: slotPos ?? '' }) : t('misc.fullSquad')}
              {inPickMode && (
                <button
                  onClick={() => setSelectedSlot(null)}
                  style={{ marginLeft: 8, background: 'transparent', border: '1px solid #ff5555', color: '#ff5555', fontSize: 9, padding: '1px 4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ESC
                </button>
              )}
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', minHeight: 200 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={tableHead}>
                    <th style={{ width: 32, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>#</th>
                    <th style={{ width: 52, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>POS</th>
                    <th style={{ textAlign: 'left', padding: '2px 4px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>NOMBRE</th>
                    <th style={{ width: 56, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>MED</th>
                    <th style={{ width: 56, textAlign: 'center', padding: '2px 2px', borderRight: '1px solid #222255', borderBottom: '2px solid #333366' }}>VIV</th>
                    <th style={{ width: 100, textAlign: 'center', padding: '2px 4px', borderBottom: '2px solid #333366' }}>CAN</th>
                  </tr>
                </thead>
                <tbody>
                  {inPickMode ? (
                    <PickerRows
                      candidates={candidates}
                      slotPos={slotPos!}
                      currentSlotPlayerId={currentSlotPlayerId}
                      selectedSlot={selectedSlot!}
                      assignToSlot={assignToSlot}
                      slotOfPlayer={slotOfPlayer}
                    />
                  ) : (
                    <RosterRows
                      sortedPlayers={sortedPlayers}
                      slots={slots}
                      slotOfPlayer={slotOfPlayer}
                      selectedSlot={selectedSlot}
                      setSelectedSlot={setSelectedSlot}
                      togglePlayer={togglePlayer}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const CmdButton = ({ onClick, color, hoverBg, children }: { onClick: () => void; color: string; hoverBg: string; children: ReactNode }) => (
  <button
    onClick={onClick}
    style={{ fontSize: 11, border: `1px solid ${color}`, color, background: 'transparent', padding: '2px 8px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: 1 }}
    onMouseEnter={e => { (e.target as HTMLElement).style.background = hoverBg; (e.target as HTMLElement).style.color = '#000000'; }}
    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = color; }}
  >
    {children}
  </button>
);

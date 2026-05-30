import { useMemo, useState } from 'react';
import type { TeamTemplate } from '../data/mockTeams';
import { getPackTemplates } from '../data/packTeamBuilder';
import { usePack } from '../state/PackContext';
import { TeamSelector } from './TeamSelector';
import {
  MAX_TEAMS, MAX_GROUP_SIZE, MAX_LEGS,
  presetCopa, presetMundial, validateStageChain,
  type StageDraft,
} from '../store/tournamentStore';

interface Props {
  onConfirm: (
    name: string,
    selectedClubIds: string[],
    userClubId: string | null,
    stages: StageDraft[],
    transfersEnabled: boolean,
  ) => void;
  onBack: () => void;
}

// ── Formats (simple flow) ────────────────────────────────────────────────
type FormatId = 'copa' | 'liga' | 'mundial' | 'champions';

interface FormatDef {
  id: FormatId;
  label: string;
  desc: string;
  // Valid total-team counts for this format.
  validSizes: number[];
  buildStages: (n: number) => StageDraft[];
}

const FORMATS: FormatDef[] = [
  {
    id: 'copa',
    label: 'Copa',
    desc: 'Eliminatoria directa a partido único',
    validSizes: [4, 8, 16, 32, 64],
    buildStages: (n) => presetCopa(n),
  },
  {
    id: 'liga',
    label: 'Liga',
    desc: 'Todos contra todos, gana el primero',
    validSizes: [4, 6, 8, 10, 12, 14, 16],
    buildStages: (n) => [{ kind: 'liga', groupSize: n, advancePerGroup: 1 }],
  },
  {
    id: 'mundial',
    label: 'Mundial',
    desc: 'Grupos de 4, pasan los 2 mejores, eliminatorias',
    validSizes: [16, 32],
    buildStages: (n) => presetMundial(n),
  },
  {
    id: 'champions',
    label: 'Champions',
    desc: 'Grupos + eliminatorias a ida y vuelta',
    validSizes: [16, 32],
    buildStages: (n) => {
      const drafts: StageDraft[] = [{ kind: 'liga', groupSize: 4, advancePerGroup: 2 }];
      let s = (n / 4) * 2;
      while (s > 2) {
        drafts.push({ kind: 'ko', legs: 2 });
        s /= 2;
      }
      // Final to single leg
      drafts.push({ kind: 'ko', legs: 1 });
      return drafts;
    },
  },
];

export const TournamentSetupView = ({ onConfirm, onBack }: Props) => {
  const { pack } = usePack();
  const [name, setName] = useState('Torneo Custom');
  const [formatId, setFormatId] = useState<FormatId>('copa');
  const [size, setSize] = useState<number>(8);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [spectate, setSpectate] = useState(false);
  const [transfersEnabled, setTransfersEnabled] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [customStages, setCustomStages] = useState<StageDraft[]>([{ kind: 'ko', legs: 1 }]);

  const fmt = FORMATS.find(f => f.id === formatId)!;
  const stages = advanced ? customStages : fmt.buildStages(size);

  const templates = useMemo((): TeamTemplate[] => {
    if (!pack) return [];
    return getPackTemplates(pack).map(pt => ({
      id: pt.clubId,
      name: pt.name,
      colors: pt.colors ? [pt.colors.background, pt.colors.foreground] : undefined,
      playerCount: pt.playerCount,
      country: pt.countryCode || 'unknown',
    }));
  }, [pack]);

  const targetSize = advanced ? selected.size : size;
  const validation = useMemo(() => validateStageChain(targetSize, stages), [targetSize, stages]);

  const pickFormat = (id: FormatId) => {
    setFormatId(id);
    const newFmt = FORMATS.find(f => f.id === id)!;
    if (!newFmt.validSizes.includes(size)) {
      setSize(newFmt.validSizes[0]);
      setSelected(new Set());
      setUserClubId(null);
    }
  };

  const pickSize = (n: number) => {
    setSize(n);
    setSelected(new Set());
    setUserClubId(null);
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (userClubId === id) setUserClubId(null);
      } else if (next.size < (advanced ? MAX_TEAMS : size)) {
        next.add(id);
        if (!userClubId && !spectate) setUserClubId(id);
      }
      return next;
    });

  const selectedList = templates.filter(t => selected.has(t.id));
  const reachedTarget = advanced ? selected.size >= 2 : selected.size === size;
  const canConfirm = validation.ok && reachedTarget && (spectate || !!userClubId);

  // Advanced stage editors
  const addStage = (kind: 'liga' | 'ko') => {
    if (kind === 'liga') setCustomStages(prev => [...prev, { kind: 'liga', groupSize: 4, advancePerGroup: 2 }]);
    else setCustomStages(prev => [...prev, { kind: 'ko', legs: 1 }]);
  };
  const removeStage = (idx: number) => setCustomStages(prev => prev.filter((_, i) => i !== idx));
  const updateStage = (idx: number, patch: Partial<StageDraft>) =>
    setCustomStages(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">Crear torneo</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
          Volver
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Nombre</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-vga-black border-2 border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow"
          />
        </div>

        {/* Simple format picker */}
        {!advanced && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Formato</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FORMATS.map(f => {
                  const active = f.id === formatId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => pickFormat(f.id)}
                      className={`p-3 text-left border-2 ${active
                        ? 'bg-vga-yellow text-vga-black border-vga-bright-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}
                    >
                      <div className={`text-[12px] uppercase font-bold ${active ? '' : 'text-vga-yellow'}`}>{f.label}</div>
                      <div className={`text-[8px] mt-1 ${active ? 'text-vga-black' : 'text-vga-gray'}`}>{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team count */}
            <div className="flex flex-col gap-2">
              <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Equipos</label>
              <div className="flex gap-2 flex-wrap">
                {fmt.validSizes.map(n => (
                  <button
                    key={n}
                    onClick={() => pickSize(n)}
                    className={`px-3 py-2 text-[10px] uppercase font-bold border-2 ${size === n
                      ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
                      : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Advanced stage builder */}
        {advanced && (
          <div className="border-2 border-vga-blue bg-vga-black p-3 flex flex-col gap-2">
            <div className="text-vga-cyan text-[9px] uppercase tracking-widest">Fases (avanzado)</div>
            {customStages.map((s, idx) => {
              const io = validation.stageIO[idx];
              return (
                <div key={idx} className="border border-vga-blue p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-vga-yellow text-[9px] uppercase font-bold">Fase {idx + 1} — {s.kind === 'liga' ? 'Liga' : 'Eliminatoria'}</span>
                    <div className="flex gap-1">
                      <button onClick={() => updateStage(idx, s.kind === 'liga' ? { kind: 'ko', legs: 1 } : { kind: 'liga', groupSize: 4, advancePerGroup: 2 })} className="px-2 py-0.5 text-[8px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow">
                        Cambiar tipo
                      </button>
                      <button onClick={() => removeStage(idx)} className="px-2 py-0.5 text-[8px] uppercase border border-vga-red bg-vga-black text-vga-light-red hover:bg-vga-red hover:text-vga-bright-white">
                        Quitar
                      </button>
                    </div>
                  </div>
                  {s.kind === 'liga' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Tamaño grupo" min={2} max={MAX_GROUP_SIZE} value={s.groupSize ?? 4} onChange={v => updateStage(idx, { groupSize: v })} />
                      <NumField label="Clasifican" min={1} max={Math.max(1, (s.groupSize ?? 4) - 1)} value={s.advancePerGroup ?? 1} onChange={v => updateStage(idx, { advancePerGroup: v })} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 items-end">
                      <NumField label="Partidos" min={1} max={MAX_LEGS} value={s.legs ?? 1} onChange={v => updateStage(idx, { legs: Math.max(1, Math.min(MAX_LEGS, v)) as 1 | 2 | 3 | 4 })} />
                      {(s.legs ?? 1) >= 2 && (
                        <label className="flex items-center gap-2 text-vga-bright-white text-[8px] uppercase">
                          <input type="checkbox" checked={!!s.awayGoalsRule} onChange={e => updateStage(idx, { awayGoalsRule: e.target.checked })} />
                          Gol visitante
                        </label>
                      )}
                    </div>
                  )}
                  <div className="text-[8px] text-vga-gray uppercase">{io ? `${io.input} → ${io.output}` : '—'}</div>
                </div>
              );
            })}
            <div className="flex gap-2 mt-1">
              <button onClick={() => addStage('liga')} className="px-3 py-1 text-[9px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow">+ Liga</button>
              <button onClick={() => addStage('ko')} className="px-3 py-1 text-[9px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow">+ Eliminatoria</button>
            </div>
          </div>
        )}

        {/* Options + advanced toggle */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          <label className="flex items-center gap-2 text-vga-bright-white text-[9px] uppercase">
            <input type="checkbox" checked={spectate} onChange={e => { setSpectate(e.target.checked); if (e.target.checked) setUserClubId(null); }} />
            Espectador
          </label>
          <label className="flex items-center gap-2 text-vga-bright-white text-[9px] uppercase">
            <input type="checkbox" checked={transfersEnabled} onChange={e => setTransfersEnabled(e.target.checked)} />
            Permitir fichajes
          </label>
          <button
            onClick={() => setAdvanced(v => !v)}
            className="ml-auto px-3 py-1 text-[8px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow"
          >
            {advanced ? '← Volver a simple' : 'Modo avanzado'}
          </button>
        </div>

        {!validation.ok && (
          <div className="text-vga-light-red text-[8px] uppercase border border-vga-light-red bg-vga-black p-2">
            {validation.reason}
          </div>
        )}

        {/* Team picker */}
        <TeamSelector
          templates={templates}
          selected={selected}
          onToggle={toggle}
          maxTeams={advanced ? MAX_TEAMS : size}
        />

        {/* Choose your team */}
        {!spectate && selectedList.length > 0 && (
          <div className="border-2 border-vga-blue p-2 bg-vga-black">
            <div className="text-vga-cyan text-[8px] uppercase tracking-widest mb-1">Tu equipo</div>
            <div className="flex flex-wrap gap-1">
              {selectedList.map(t => {
                const isMine = userClubId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setUserClubId(t.id)}
                    className={`px-2 py-1 text-[9px] uppercase border-2 ${isMine
                      ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}
                  >
                    {isMine ? '★ ' : ''}{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t-2 border-vga-blue pt-2">
          <div className="text-[9px] text-vga-bright-white uppercase">
            {selected.size}/{advanced ? '—' : size} equipos
            {spectate ? ' · espectador' : userClubId ? ' · listo' : reachedTarget ? ' · elige tu equipo' : ''}
          </div>
          <button
            onClick={() => onConfirm(name.trim() || 'Torneo', [...selected], spectate ? null : userClubId, stages, transfersEnabled)}
            disabled={!canConfirm}
            className={`px-4 py-2 text-[10px] uppercase font-bold border-2 ${canConfirm
              ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
              : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
          >
            Empezar torneo
          </button>
        </div>
      </div>
    </div>
  );
};

const NumField = ({ label, min, max, value, onChange }: {
  label: string; min: number; max: number; value: number; onChange: (v: number) => void;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-vga-gray text-[7px] uppercase tracking-widest">{label}</span>
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">−</button>
      <span className="text-vga-bright-white font-mono text-[10px] min-w-[40px] text-center">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">+</button>
    </div>
  </div>
);

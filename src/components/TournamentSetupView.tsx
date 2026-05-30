import { useMemo, useState } from 'react';
import type { TeamTemplate } from '../data/mockTeams';
import { getPackTemplates } from '../data/packTeamBuilder';
import { usePack } from '../state/PackContext';
import { TeamSelector } from './TeamSelector';
import {
  MAX_TEAMS, MAX_GROUP_SIZE, MAX_LEGS,
  presetCopa, presetMundial,
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

// ── Simple format presets ────────────────────────────────────────────────
type FormatId = 'copa' | 'liga' | 'mundial' | 'champions';

interface FormatDef {
  id: FormatId;
  label: string;
  desc: string;
  validSizes: number[];
  buildStages: (n: number) => StageDraft[];
}

const FORMATS: FormatDef[] = [
  { id: 'copa',      label: 'Copa',      desc: 'Eliminatoria directa, partido único',         validSizes: [4, 8, 16, 32, 64, 128], buildStages: presetCopa },
  { id: 'liga',      label: 'Liga',      desc: 'Todos contra todos, gana el primero',          validSizes: [4, 6, 8, 10, 12, 14, 16], buildStages: (n) => [{ kind: 'liga', groupSize: n, advancePerGroup: 1 }] },
  { id: 'mundial',   label: 'Mundial',   desc: 'Grupos de 4, top 2 a eliminatorias',           validSizes: [16, 32, 64], buildStages: presetMundial },
  { id: 'champions', label: 'Champions', desc: 'Grupos + eliminatorias ida y vuelta',          validSizes: [16, 32, 64], buildStages: (n) => {
    const drafts: StageDraft[] = [{ kind: 'liga', groupSize: 4, advancePerGroup: 2 }];
    let s = (n / 4) * 2;
    while (s > 2) { drafts.push({ kind: 'ko', legs: 2 }); s /= 2; }
    drafts.push({ kind: 'ko', legs: 1 });
    return drafts;
  } },
];

// ── Compute "teams entering" each stage given a chain ────────────────────
const stageIO = (totalTeams: number, drafts: StageDraft[]): { input: number; output: number; ok: boolean; reason?: string }[] => {
  const io: { input: number; output: number; ok: boolean; reason?: string }[] = [];
  let cursor = totalTeams;
  for (const d of drafts) {
    if (d.kind === 'liga') {
      const gs = d.groupSize ?? 0;
      const adv = d.advancePerGroup ?? 0;
      if (gs < 2 || gs > MAX_GROUP_SIZE) { io.push({ input: cursor, output: 0, ok: false, reason: `Grupo de ${gs} no permitido.` }); break; }
      if (cursor % gs !== 0) { io.push({ input: cursor, output: 0, ok: false, reason: `${cursor} no se reparte en grupos de ${gs}.` }); break; }
      if (adv < 1 || adv >= gs) { io.push({ input: cursor, output: 0, ok: false, reason: `Clasifican fuera de rango.` }); break; }
      const groups = cursor / gs;
      const out = groups * adv;
      io.push({ input: cursor, output: out, ok: true });
      cursor = out;
    } else {
      const legs = d.legs ?? 1;
      if (legs < 1 || legs > MAX_LEGS) { io.push({ input: cursor, output: 0, ok: false, reason: `Partidos fuera de rango.` }); break; }
      if (cursor % 2 !== 0) { io.push({ input: cursor, output: 0, ok: false, reason: `${cursor} equipos: necesitas un nº par.` }); break; }
      const out = cursor / 2;
      io.push({ input: cursor, output: out, ok: true });
      cursor = out;
    }
  }
  return io;
};

// ── Suggested divisors for group size, given a team count ───────────────
const divisorsForGroup = (n: number): number[] => {
  const out: number[] = [];
  for (let d = 2; d <= Math.min(MAX_GROUP_SIZE, n); d++) {
    if (n % d === 0) out.push(d);
  }
  return out;
};

export const TournamentSetupView = ({ onConfirm, onBack }: Props) => {
  const { pack } = usePack();
  const [name, setName] = useState('Torneo Custom');
  const [formatId, setFormatId] = useState<FormatId>('copa');
  const [size, setSize] = useState<number>(8);
  const [advTotal, setAdvTotal] = useState<number>(16);
  const [advStages, setAdvStages] = useState<StageDraft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userClubId, setUserClubId] = useState<string | null>(null);
  const [spectate, setSpectate] = useState(false);
  const [transfersEnabled, setTransfersEnabled] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const fmt = FORMATS.find(f => f.id === formatId)!;
  const stages = advanced ? advStages : fmt.buildStages(size);
  const targetSize = advanced ? advTotal : size;
  const io = useMemo(() => stageIO(targetSize, stages), [targetSize, stages]);
  const lastOutput = io.length ? io[io.length - 1].output : targetSize;
  const chainComplete = io.length > 0 && io.every(s => s.ok) && lastOutput === 1;
  const chainBlocker = io.find(s => !s.ok);

  // For showing the "next round" config card
  const nextRoundInput = io.length === 0 ? targetSize : io[io.length - 1].output;
  const canAddMore = io.length === 0 || (io.every(s => s.ok) && lastOutput > 1);

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

  const pickFormat = (id: FormatId) => {
    setFormatId(id);
    const newFmt = FORMATS.find(f => f.id === id)!;
    if (!newFmt.validSizes.includes(size)) {
      setSize(newFmt.validSizes[0]);
      setSelected(new Set()); setUserClubId(null);
    }
  };

  const pickSize = (n: number) => { setSize(n); setSelected(new Set()); setUserClubId(null); };

  const setAdvTotalAndReset = (n: number) => {
    setAdvTotal(n);
    setAdvStages([]);
    setSelected(new Set()); setUserClubId(null);
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (userClubId === id) setUserClubId(null); }
      else if (next.size < targetSize) { next.add(id); if (!userClubId && !spectate) setUserClubId(id); }
      return next;
    });

  const selectedList = templates.filter(t => selected.has(t.id));
  const reachedTarget = selected.size === targetSize;
  const canConfirm = chainComplete && reachedTarget && (spectate || !!userClubId);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <h2 className="text-vga-yellow text-xs uppercase font-bold">Crear torneo</h2>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">
          Volver
        </button>
      </div>

      <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col gap-1">
          <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} className="bg-vga-black border-2 border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow" />
        </div>

        {!advanced && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Formato</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FORMATS.map(f => {
                  const active = f.id === formatId;
                  return (
                    <button key={f.id} onClick={() => pickFormat(f.id)}
                      className={`p-3 text-left border-2 ${active
                        ? 'bg-vga-yellow text-vga-black border-vga-bright-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}>
                      <div className={`text-[12px] uppercase font-bold ${active ? '' : 'text-vga-yellow'}`}>{f.label}</div>
                      <div className={`text-[8px] mt-1 ${active ? 'text-vga-black' : 'text-vga-gray'}`}>{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Equipos</label>
              <div className="flex gap-2 flex-wrap">
                {fmt.validSizes.map(n => (
                  <button key={n} onClick={() => pickSize(n)} className={`px-3 py-2 text-[10px] uppercase font-bold border-2 ${size === n ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'}`}>{n}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {advanced && (
          <div className="border-2 border-vga-blue bg-vga-black p-3 flex flex-col gap-3">
            <div className="text-vga-cyan text-[9px] uppercase tracking-widest">Modo avanzado</div>
            <div className="text-vga-bright-white text-[9px] leading-relaxed">
              1. Elige cuántos equipos juegan el torneo en total.
              2. Añade rondas una a una. Cada ronda reduce el nº de equipos hasta llegar a 1 ganador.
              3. Por ejemplo: 16 equipos → liga con grupos de 4 (clasifican 2) deja 8 → eliminatoria a 1 partido deja 4 → otra eliminatoria deja 2 → la final deja 1.
            </div>

            {/* Total teams */}
            <div className="flex flex-col gap-1">
              <label className="text-vga-cyan text-[8px] uppercase tracking-widest">Equipos totales (máx {MAX_TEAMS})</label>
              <div className="flex items-center gap-1">
                <button onClick={() => setAdvTotalAndReset(Math.max(2, advTotal - 1))} className="bg-vga-gray text-vga-black px-2 py-1 text-[10px] border border-vga-black">−</button>
                <span className="text-vga-yellow font-mono text-[12px] min-w-[60px] text-center font-bold">{advTotal}</span>
                <button onClick={() => setAdvTotalAndReset(Math.min(MAX_TEAMS, advTotal + 1))} className="bg-vga-gray text-vga-black px-2 py-1 text-[10px] border border-vga-black">+</button>
                <span className="text-vga-gray text-[8px] uppercase ml-3">Saltos rápidos:</span>
                {[8, 16, 32, 64, 128].filter(n => n <= MAX_TEAMS).map(n => (
                  <button key={n} onClick={() => setAdvTotalAndReset(n)} className="px-2 py-0.5 text-[8px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow">{n}</button>
                ))}
              </div>
            </div>

            {/* Stage list */}
            <div className="flex flex-col gap-2">
              {advStages.map((s, idx) => {
                const stage = io[idx];
                const isLast = idx === advStages.length - 1;
                const isFinal = stage?.output === 1;
                const isSemi = stage?.output === 2;
                const kindLabel = isFinal ? 'Final' : s.kind === 'liga' ? 'Liga / grupos' : 'Eliminatoria';
                const roundLabel = isFinal ? 'Final' : isSemi ? 'Semifinales' : `Ronda ${idx + 1}`;
                return (
                  <div key={idx} className={`border-2 ${isFinal ? 'border-vga-yellow' : stage?.ok ? 'border-vga-blue' : 'border-vga-light-red'} bg-vga-black p-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-vga-yellow text-[10px] uppercase font-bold">
                        {roundLabel}{isFinal ? '' : ` · ${kindLabel}`}
                      </span>
                      {isLast && (
                        <button onClick={() => setAdvStages(prev => prev.slice(0, -1))}
                          className="px-2 py-0.5 text-[8px] uppercase border border-vga-red bg-vga-black text-vga-light-red hover:bg-vga-red hover:text-vga-bright-white">
                          Quitar
                        </button>
                      )}
                    </div>
                    <div className="text-[8px] text-vga-gray uppercase mt-1">
                      {stage ? `${stage.input} equipos → ${stage.output}${isFinal ? ' campeón' : ''}` : '—'}
                      {!stage?.ok && stage?.reason ? ` · ${stage.reason}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next round configurator */}
            {canAddMore && (
              <NextRoundCard
                input={nextRoundInput}
                onAdd={(draft) => setAdvStages(prev => [...prev, draft])}
              />
            )}

            {chainComplete && (
              <div className="border-2 border-vga-light-green bg-vga-black p-2 text-vga-light-green text-[9px] uppercase">
                ✓ Cadena completa: {io.length} ronda{io.length === 1 ? '' : 's'}, acaba con 1 campeón.
              </div>
            )}
            {chainBlocker && (
              <div className="border-2 border-vga-light-red bg-vga-black p-2 text-vga-light-red text-[8px] uppercase">
                {chainBlocker.reason}
              </div>
            )}
            {!chainComplete && !chainBlocker && io.length > 0 && lastOutput > 1 && (
              <div className="text-vga-cyan text-[9px] uppercase">
                Quedan {lastOutput} equipos. Añade más rondas hasta llegar a 1.
              </div>
            )}
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
          <button onClick={() => setAdvanced(v => !v)}
            className="ml-auto px-3 py-1 text-[8px] uppercase border border-vga-blue bg-vga-black text-vga-cyan hover:border-vga-yellow">
            {advanced ? '← Volver a simple' : 'Modo avanzado'}
          </button>
        </div>

        <TeamSelector templates={templates} selected={selected} onToggle={toggle} maxTeams={targetSize} />

        {!spectate && selectedList.length > 0 && (
          <div className="border-2 border-vga-blue p-2 bg-vga-black">
            <div className="text-vga-cyan text-[8px] uppercase tracking-widest mb-1">Tu equipo</div>
            <div className="flex flex-wrap gap-1">
              {selectedList.map(t => {
                const isMine = userClubId === t.id;
                return (
                  <button key={t.id} onClick={() => setUserClubId(t.id)}
                    className={`px-2 py-1 text-[9px] uppercase border-2 ${isMine
                      ? 'bg-vga-yellow text-vga-black border-vga-bright-white font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}>
                    {isMine ? '★ ' : ''}{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t-2 border-vga-blue pt-2">
          <div className="text-[9px] text-vga-bright-white uppercase">
            {selected.size}/{targetSize} equipos
            {spectate ? ' · espectador' : userClubId ? ' · listo' : reachedTarget ? ' · elige tu equipo' : ''}
            {advanced && !chainComplete ? ' · termina las rondas' : ''}
          </div>
          <button
            onClick={() => onConfirm(name.trim() || 'Torneo', [...selected], spectate ? null : userClubId, stages, transfersEnabled)}
            disabled={!canConfirm}
            className={`px-4 py-2 text-[10px] uppercase font-bold border-2 ${canConfirm
              ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
              : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}>
            Empezar torneo
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Next round configurator (advanced mode) ─────────────────────────────
const NextRoundCard = ({ input, onAdd }: { input: number; onAdd: (d: StageDraft) => void }) => {
  // The "Final" is the special case of input = 2 — it's always a KO tie, just
  // configure the leg count + away-goals rule.
  const isFinal = input === 2;
  const [kind, setKind] = useState<'liga' | 'ko'>(input % 2 === 0 ? 'ko' : 'liga');
  const divisors = divisorsForGroup(input);
  const [groupSize, setGroupSize] = useState<number>(divisors[0] ?? 2);
  const [advPerGroup, setAdvPerGroup] = useState<number>(1);
  const [legs, setLegs] = useState<1 | 2 | 3 | 4>(1);
  const [awayGoals, setAwayGoals] = useState(false);

  // Recompute valid divisors when input changes — clamp current pick.
  const safeGs = divisors.includes(groupSize) ? groupSize : (divisors[0] ?? 2);
  const safeAdv = Math.min(Math.max(1, advPerGroup), Math.max(1, safeGs - 1));

  const projOut = isFinal ? 1 : (kind === 'liga' ? (input / safeGs) * safeAdv : input / 2);

  const canKo = input % 2 === 0;
  const canLiga = !isFinal && divisors.length > 0;
  const effectiveKind: 'liga' | 'ko' = isFinal ? 'ko' : kind;

  const submit = () => {
    if (effectiveKind === 'liga') onAdd({ kind: 'liga', groupSize: safeGs, advancePerGroup: safeAdv });
    else {
      const finalLegs = (isFinal ? Math.min(legs, 2) : legs) as 1 | 2 | 3 | 4;
      onAdd({ kind: 'ko', legs: finalLegs, awayGoalsRule: finalLegs >= 2 ? awayGoals : undefined });
    }
  };

  return (
    <div className={`border-2 ${isFinal ? 'border-vga-yellow shadow-[3px_3px_0px_0px_rgba(255,255,85,0.4)]' : 'border-vga-yellow'} bg-vga-blue/10 p-3 flex flex-col gap-2`}>
      <div className="text-vga-yellow text-[10px] uppercase font-bold">
        {isFinal ? 'Final · 2 equipos disponibles' : `Siguiente ronda · ${input} equipos disponibles`}
      </div>

      {!isFinal && (
        <div className="flex gap-2">
          <button disabled={!canLiga} onClick={() => setKind('liga')}
            className={`px-3 py-1.5 text-[10px] uppercase font-bold border-2 ${kind === 'liga' && canLiga ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'} ${!canLiga ? 'opacity-40' : ''}`}>
            Liga / grupos
          </button>
          <button disabled={!canKo} onClick={() => setKind('ko')}
            className={`px-3 py-1.5 text-[10px] uppercase font-bold border-2 ${kind === 'ko' && canKo ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-cyan border-vga-blue hover:border-vga-yellow'} ${!canKo ? 'opacity-40' : ''}`}>
            Eliminatoria
          </button>
        </div>
      )}

      {effectiveKind === 'liga' && canLiga && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-vga-gray text-[7px] uppercase tracking-widest">Tamaño grupo</span>
            <div className="flex gap-1 flex-wrap">
              {divisors.map(d => (
                <button key={d} onClick={() => { setGroupSize(d); setAdvPerGroup(Math.min(advPerGroup, d - 1)); }}
                  className={`px-2 py-1 text-[9px] uppercase font-bold border ${safeGs === d ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}>
                  {d}
                </button>
              ))}
            </div>
            <span className="text-[7px] text-vga-gray uppercase">{input / safeGs} grupo{(input / safeGs) === 1 ? '' : 's'} de {safeGs}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-vga-gray text-[7px] uppercase tracking-widest">Clasifican por grupo</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setAdvPerGroup(v => Math.max(1, v - 1))} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">−</button>
              <span className="text-vga-bright-white font-mono text-[10px] min-w-[40px] text-center">{safeAdv}</span>
              <button onClick={() => setAdvPerGroup(v => Math.min(safeGs - 1, v + 1))} className="bg-vga-gray text-vga-black px-2 py-0.5 text-[10px] border border-vga-black">+</button>
            </div>
          </div>
        </div>
      )}

      {effectiveKind === 'ko' && canKo && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-vga-gray text-[7px] uppercase tracking-widest">{isFinal ? 'Partidos de la final' : 'Partidos por eliminatoria'}</span>
            <div className="flex gap-1">
              {(isFinal ? [1, 2] : [1, 2, 3, 4]).map(n => (
                <button key={n} onClick={() => setLegs(n as 1 | 2 | 3 | 4)}
                  className={`px-3 py-1 text-[10px] uppercase font-bold border ${legs === n ? 'bg-vga-yellow text-vga-black border-vga-bright-white' : 'bg-vga-black text-vga-bright-white border-vga-blue hover:border-vga-yellow'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {legs >= 2 && (
            <label className="flex items-center gap-2 text-vga-bright-white text-[9px] uppercase">
              <input type="checkbox" checked={awayGoals} onChange={e => setAwayGoals(e.target.checked)} />
              Gol visitante
            </label>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-vga-blue pt-2 mt-1">
        <span className="text-vga-cyan text-[9px] uppercase">
          {isFinal ? 'El ganador es el campeón' : `Pasan ${projOut} equipo${projOut === 1 ? '' : 's'}`}
        </span>
        <button onClick={submit}
          className="bg-vga-light-green text-vga-black px-3 py-1.5 text-[10px] uppercase font-bold border-2 border-vga-bright-white hover:bg-vga-bright-white">
          {isFinal ? 'Configurar final' : '+ Añadir ronda'}
        </button>
      </div>
    </div>
  );
};

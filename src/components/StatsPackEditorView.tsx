import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pack, StatsPack } from '../types/game.d.ts';
import type { StatsEntry } from '../data/statsIndex';
import {
  loadEditingStatsPack, saveEditingStatsPack, downloadStatsPack,
  generateStatsPackFromBase,
  updateStatsMacro, deleteStatsEntry,
} from '../data/packEditor';

interface Props {
  basePack: Pack | null;     // optional: base pack for source_id → player name lookup
  onBack: () => void;
}

type MacroKey = 'pa' | 'sh' | 'ps' | 'dr' | 'de' | 'ph' | 'gk';
const MACRO_LABEL: Record<MacroKey, string> = {
  pa: 'PAS', sh: 'TIR', ps: 'PSE', dr: 'DRI', de: 'DEF', ph: 'FIS', gk: 'POR',
};
const MACRO_KEYS: MacroKey[] = ['pa', 'sh', 'ps', 'dr', 'de', 'ph', 'gk'];

export const StatsPackEditorView = ({ basePack, onBack }: Props) => {
  const [sp, setSp] = useState<StatsPack | null>(() => loadEditingStatsPack());
  const [search, setSearch] = useState('');
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveEditingStatsPack(sp); }, [sp]);

  // Player name lookup by source_id (if we have a base pack).
  const nameBySid = useMemo(() => {
    const m = new Map<number, string>();
    if (basePack) for (const p of basePack.players) m.set(p.source_id, `${p.first_name} ${p.last_name}`);
    return m;
  }, [basePack]);

  const reset = () => { setSp(null); setSelectedSid(null); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || !parsed.meta || !parsed.entries) {
        setLoadError('No parece un stats pack válido.');
      } else {
        setSp(parsed as StatsPack);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al leer fichero');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = () => {
    if (!sp) return;
    const fname = `${(sp.meta.name || 'openfutbol-stats').replace(/[^a-z0-9_-]+/gi, '_')}.stats.json`;
    downloadStatsPack(sp, fname);
  };

  const handleGenerate = () => {
    if (!basePack) return;
    const generated = generateStatsPackFromBase(basePack, `Stats — ${basePack.meta.name}`);
    setSp(generated);
    setSelectedSid(null);
  };

  if (!sp) {
    return (
      <div className="w-full max-w-2xl flex flex-col gap-3 animate-in fade-in duration-300">
        <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">Editor de Stats Packs</h2>
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">Volver</button>
        </div>
        <div className="bg-vga-black border-4 border-vga-blue p-4 flex flex-col gap-3">
          <div className="text-vga-bright-white text-[10px] uppercase">Carga o genera un stats pack</div>
          <button
            onClick={handleGenerate}
            disabled={!basePack}
            className={`px-4 py-3 text-[10px] uppercase font-bold border-2 ${basePack
              ? 'bg-vga-light-green text-vga-black border-vga-bright-white hover:bg-vga-bright-white'
              : 'bg-vga-gray text-vga-black border-vga-gray opacity-60 cursor-not-allowed'}`}
          >
            Generar desde pack base ({basePack?.players.length ?? 0} jugadores)
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-4 py-3 text-[10px] uppercase font-bold border-2 bg-vga-yellow text-vga-black border-vga-bright-white hover:bg-vga-bright-white">
            Cargar stats pack (.json)
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          {loadError && (
            <div className="border border-vga-light-red bg-vga-black p-2 text-vga-light-red text-[8px] uppercase">{loadError}</div>
          )}
          <div className="text-vga-gray text-[8px] uppercase mt-2">
            Generar usa CA + posición del pack base como semilla y produce macros aleatorios alrededor del overall.
          </div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(sp.entries) as [string, StatsEntry][];
  const q = search.trim().toLowerCase();
  const filteredEntries = q
    ? entries.filter(([sid, e]) => {
        const name = nameBySid.get(Number(sid)) ?? '';
        return name.toLowerCase().includes(q) || sid.includes(q) || String(e.ov).includes(q);
      })
    : entries;

  const selected = selectedSid ? sp.entries[selectedSid] as StatsEntry | undefined : null;

  return (
    <div className="w-full max-w-6xl flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-2">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">Editor de Stats Packs</h2>
          <span className="text-vga-bright-white text-[9px] uppercase">{sp.meta.name}</span>
          <span className="text-vga-gray text-[9px]">· {Object.keys(sp.entries).length} entradas</span>
        </div>
        <div className="flex gap-1">
          <button onClick={handleExport} className="bg-vga-light-green text-vga-black px-3 py-1 text-[9px] uppercase font-bold border border-vga-black hover:bg-vga-bright-white">Exportar</button>
          <button onClick={() => { if (confirm('¿Descartar el stats pack en edición?')) reset(); }} className="bg-vga-gray text-vga-black px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-white">Cambiar pack</button>
          <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red">Salir</button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-vga-black border-2 border-vga-blue p-2">
        <span className="text-vga-cyan text-[8px] uppercase tracking-widest">Nombre del stats pack</span>
        <input
          value={sp.meta.name}
          onChange={e => setSp(prev => prev ? { ...prev, meta: { ...prev.meta, name: e.target.value } } : prev)}
          className="flex-1 bg-vga-black border border-vga-blue text-vga-bright-white text-[10px] px-2 py-1 outline-none focus:border-vga-yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* List */}
        <div className="bg-vga-black border-2 border-vga-blue flex flex-col">
          <div className="p-2 border-b border-vga-blue">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, source_id u overall..."
              className="w-full bg-vga-black border border-vga-blue text-vga-bright-white text-[9px] px-2 py-1 outline-none focus:border-vga-yellow"
            />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-[9px]">
              <thead className="bg-vga-blue/20 text-vga-cyan sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">SID</th>
                  <th className="text-left px-2 py-1">Jugador</th>
                  <th className="text-right px-2 py-1">OV</th>
                  {MACRO_KEYS.map(k => <th key={k} className="text-right px-2 py-1">{MACRO_LABEL[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(([sid, e]) => {
                  const name = nameBySid.get(Number(sid)) ?? '—';
                  const isSel = selectedSid === sid;
                  return (
                    <tr
                      key={sid}
                      onClick={() => setSelectedSid(sid)}
                      className={`${isSel ? 'bg-vga-yellow/20' : ''} cursor-pointer hover:bg-vga-blue/20 border-b border-vga-blue/30`}
                    >
                      <td className="px-2 py-1 text-vga-gray font-mono">{sid}</td>
                      <td className="px-2 py-1 text-vga-bright-white">{name}</td>
                      <td className="px-2 py-1 text-right text-vga-yellow font-bold">{e.ov}</td>
                      {MACRO_KEYS.map(k => (
                        <td key={k} className="px-2 py-1 text-right text-vga-cyan font-mono">{e.macro[k] ?? '—'}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editor side */}
        <div className="bg-vga-black border-2 border-vga-blue p-3 flex flex-col gap-2 max-h-[70vh] overflow-auto">
          {selected && selectedSid ? (
            <>
              <div className="flex items-center justify-between border-b border-vga-blue pb-1">
                <span className="text-vga-yellow text-[10px] uppercase font-bold">
                  {nameBySid.get(Number(selectedSid)) ?? `SID ${selectedSid}`}
                </span>
                <button
                  onClick={() => { setSp(prev => prev ? deleteStatsEntry(prev, selectedSid) : prev); setSelectedSid(null); }}
                  className="bg-vga-red text-vga-bright-white px-2 py-0.5 text-[8px] uppercase font-bold border border-vga-black hover:bg-vga-light-red"
                >
                  Borrar
                </button>
              </div>
              <div className="text-vga-gray text-[7px] uppercase tracking-widest mb-1">Overall</div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={20} max={99} value={selected.ov}
                  onChange={e => setSp(prev => prev ? {
                    ...prev,
                    entries: { ...prev.entries, [selectedSid]: { ...selected, ov: parseInt(e.target.value, 10) } as unknown as Record<string, unknown> },
                  } : prev)}
                  className="flex-1"
                />
                <span className="text-vga-yellow font-mono text-[12px] font-bold min-w-[36px] text-center">{selected.ov}</span>
              </div>
              <div className="text-vga-gray text-[7px] uppercase tracking-widest mt-2">Macros (20-99)</div>
              {MACRO_KEYS.map(k => (
                <div key={k} className="grid grid-cols-[60px_1fr_36px] items-center gap-2">
                  <span className="text-vga-cyan text-[9px] uppercase">{MACRO_LABEL[k]}</span>
                  <input
                    type="range" min={20} max={99}
                    value={selected.macro[k] ?? 50}
                    onChange={e => setSp(prev => prev ? updateStatsMacro(prev, selectedSid, k, parseInt(e.target.value, 10)) : prev)}
                    className="w-full"
                  />
                  <span className="text-vga-bright-white font-mono text-[10px] text-center">{selected.macro[k] ?? '—'}</span>
                </div>
              ))}
              <div className="text-vga-gray text-[8px] uppercase mt-2">
                {basePack ? 'Edita los macros para afinar cómo rinde el jugador. Las micros se mantienen.' : 'Sin pack base cargado, no hay nombres — solo source_id.'}
              </div>
            </>
          ) : (
            <div className="text-vga-gray text-[8px] uppercase">Selecciona una entrada para editarla.</div>
          )}
        </div>
      </div>
    </div>
  );
};

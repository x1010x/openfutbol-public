import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LeagueState } from '../store/leagueStore';
import { listSlots, loadSlot, setActiveSlot, deleteSlot, createSlotFromCurrent } from '../store/saveSlots';
import { encodeBackup, decodeBackup } from '../utils/backupUtils';

interface Props {
  mode: 'classic' | 'promanager';
  onClose: () => void;
  onLoad: (state: LeagueState) => void;
}

const MODE_LABEL: Record<Props['mode'], string> = {
  classic: 'PLAY',
  promanager: 'PRO MANAGER',
};

export const LoadGameModal = ({ mode, onClose, onLoad }: Props) => {
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const slots = useMemo(
    () => listSlots()
      .filter(s => (s.summary.gameMode ?? 'classic') === mode)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [mode, tick]
  );

  const handleExport = (id: string, name: string) => {
    const state = loadSlot(id);
    if (!state) { alert('No se pudo leer la partida.'); return; }
    try {
      const encoded = encodeBackup(JSON.stringify(state));
      const blob = new Blob([encoded], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const safe = name.replace(/[^a-z0-9._-]+/gi, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe || 'openfutbol_save'}.ofb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar la partida.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const decoded = decodeBackup(ev.target?.result as string);
        const parsed = JSON.parse(decoded) as LeagueState;
        if (!parsed || !Array.isArray(parsed.teams) || !parsed.stats || parsed.year === undefined) {
          alert('Archivo .ofb inválido.');
          return;
        }
        const fileMode = (parsed.gameMode ?? 'classic') === 'promanager' ? 'promanager' : 'classic';
        if (fileMode !== mode) {
          const ok = confirm(`Esta partida es de modo ${fileMode === 'promanager' ? 'PRO MANAGER' : 'PLAY'}. ¿Cargar igualmente?`);
          if (!ok) return;
        }
        const baseName = file.name.replace(/\.ofb$/i, '');
        const userTeamName = parsed.teams.find(t => t.id === parsed.userTeamId)?.name;
        const slotName = baseName || (userTeamName ? `Carrera de ${userTeamName}` : `Carrera ${parsed.year}`);
        try { createSlotFromCurrent(parsed, slotName); } catch { /* fall through to load */ }
        setTick(t => t + 1);
        onLoad(parsed);
      } catch {
        alert('No se pudo leer el archivo .ofb.');
      }
    };
    reader.readAsText(file);
  };

  const handleLoad = (id: string) => {
    const state = loadSlot(id);
    if (!state) { alert('No se pudo cargar la partida.'); return; }
    setActiveSlot(id);
    onLoad(state);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Borrar la partida "${name}"? No se puede deshacer.`)) return;
    deleteSlot(id);
    setTick(t => t + 1);
  };

  const fmtDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.82)' }}
      onClick={onClose}
    >
      <div
        className="of-card w-full max-w-2xl flex flex-col gap-3"
        style={{ borderColor: '#33f3ff', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-1 gap-2 flex-wrap" style={{ borderBottom: '1px solid rgba(51, 243, 255, 0.35)' }}>
          <h3 className="of-card-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            CARGAR · {MODE_LABEL[mode]}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => fileRef.current?.click()} className="of-btn-neon of-btn-neon--green" style={{ fontSize: 8, padding: '0.35rem 0.7rem' }}>
              IMPORTAR .OFB
            </button>
            <input ref={fileRef} type="file" accept=".ofb" onChange={handleImportFile} className="hidden" />
            <button onClick={onClose} className="of-btn-neon of-btn-neon--cyan" style={{ fontSize: 8, padding: '0.35rem 0.7rem' }}>
              CERRAR
            </button>
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="of-card-desc">No hay partidas guardadas en este modo.</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {slots.map(s => {
              const sum = s.summary;
              const meta = sum.userTeamName
                ? `${sum.userTeamName} · J${sum.currentJornada} · ${sum.seasonYear}`
                : `J${sum.currentJornada} · ${sum.seasonYear}`;
              return (
                <li key={s.id} className="flex items-center gap-3 p-2" style={{ background: 'rgba(9, 0, 20, 0.5)', border: '1px solid #44476a', clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="text-[10px] font-bold tracking-wider break-words leading-snug" style={{ color: '#33f3ff', textShadow: '0 0 5px rgba(51, 243, 255, 0.6)' }}>{s.name}</div>
                    <div className="of-card-desc">{meta}</div>
                    <div className="of-card-desc" style={{ fontSize: 12, opacity: 0.7 }}>Guardado: {fmtDate(s.updatedAt)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleLoad(s.id)} className="of-btn-neon of-btn-neon--green" style={{ fontSize: 9, padding: '0.4rem 0.7rem' }}>
                      CARGAR
                    </button>
                    <button onClick={() => handleExport(s.id, s.name)} className="of-btn-neon of-btn-neon--cyan" style={{ fontSize: 9, padding: '0.4rem 0.7rem' }}>
                      EXPORTAR
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="of-btn-neon of-btn-neon--red flex items-center justify-center"
                      style={{ padding: '0.4rem 0.55rem' }}
                      title="Borrar partida"
                      aria-label="Borrar partida"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
};

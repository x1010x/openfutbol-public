import { useState } from 'react';
import type { LeagueState } from '../store/leagueStore';
import { encodeBackup, decodeBackup } from '../utils/backupUtils';
import { useT } from '../i18n';
import { EngineSettingsView } from './EngineSettingsView';
import {
  listSlots, getActiveSlotId, loadSlot, saveSlot, renameSlot, deleteSlot, setActiveSlot,
  type SaveSlot,
} from '../store/saveSlots';

interface Props {
  league: LeagueState;
  onRestore: (newState: LeagueState) => void;
  onReset: () => void;
  onBack: () => void;
  onOpenPack?: () => void;
}

export const BackupView = ({ league, onRestore, onReset, onBack, onOpenPack }: Props) => {
  const t = useT();
  const [tab, setTab] = useState<'backup' | 'slots' | 'engine' | 'pack' | 'dev'>('slots');
  const [slots, setSlots] = useState<SaveSlot[]>(() => listSlots());
  const [activeId, setActiveIdState] = useState<string | null>(() => getActiveSlotId());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refreshSlots = () => { setSlots(listSlots()); setActiveIdState(getActiveSlotId()); };

  const handleLoadSlot = (slotId: string) => {
    if (slotId === activeId) return;
    if (!confirm('Tu partida actual se guardará y se cargará la elegida. ¿Continuar?')) return;
    if (activeId) { try { saveSlot(activeId, league); } catch { /* noop */ } }
    const data = loadSlot(slotId);
    if (!data) { alert('No se pudo cargar la partida.'); return; }
    setActiveSlot(slotId);
    onRestore(data);
    refreshSlots();
  };

  const handleRenameStart = (s: SaveSlot) => { setRenamingId(s.id); setRenameValue(s.name); };
  const handleRenameCommit = () => {
    if (renamingId && renameValue.trim()) {
      renameSlot(renamingId, renameValue.trim());
      setRenamingId(null); setRenameValue(''); refreshSlots();
    }
  };
  const handleDeleteSlot = (s: SaveSlot) => {
    if (!confirm(`¿Borrar la partida "${s.name}"? No se puede deshacer.`)) return;
    deleteSlot(s.id); refreshSlots();
    if (s.id === activeId) {
      const next = getActiveSlotId();
      if (next) { const data = loadSlot(next); if (data) onRestore(data); }
    }
  };
  const handleSaveCurrentAsNew = () => {
    const name = prompt('Nombre para la nueva partida guardada:', `Carrera ${league.year}`);
    if (!name) return;
    try {
      if (activeId) saveSlot(activeId, league);
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `s_${Date.now().toString(36)}`;
      saveSlot(id, league, name);
      setActiveSlot(id);
      refreshSlots();
    } catch (e) {
      alert('No se pudo guardar (puede que se haya llenado el almacenamiento). Exporta partidas viejas y bórralas.');
    }
  };

  const handleReset = () => {
    if (confirm(t('misc.confirmReset'))) {
      onReset();
    }
  };

  const handleHardReset = async () => {
    if (!confirm('Esto borrará TODO: liga, configuración, packs, caches. ¿Continuar?')) return;
    if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        const dbs = await (indexedDB.databases?.() ?? Promise.resolve([]));
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
        indexedDB.deleteDatabase('pcfurbo');
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (err) {
      console.error('Hard reset error:', err);
    }
    location.reload();
  };

  const handleExport = () => {
    try {
      const data = JSON.stringify(league);
      const encoded = encodeBackup(data);
      const blob = new Blob([encoded], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openfutbol_${league.year}_j${league.currentJornada}.ofb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(t('misc.backupError'));
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const decoded = decodeBackup(content);
        const parsed = JSON.parse(decoded);

        if (parsed.teams && parsed.stats && parsed.year !== undefined && Array.isArray(parsed.teams)) {
          if (confirm(t('misc.confirmImport'))) {
            onRestore(parsed);
            alert(t('misc.backupRestored'));
          }
        } else {
          alert(t('misc.backupInvalid'));
        }
      } catch (err) {
        alert(t('misc.backupReadError'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="bg-vga-blue p-2 border-2 border-vga-white flex justify-between items-center vga-panel">
        <div className="flex items-center gap-2">
          <h2 className="text-vga-yellow text-xs uppercase font-bold">{t('section.backup')}</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('slots')}
              className={`text-[7px] px-2 py-0.5 border font-bold uppercase ${tab === 'slots' ? 'bg-vga-magenta text-vga-bright-white border-vga-magenta' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
            >
              PARTIDAS
            </button>
            <button
              onClick={() => setTab('backup')}
              className={`text-[7px] px-2 py-0.5 border font-bold uppercase ${tab === 'backup' ? 'bg-vga-yellow text-vga-black border-vga-yellow' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
            >
              BACKUP
            </button>
            <button
              onClick={() => setTab('engine')}
              className={`text-[7px] px-2 py-0.5 border font-bold uppercase ${tab === 'engine' ? 'bg-vga-cyan text-vga-black border-vga-cyan' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
            >
              ENGINE
            </button>
            {onOpenPack && (
              <button
                onClick={() => setTab('pack')}
                className={`text-[7px] px-2 py-0.5 border font-bold uppercase ${tab === 'pack' ? 'bg-vga-green text-vga-black border-vga-green' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
              >
                PACK
              </button>
            )}
            <button
              onClick={() => setTab('dev')}
              className={`text-[7px] px-2 py-0.5 border font-bold uppercase ${tab === 'dev' ? 'bg-vga-red text-vga-bright-white border-vga-red' : 'text-vga-gray border-vga-gray hover:text-vga-bright-white hover:border-vga-bright-white'}`}
            >
              DEV
            </button>
          </div>
        </div>
        <button onClick={onBack} className="bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
          {t('btn.back')}
        </button>
      </div>

      {tab === 'slots' && (
        <div className="bg-vga-black border-4 border-vga-blue p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-vga-magenta text-[9px] font-bold uppercase tracking-widest border-b border-vga-blue pb-1">Partidas guardadas</h3>
          {slots.length === 0 && (
            <p className="text-vga-gray text-[8px]">Aún no hay partidas guardadas. Cuando juegues, tu carrera se guardará automáticamente aquí.</p>
          )}
          <ul className="flex flex-col gap-1">
            {slots.map(s => {
              const isActive = s.id === activeId;
              const summary = s.summary;
              const label = summary.userTeamName
                ? `${summary.userTeamName} · J${summary.currentJornada} · ${summary.seasonYear}`
                : `J${summary.currentJornada} · ${summary.seasonYear}`;
              return (
                <li key={s.id} className={`flex items-center gap-2 px-2 py-1 border ${isActive ? 'border-vga-magenta bg-vga-blue/30' : 'border-vga-blue'}`}>
                  <span className={`text-[8px] w-2 ${isActive ? 'text-vga-magenta' : 'text-transparent'}`}>★</span>
                  <div className="flex-1 min-w-0">
                    {renamingId === s.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={handleRenameCommit}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCommit(); if (e.key === 'Escape') { setRenamingId(null); } }}
                        className="bg-vga-black border border-vga-cyan text-vga-bright-white text-[9px] px-1 py-0.5 w-full"
                      />
                    ) : (
                      <div className="text-vga-bright-white text-[9px] truncate">{s.name}</div>
                    )}
                    <div className="text-vga-gray text-[7px] truncate">{label}</div>
                  </div>
                  <button
                    onClick={() => handleLoadSlot(s.id)}
                    disabled={isActive}
                    className={`text-[7px] px-2 py-0.5 border ${isActive ? 'text-vga-gray border-vga-gray cursor-not-allowed' : 'text-vga-green border-vga-green hover:bg-vga-green hover:text-vga-black'}`}
                  >
                    CARGAR
                  </button>
                  <button onClick={() => handleRenameStart(s)} className="text-[7px] px-2 py-0.5 border text-vga-cyan border-vga-cyan hover:bg-vga-cyan hover:text-vga-black">
                    RENOMBRAR
                  </button>
                  <button onClick={() => handleDeleteSlot(s)} className="text-[7px] px-2 py-0.5 border text-vga-red border-vga-red hover:bg-vga-red hover:text-vga-bright-white">
                    BORRAR
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 pt-1 border-t border-vga-blue">
            <button
              onClick={handleSaveCurrentAsNew}
              className="text-[8px] px-3 py-1 border border-vga-green text-vga-green hover:bg-vga-green hover:text-vga-black uppercase font-bold"
            >
              + Guardar partida actual como nueva
            </button>
          </div>
          <p className="text-vga-gray text-[7px]">Las partidas se guardan en este navegador. Exporta las importantes (pestaña BACKUP) por seguridad.</p>
        </div>
      )}

      {tab === 'engine' && (
        <div className="bg-vga-gray border-4 border-vga-blue p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <EngineSettingsView />
        </div>
      )}

      {tab === 'pack' && onOpenPack && (
        <div className="bg-vga-gray border-4 border-vga-blue p-6 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-vga-blue text-[10px] font-bold border-b border-vga-blue pb-1 uppercase">Pack de datos</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">Importa un pack externo o gestiona el pack activo.</p>
          <button
            onClick={onOpenPack}
            className="bg-vga-green hover:opacity-90 text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black text-[10px] font-bold uppercase tracking-wider"
          >
            GESTIONAR PACK
          </button>
        </div>
      )}

      {tab === 'dev' && (
        <div className="bg-vga-gray border-4 border-vga-red p-6 flex flex-col gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-vga-red text-[10px] font-bold border-b border-vga-red pb-1 uppercase">Developer Options</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">
            Borra todo el estado guardado en el navegador: ligas, packs importados, configuración, IndexedDB y caches del Service Worker. Útil para empezar desde cero como un usuario nuevo.<br/>
            <span className="text-vga-red font-bold uppercase underline">Esta acción es irreversible.</span>
          </p>
          <button
            onClick={handleHardReset}
            className="bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold mt-2 uppercase tracking-wider"
          >
            ■ BORRAR TODO Y RECARGAR
          </button>
        </div>
      )}

      {tab === 'backup' && <div className="bg-vga-gray border-4 border-vga-blue p-6 flex flex-col gap-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col gap-2">
          <h3 className="text-vga-blue text-[10px] font-bold border-b border-vga-blue pb-1 uppercase">{t('section.exportGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">{t('backup.exportDesc')}</p>
          <button
            onClick={handleExport}
            className="bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold mt-2 uppercase tracking-wider"
          >
            {t('btn.downloadBackup')}
          </button>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-vga-blue pt-4">
          <h3 className="text-vga-blue text-[10px] font-bold border-b border-vga-blue pb-1 uppercase">{t('section.importGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">
            {t('backup.importDesc')}<br/>
            <span className="text-vga-red font-bold uppercase underline">{t('backup.importWarn')}</span>
          </p>
          <label className="cursor-pointer bg-vga-blue hover:bg-vga-light-blue text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold text-center mt-2 uppercase tracking-wider block">
            {t('btn.uploadBackup')}
            <input type="file" accept=".ofb" onChange={handleImport} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-vga-red pt-4">
          <h3 className="text-vga-red text-[10px] font-bold border-b border-vga-red pb-1 uppercase">{t('section.resetGame')}</h3>
          <p className="text-vga-black text-[8px] leading-relaxed">
            {t('backup.resetDesc')}<br/>
            <span className="text-vga-red font-bold uppercase underline">{t('backup.resetWarn')}</span>
          </p>
          <button
            onClick={handleReset}
            className="bg-vga-red hover:bg-vga-light-red text-vga-bright-white py-2 px-4 border-b-4 border-r-4 border-vga-black active:border-0 text-[10px] font-bold mt-2 uppercase tracking-wider"
          >
            {t('btn.resetLeague')}
          </button>
        </div>
      </div>}
    </div>
  );
};

import { useState } from 'react';
import type { LeagueState } from '../store/leagueStore';
import { encodeBackup, decodeBackup } from '../utils/backupUtils';
import { useT, getLang, setLang, getSupportedLangs } from '../i18n';
import { EngineSettingsView } from './EngineSettingsView';
import { PackLoaderView } from './PackLoaderView';
import { ScreenHeader } from './ScreenHeader';
import {
  listSlots, getActiveSlotId, loadSlot, saveSlot, renameSlot, deleteSlot, setActiveSlot,
  type SaveSlot,
} from '../store/saveSlots';

interface Props {
  league: LeagueState;
  onRestore: (newState: LeagueState) => void;
  onReset: () => void;
  onBack: () => void;
}

export const BackupView = ({ league, onRestore, onReset, onBack }: Props) => {
  const t = useT();
  const [tab, setTab] = useState<'backup' | 'slots' | 'engine' | 'pack' | 'prefs'>('prefs');
  const [updateNotifs, setUpdateNotifs] = useState<boolean>(() => localStorage.getItem('openfutbol_update_notifs') === '1');
  const [lang, setLangState] = useState<string>(() => getLang());
  const handleLangChange = (next: string) => { setLang(next); setLangState(next); };
  const supportedLangs = getSupportedLangs();

  const handleToggleUpdateNotifs = (next: boolean) => {
    setUpdateNotifs(next);
    if (next) localStorage.setItem('openfutbol_update_notifs', '1');
    else localStorage.removeItem('openfutbol_update_notifs');
  };
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
    <div className="w-full max-w-[1600px] mx-auto px-2 flex flex-col gap-4 animate-in fade-in duration-300">
      <ScreenHeader title={t('section.backup')} onBack={onBack} backLabel={t('btn.back')} />

      <div className="of-tabs">
        {league.isStarted && (
          <button onClick={handleReset} className="of-tab of-tab--warn" title={t('section.resetGame')}>SALIR</button>
        )}
        <button onClick={() => setTab('prefs')} className={`of-tab ${tab === 'prefs' ? 'is-active' : ''}`}>PREFS</button>
        <button onClick={() => setTab('engine')} className={`of-tab ${tab === 'engine' ? 'is-active' : ''}`}>ENGINE</button>
        <button onClick={() => setTab('backup')} className={`of-tab ${tab === 'backup' ? 'is-active' : ''}`}>BACKUP</button>
        <button onClick={() => setTab('pack')} className={`of-tab ${tab === 'pack' ? 'is-active' : ''}`}>PACK</button>
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

      {tab === 'pack' && <PackLoaderView />}

      {tab === 'prefs' && (
        <div className="flex flex-col gap-3">
          <div className="of-card">
            <h3 className="of-card-title">Preferencias</h3>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-vga-bright-white text-[9px] font-bold uppercase tracking-wider min-w-[7rem]">Idioma</span>
              <div className="flex gap-1">
                {supportedLangs.map(code => (
                  <button
                    key={code}
                    onClick={() => handleLangChange(code)}
                    className={`of-tab ${lang === code ? 'is-active' : ''}`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={updateNotifs}
                onChange={(e) => handleToggleUpdateNotifs(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-cyan-400 cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                <span className="text-vga-bright-white text-[9px] font-bold uppercase tracking-wider">Avisos de nueva versión</span>
                <span className="of-card-desc">
                  Muestra una barra amarilla cuando se publica una nueva versión del juego. Recarga para aplicarla.
                </span>
              </div>
            </label>
          </div>

          <div className="of-card" style={{ borderColor: '#ff5c8a' }}>
            <h3 className="of-card-title" style={{ color: '#ff5c8a', textShadow: '0 0 6px rgba(255, 92, 138, 0.7)', borderBottomColor: 'rgba(255, 92, 138, 0.35)' }}>Factory Reset</h3>
            <p className="of-card-desc">
              Borra todo el estado guardado en el navegador: ligas, packs importados, configuración, IndexedDB y caches del Service Worker. Útil para empezar desde cero como un usuario nuevo. <span className="of-card-warn">Esta acción es irreversible.</span>
            </p>
            <button onClick={handleHardReset} className="of-btn-neon of-btn-neon--red self-start">
              ■ BORRAR TODO Y RECARGAR
            </button>
          </div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="of-card">
            <h3 className="of-card-title">{t('section.exportGame')}</h3>
            <p className="of-card-desc">{t('backup.exportDesc')}</p>
            <button onClick={handleExport} className="of-btn-neon of-btn-neon--green mt-auto">
              {t('btn.downloadBackup')}
            </button>
          </div>

          <div className="of-card">
            <h3 className="of-card-title">{t('section.importGame')}</h3>
            <p className="of-card-desc">
              {t('backup.importDesc')} <span className="of-card-warn">{t('backup.importWarn')}</span>
            </p>
            <label className="of-btn-neon of-btn-neon--cyan mt-auto cursor-pointer">
              {t('btn.uploadBackup')}
              <input type="file" accept=".ofb" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

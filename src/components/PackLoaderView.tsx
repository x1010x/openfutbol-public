import { useRef, useState } from 'react';
import { usePack } from '../state/PackContext';
import { useStatsPack } from '../state/StatsPackContext';
import { loadPackFromFile } from '../data/packLoader';
import { loadStatsPackFromFile } from '../data/statsPackLoader';

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
};

export const PackLoaderView = () => {
  const { pack, setPack, clearPack, persistent, isDefault } = usePack();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasSavedLeague = (): boolean => localStorage.getItem('pcfurbo_league') !== null;

  const confirmReplace = (): boolean => {
    if (!pack && !hasSavedLeague()) return true;
    return window.confirm('Esto sustituirá el pack actual y borrará la liga en curso. ¿Continuar?');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!confirmReplace()) { if (fileRef.current) fileRef.current.value = ''; return; }
    localStorage.removeItem('openfutbol_pack_dismissed_default');
    setBusy(true);
    const result = await loadPackFromFile(file);
    setBusy(false);
    if (!result.ok) { setError(result.message); if (fileRef.current) fileRef.current.value = ''; return; }
    localStorage.removeItem('pcfurbo_league');
    await setPack(result.pack);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReplace = async () => {
    if (!confirmReplace()) return;
    await clearPack();
  };

  return (
    <div className="flex flex-col gap-3">
      {pack && (
        <div className="of-card">
          <h3 className="of-card-title">Pack activo</h3>
          {isDefault && (
            <div className="of-pill-yellow">
              Estás usando el pack incluido. Importa un archivo para sustituirlo.
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-vga-bright-white text-[10px] font-bold uppercase tracking-wider" style={{ color: '#33f3ff', textShadow: '0 0 6px rgba(51, 243, 255, 0.7)' }}>{pack.meta.name}</span>
            <span className="of-card-desc">v{pack.meta.version} · Importado {formatDate(pack.meta.imported_at)}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            <div className="of-stat-tile">
              <span className="of-stat-tile-value">{pack.countries.length}</span>
              <span className="of-stat-tile-label">Países</span>
            </div>
            <div className="of-stat-tile">
              <span className="of-stat-tile-value">{pack.leagues.length}</span>
              <span className="of-stat-tile-label">Ligas</span>
            </div>
            <div className="of-stat-tile">
              <span className="of-stat-tile-value">{pack.clubs.length}</span>
              <span className="of-stat-tile-label">Clubes</span>
            </div>
            <div className="of-stat-tile">
              <span className="of-stat-tile-value">{pack.players.length}</span>
              <span className="of-stat-tile-label">Jugadores</span>
            </div>
          </div>

          <button onClick={handleReplace} className="of-btn-neon of-btn-neon--red self-start mt-1">
            REEMPLAZAR PACK
          </button>
        </div>
      )}

      {!pack && (
        <div className="of-card">
          <h3 className="of-card-title">Importar pack</h3>
          <p className="of-card-desc">Carga un archivo .pack.json local.</p>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="of-btn-neon of-btn-neon--green self-start"
          >
            ABRIR ARCHIVO .PACK.JSON
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />

          {error && <div className="of-pill-error">{error}</div>}
          {!persistent && (
            <div className="of-pill-yellow">
              Aviso: el pack no se guardará entre sesiones (IndexedDB no disponible).
            </div>
          )}
        </div>
      )}

      <StatsPackSection />
    </div>
  );
};

const StatsPackSection = () => {
  const { pack, setPack, clearPack, persistent } = useStatsPack();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setBusy(true);
    const result = await loadStatsPackFromFile(file);
    setBusy(false);
    if (!result.ok) { setError(result.message); if (fileRef.current) fileRef.current.value = ''; return; }
    await setPack(result.pack);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="of-card">
      <div className="flex justify-between items-center border-b pb-1" style={{ borderColor: 'rgba(255, 77, 248, 0.35)' }}>
        <h3 className="of-card-title" style={{ color: '#ff4df8', textShadow: '0 0 6px rgba(255, 77, 248, 0.7)', borderBottom: 'none', paddingBottom: 0 }}>Stats Pack</h3>
        {pack && <span className="of-card-desc" style={{ color: '#6dff9b' }}>{pack.meta.count} entradas</span>}
      </div>

      {pack ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-vga-bright-white text-[10px] font-bold uppercase tracking-wider">{pack.meta.name}</span>
            <span className="of-card-desc">v{pack.meta.version} · {pack.meta.source}</span>
          </div>
          <button onClick={() => clearPack()} className="of-btn-neon of-btn-neon--red self-start">
            QUITAR STATS PACK
          </button>
        </>
      ) : (
        <>
          <p className="of-card-desc">
            Opcional. Sobrescribe stats por <code style={{ color: '#33f3ff' }}>source_id</code>. Sin nombres, solo números.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="of-btn-neon of-btn-neon--magenta self-start"
          >
            CARGAR .STATS.JSON
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />

          {error && <div className="of-pill-error">{error}</div>}
          {!persistent && (
            <div className="of-pill-yellow">Aviso: el stats pack no se guardará entre sesiones.</div>
          )}
        </>
      )}
    </div>
  );
};

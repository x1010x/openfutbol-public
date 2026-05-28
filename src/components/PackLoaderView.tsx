import { useRef, useState } from 'react';
import { usePack } from '../state/PackContext';
import { loadPackFromFile, loadPackFromUrl } from '../data/packLoader';

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
};

export const PackLoaderView = ({ onBack }: { onBack?: () => void }) => {
  const { pack, setPack, clearPack, persistent, isDefault } = usePack();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
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

  const handleUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Introduce una URL.'); return; }
    setError(null);
    if (!confirmReplace()) return;
    localStorage.removeItem('openfutbol_pack_dismissed_default');
    setBusy(true);
    const result = await loadPackFromUrl(trimmed);
    setBusy(false);
    if (!result.ok) {
      setError(`No se pudo cargar la URL — descarga el archivo y úsalo como archivo. (${result.message})`);
      return;
    }
    localStorage.removeItem('pcfurbo_league');
    await setPack(result.pack);
    setUrl('');
  };

  const handleReplace = async () => {
    if (!confirmReplace()) return;
    await clearPack();
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-3 animate-in fade-in duration-300">
      <div className="bg-vga-blue border-4 border-vga-white p-5 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-1 relative">
        {onBack && (
          <button onClick={onBack} className="absolute left-3 top-1/2 -translate-y-1/2 bg-vga-red text-vga-bright-white px-3 py-1 text-[8px] border border-vga-black hover:bg-vga-light-red">
            VOLVER
          </button>
        )}
        <div className="text-vga-yellow text-lg font-bold tracking-widest mb-1 cool:text-rc-primary">DATOS DEL JUEGO</div>
        <div className="text-vga-cyan text-[8px] tracking-widest cool:text-rc-accent">GESTIÓN DE PACK</div>
      </div>

      {!pack && (
        <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full bg-vga-green text-vga-bright-white py-3 text-[10px] border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              ABRIR ARCHIVO .PACK.JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-vga-black opacity-30" />
            <span className="text-vga-black text-[8px] font-bold">O</span>
            <div className="flex-1 h-px bg-vga-black opacity-30" />
          </div>

          <div className="flex flex-col gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://...pack.json"
              disabled={busy}
              className="bg-vga-bright-white text-vga-black text-[9px] px-2 py-1.5 border-2 border-vga-black font-mono disabled:opacity-50"
            />
            <button
              onClick={handleUrl}
              disabled={busy}
              className="w-full bg-vga-blue text-vga-bright-white py-2 text-[9px] border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
            >
              CARGAR DESDE URL
            </button>
          </div>

          {error && (
            <div className="bg-vga-red text-vga-bright-white text-[8px] p-2 border-2 border-vga-black break-words">
              {error}
            </div>
          )}

          {!persistent && (
            <div className="bg-vga-yellow text-vga-black text-[8px] p-2 border-2 border-vga-black">
              Aviso: el pack no se guardará entre sesiones (IndexedDB no disponible).
            </div>
          )}
        </div>
      )}

      {pack && (
        <div className="bg-vga-gray border-4 border-vga-blue p-4 flex flex-col gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {isDefault && (
            <div className="bg-vga-yellow text-vga-black text-[8px] p-2 border-2 border-vga-black">
              Estás usando el pack incluido. Importa un archivo para sustituirlo.
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-vga-blue text-[10px] font-bold uppercase">{pack.meta.name}</span>
            <span className="text-vga-black text-[8px]">v{pack.meta.version}</span>
            <span className="text-vga-black text-[7px] opacity-70">
              Importado: {formatDate(pack.meta.imported_at)}
            </span>
            {pack.meta.source_url && (
              <a
                href={pack.meta.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-vga-blue text-[7px] underline break-all"
              >
                {pack.meta.source_url}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t-2 border-vga-blue pt-3">
            <div className="bg-vga-bright-white border-2 border-vga-black p-2 flex flex-col items-center">
              <span className="text-vga-blue text-base font-bold">{pack.countries.length}</span>
              <span className="text-vga-black text-[7px] uppercase">países</span>
            </div>
            <div className="bg-vga-bright-white border-2 border-vga-black p-2 flex flex-col items-center">
              <span className="text-vga-blue text-base font-bold">{pack.leagues.length}</span>
              <span className="text-vga-black text-[7px] uppercase">ligas</span>
            </div>
            <div className="bg-vga-bright-white border-2 border-vga-black p-2 flex flex-col items-center">
              <span className="text-vga-blue text-base font-bold">{pack.clubs.length}</span>
              <span className="text-vga-black text-[7px] uppercase">clubes</span>
            </div>
            <div className="bg-vga-bright-white border-2 border-vga-black p-2 flex flex-col items-center">
              <span className="text-vga-blue text-base font-bold">{pack.players.length}</span>
              <span className="text-vga-black text-[7px] uppercase">jugadores</span>
            </div>
          </div>

          <button
            onClick={handleReplace}
            className="w-full bg-vga-red text-vga-bright-white py-2 text-[9px] border-b-4 border-r-4 border-vga-black font-bold uppercase tracking-widest hover:opacity-90 mt-1"
          >
            REEMPLAZAR PACK
          </button>
        </div>
      )}
    </div>
  );
};

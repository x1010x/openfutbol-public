import { createContext, useContext, useEffect, useState } from 'react';
import type { Pack } from '../types/game.d.ts';
import { hasIndexedDB, loadPack, savePack, clearPack as clearStoredPack } from '../data/packStore';

interface PackContextValue {
  pack: Pack | null;
  loading: boolean;
  /** Persistence works in this browser session (IDB available). */
  persistent: boolean;
  setPack: (pack: Pack) => Promise<void>;
  clearPack: () => Promise<void>;
}

const PackContext = createContext<PackContextValue | null>(null);

export const PackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pack, setPackState] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const persistent = hasIndexedDB();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!persistent) { if (!cancelled) setLoading(false); return; }
      try {
        const stored = await loadPack();
        if (!cancelled) setPackState(stored);
      } catch (e) {
        console.error('PackContext: failed to load pack from IDB', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [persistent]);

  const setPack = async (next: Pack) => {
    setPackState(next);
    if (persistent) {
      try { await savePack(next); }
      catch (e) { console.error('PackContext: failed to persist pack', e); }
    }
  };

  const clearPack = async () => {
    setPackState(null);
    localStorage.removeItem('pcfurbo_league');
    if (persistent) {
      try { await clearStoredPack(); }
      catch (e) { console.error('PackContext: failed to clear pack', e); }
    }
  };

  return (
    <PackContext.Provider value={{ pack, loading, persistent, setPack, clearPack }}>
      {children}
    </PackContext.Provider>
  );
};

export const usePack = (): PackContextValue => {
  const ctx = useContext(PackContext);
  if (!ctx) throw new Error('usePack must be used inside <PackProvider>');
  return ctx;
};

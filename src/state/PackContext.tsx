import { createContext, useContext, useEffect, useState } from 'react';
import type { Pack } from '../types/game.d.ts';
import { hasIndexedDB, loadPack, savePack, clearPack as clearStoredPack } from '../data/packStore';
import { loadFifaStats } from '../data/fifaStatsStore';
import { parsePack } from '../data/packLoader';

const DISMISSED_KEY = 'openfutbol_pack_dismissed_default';

interface PackContextValue {
  pack: Pack | null;
  loading: boolean;
  /** Persistence works in this browser session (IDB available). */
  persistent: boolean;
  isDefault: boolean;
  setPack: (pack: Pack) => Promise<void>;
  clearPack: () => Promise<void>;
}

const PackContext = createContext<PackContextValue | null>(null);

export const PackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pack, setPackState] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const persistent = hasIndexedDB();

  useEffect(() => {
    let cancelled = false;
    const fifaReady = loadFifaStats();
    (async () => {
      try {
        await fifaReady;
        let stored: Pack | null = null;
        if (persistent) {
          try { stored = await loadPack(); }
          catch (e) { console.error('PackContext: failed to load pack from IDB', e); }
        }
        if (!cancelled && stored) {
          setPackState(stored);
          setIsDefault(false);
          return;
        }
        // No stored pack — try auto-loading the default unless dismissed
        if (!localStorage.getItem(DISMISSED_KEY)) {
          try {
            const res = await fetch(`${import.meta.env.BASE_URL}default.pack.json`);
            if (res.ok) {
              const json = await res.json();
              const result = parsePack(json);
              if (!cancelled && result.ok) {
                setPackState(result.pack);
                setIsDefault(true);
              }
            }
          } catch {
            // silently ignore — game works without a pack
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [persistent]);

  const setPack = async (next: Pack) => {
    localStorage.removeItem(DISMISSED_KEY);
    setPackState(next);
    setIsDefault(false);
    if (persistent) {
      try { await savePack(next); }
      catch (e) { console.error('PackContext: failed to persist pack', e); }
    }
  };

  const clearPack = async () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setPackState(null);
    setIsDefault(false);
    localStorage.removeItem('pcfurbo_league');
    if (persistent) {
      try { await clearStoredPack(); }
      catch (e) { console.error('PackContext: failed to clear pack', e); }
    }
  };

  return (
    <PackContext.Provider value={{ pack, loading, persistent, isDefault, setPack, clearPack }}>
      {children}
    </PackContext.Provider>
  );
};

export const usePack = (): PackContextValue => {
  const ctx = useContext(PackContext);
  if (!ctx) throw new Error('usePack must be used inside <PackProvider>');
  return ctx;
};

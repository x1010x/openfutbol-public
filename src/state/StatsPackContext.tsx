import { createContext, useContext, useEffect, useState } from 'react';
import type { StatsPack } from '../types/game.d.ts';
import { hasIndexedDB } from '../data/packStore';
import { saveStatsPack, loadStatsPack, clearStatsPack as clearStored } from '../data/statsPackStore';
import { setStatsIndex, type FifaEntry } from '../data/fifaStatsStore';

interface StatsPackContextValue {
  pack: StatsPack | null;
  loading: boolean;
  persistent: boolean;
  setPack: (pack: StatsPack) => Promise<void>;
  clearPack: () => Promise<void>;
}

const StatsPackContext = createContext<StatsPackContextValue | null>(null);

export const StatsPackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pack, setPackState] = useState<StatsPack | null>(null);
  const [loading, setLoading] = useState(true);
  const persistent = hasIndexedDB();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!persistent) return;
        const stored = await loadStatsPack();
        if (cancelled || !stored) return;
        setStatsIndex(stored.entries as Record<string, FifaEntry>);
        setPackState(stored);
      } catch (e) {
        console.error('StatsPackContext: failed to load from IDB', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [persistent]);

  const setPack = async (next: StatsPack) => {
    setStatsIndex(next.entries as Record<string, FifaEntry>);
    setPackState(next);
    if (persistent) {
      try { await saveStatsPack(next); }
      catch (e) { console.error('StatsPackContext: failed to persist', e); }
    }
  };

  const clearPack = async () => {
    setStatsIndex(null);
    setPackState(null);
    if (persistent) {
      try { await clearStored(); }
      catch (e) { console.error('StatsPackContext: failed to clear', e); }
    }
  };

  return (
    <StatsPackContext.Provider value={{ pack, loading, persistent, setPack, clearPack }}>
      {children}
    </StatsPackContext.Provider>
  );
};

export const useStatsPack = (): StatsPackContextValue => {
  const ctx = useContext(StatsPackContext);
  if (!ctx) throw new Error('useStatsPack must be used inside <StatsPackProvider>');
  return ctx;
};

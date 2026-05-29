import type { StatsPack } from '../types/game.d.ts';
import { openDB, STATS_STORE_NAME, ACTIVE_KEY } from './packStore';

export const saveStatsPack = async (pack: StatsPack): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATS_STORE_NAME, 'readwrite');
    tx.objectStore(STATS_STORE_NAME).put(pack, ACTIVE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const loadStatsPack = async (): Promise<StatsPack | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATS_STORE_NAME, 'readonly');
    const req = tx.objectStore(STATS_STORE_NAME).get(ACTIVE_KEY);
    req.onsuccess = () => { db.close(); resolve((req.result as StatsPack | undefined) ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
};

export const clearStatsPack = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATS_STORE_NAME, 'readwrite');
    tx.objectStore(STATS_STORE_NAME).delete(ACTIVE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

import type { Pack } from '../types/game.d.ts';

const DB_NAME = 'pcfurbo';
const DB_VERSION = 2;
const STORE = 'pack';
const STATS_STORE = 'stats';
const KEY = 'active';

export const hasIndexedDB = (): boolean =>
  typeof indexedDB !== 'undefined' && indexedDB !== null;

export const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    if (!db.objectStoreNames.contains(STATS_STORE)) db.createObjectStore(STATS_STORE);
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const open = openDB;
export const STATS_STORE_NAME = STATS_STORE;
export const ACTIVE_KEY = KEY;

export const savePack = async (pack: Pack): Promise<void> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(pack, KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

export const loadPack = async (): Promise<Pack | null> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => { db.close(); resolve((req.result as Pack | undefined) ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
};

export const clearPack = async (): Promise<void> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
};

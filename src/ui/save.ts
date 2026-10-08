/**
 * Run save storage (SPEC phase 7: IndexedDB). One small key-value store; localStorage is the fallback when
 * IndexedDB is missing or refuses to open (private windows). All calls are promises; the run store caches the
 * last loaded value so the title screen can answer "is there a save?" synchronously after boot.
 */
const DB = 'emberward';
const STORE = 'kv';
const FALLBACK_PREFIX = 'emberward.kv.';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(STORE, mode);
          const req = fn(t.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
          t.oncomplete = () => db.close();
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const v = await tx<T>('readonly', (s) => s.get(key));
  if (v !== undefined) return v;
  try {
    const raw = localStorage.getItem(FALLBACK_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const ok = await tx('readwrite', (s) => s.put(value, key));
  if (ok === undefined) {
    try {
      localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value));
    } catch {
      /* nothing to do */
    }
  }
}

export async function kvDel(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key));
  try {
    localStorage.removeItem(FALLBACK_PREFIX + key);
  } catch {
    /* nothing to do */
  }
}

import { QueuedItem, QueueStore } from './queue';

const DB_NAME = 'aeronaves-offline';
const STORE = 'queue';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrap<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Persiste en IndexedDB: sobrevive a cerrar la app y a reiniciar el teléfono. */
export function createIdbStore(): QueueStore {
  const db = open();
  return {
    all: async () => wrap<QueuedItem[]>(await db, 'readonly', (s) => s.getAll()),
    put: async (item) => {
      await wrap(await db, 'readwrite', (s) => s.put(item));
    },
    remove: async (key) => {
      await wrap(await db, 'readwrite', (s) => s.delete(key));
    },
  };
}

/** Solo para entornos sin IndexedDB: se pierde al recargar. */
export function createMemoryStore(): QueueStore {
  const items = new Map<string, QueuedItem>();
  return {
    all: async () => [...items.values()],
    put: async (item) => {
      items.set(item.key, item);
    },
    remove: async (key) => {
      items.delete(key);
    },
  };
}

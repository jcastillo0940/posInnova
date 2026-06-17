export type OfflineQueueItem =
    | {
          id: string;
          type: 'sale';
          payload: Record<string, unknown>;
          createdAt: string;
          status: 'pending' | 'syncing' | 'conflict' | 'synced';
          error?: string;
      }
    | {
          id: string;
          type: 'credit_payment';
          payload: Record<string, unknown>;
          createdAt: string;
          status: 'pending' | 'syncing' | 'conflict' | 'synced';
          error?: string;
      };

const DB_NAME = 'retailflow-pos-offline';
const DB_VERSION = 2;
const STORE = 'queue';
const STORAGE_KEY = 'retailflow-pos-snapshot';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function writeItem(item: OfflineQueueItem) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readAllItems() {
    const db = await openDb();
    const items = await new Promise<OfflineQueueItem[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result as OfflineQueueItem[]);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return items;
}

async function removeItem(id: string) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function enqueueOfflineItem(type: OfflineQueueItem['type'], payload: Record<string, unknown>) {
    const item: OfflineQueueItem = {
        id: crypto.randomUUID(),
        type,
        payload,
        createdAt: new Date().toISOString(),
        status: 'pending',
    };

    await writeItem(item);
    return item;
}

export async function listQueuedItems() {
    return (await readAllItems()).filter((item) => item.status !== 'synced');
}

export async function queueStats() {
    const items = await listQueuedItems();
    return {
        pending: items.filter((item) => item.status === 'pending').length,
        syncing: items.filter((item) => item.status === 'syncing').length,
        conflicts: items.filter((item) => item.status === 'conflict').length,
        lastSyncLabel: items.length ? new Date(items[items.length - 1].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/D',
    };
}

export function savePosSnapshot(snapshot: unknown) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function readPosSnapshot<T = unknown>(): T | null {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored) as T;
    } catch {
        return null;
    }
}

function csrfToken() {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

async function postForm(url: string, payload: Record<string, unknown>) {
    const formData = new FormData();
    const appendValue = (key: string, value: unknown) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
            value.forEach((entry, index) => appendValue(`${key}[${index}]`, entry));
            return;
        }
        if (typeof value === 'object') {
            Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
                appendValue(`${key}[${childKey}]`, childValue);
            });
            return;
        }
        formData.append(key, String(value));
    };

    Object.entries(payload).forEach(([key, value]) => appendValue(key, value));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response;
}

export async function syncOfflineQueue() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { synced: 0, conflicts: 0 };
    }

    const items = await readAllItems();
    let synced = 0;
    let conflicts = 0;

    for (const item of items.filter((entry) => entry.status === 'pending' || entry.status === 'conflict')) {
        try {
            await writeItem({ ...item, status: 'syncing' });

            if (item.type === 'sale') {
                await postForm(route('pos.sale.store'), item.payload);
            }

            if (item.type === 'credit_payment') {
                await postForm(route('pos.credit-payments.store'), item.payload);
            }

            await removeItem(item.id);
            synced += 1;
        } catch (error) {
            conflicts += 1;
            await writeItem({
                ...item,
                status: 'conflict',
                error: error instanceof Error ? error.message : 'Sync failed',
            });
        }
    }

    return { synced, conflicts };
}

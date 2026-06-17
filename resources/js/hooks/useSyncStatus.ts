import { useEffect, useState } from 'react';
import { queueStats } from '@/lib/offlineQueue';

export type SyncStatus = {
    online: boolean;
    pending: number;
    syncing: number;
    conflicts: number;
    lastSyncLabel: string;
};

const storageKey = 'retailflow-pos-sync';

function readStatus(): SyncStatus {
    if (typeof window === 'undefined') {
        return { online: true, pending: 0, syncing: 0, conflicts: 0, lastSyncLabel: 'N/D' };
    }

    const stored = window.localStorage.getItem(storageKey);

    if (stored) {
        try {
            return JSON.parse(stored) as SyncStatus;
        } catch {
            // Fall through to defaults.
        }
    }

    return { online: navigator.onLine, pending: 0, syncing: 0, conflicts: 0, lastSyncLabel: 'N/D' };
}

export function useSyncStatus() {
    const [status, setStatus] = useState<SyncStatus>(readStatus);

    useEffect(() => {
        const sync = async () => {
            const stats = await queueStats();
            setStatus((current) => {
                const next = { ...current, online: navigator.onLine, ...stats };
                window.localStorage.setItem(storageKey, JSON.stringify(next));
                return next;
            });
        };

        void sync();
        window.addEventListener('online', sync);
        window.addEventListener('offline', sync);

        return () => {
            window.removeEventListener('online', sync);
            window.removeEventListener('offline', sync);
        };
    }, []);

    return status;
}

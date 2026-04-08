// src/lib/offlineQueue.ts
import {
  updateHotel, createHotel, deleteHotel,
  updateDuration, createDuration, deleteDuration,
  createEmployee, updateEmployee, deleteEmployee,
} from './supabase';

export type QueuedOp = {
  id: string;
  type:
    | 'createHotel' | 'updateHotel' | 'deleteHotel'
    | 'createDuration' | 'updateDuration' | 'deleteDuration'
    | 'createEmployee' | 'updateEmployee' | 'deleteEmployee';
  payload: any;
  timestamp: number;
};

export type SyncStatus = 'saved' | 'saving' | 'pending' | 'failed' | 'offline';
type SyncListener = (s: SyncStatus) => void;

const STORAGE_KEY = 'eurotrack_offline_queue';

// ─── Internal queue helpers ───────────────────────────────────────────────────
function loadQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveQueue(q: QueuedOp[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); } catch {}
}

// ─── Sync manager (singleton) ─────────────────────────────────────────────────
class OfflineSyncManager {
  private isOnline  = navigator.onLine;
  private isFlushing = false;
  private listeners: SyncListener[] = [];

  constructor() {
    window.addEventListener('online',  () => { this.isOnline = true;  this.notify('saving'); this.flush(); });
    window.addEventListener('offline', () => { this.isOnline = false; this.notify('offline'); });
    // Flush any leftover ops from previous session on startup
    if (this.isOnline && loadQueue().length > 0) this.flush();
  }

  subscribe(fn: SyncListener) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private notify(s: SyncStatus) {
    this.listeners.forEach(l => l(s));
  }

  getStatus(): SyncStatus {
    if (!this.isOnline) return 'offline';
    if (loadQueue().length > 0) return 'pending';
    return 'saved';
  }

  // Call this instead of the old enqueue() everywhere
  async enqueue(op: Omit<QueuedOp, 'id' | 'timestamp'>) {
    if (this.isOnline) {
      try {
        this.notify('saving');
        await this.execute(op as QueuedOp);
        this.notify('saved');
        return;
      } catch (e) {
        console.warn('Save failed, queuing offline:', e);
      }
    }
    // Offline or save failed → push to queue
    const item: QueuedOp = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    const q = loadQueue();
    q.push(item);
    saveQueue(q);
    this.notify(this.isOnline ? 'failed' : 'offline');
  }

  async flush() {
    if (this.isFlushing) return;
    const q = loadQueue();
    if (!q.length) { this.notify('saved'); return; }
    this.isFlushing = true;
    this.notify('saving');
    const failed: QueuedOp[] = [];
    for (const op of q) {
      try { await this.execute(op); }
      catch { failed.push(op); }
    }
    saveQueue(failed);
    this.isFlushing = false;
    this.notify(failed.length ? 'failed' : 'saved');
  }

  private async execute(op: QueuedOp | Omit<QueuedOp, 'id' | 'timestamp'>) {
    const p = op.payload;
    switch (op.type) {
      case 'createHotel':    await createHotel(p);                               break;
      case 'updateHotel':    await updateHotel(p.id, p);                         break;
      case 'deleteHotel':    await deleteHotel(p.id);                            break;
      case 'createDuration': await createDuration(p);                            break;
      case 'updateDuration': await updateDuration(p.id, p);                      break;
      case 'deleteDuration': await deleteDuration(p.id);                         break;
      case 'createEmployee': await createEmployee(p.durationId, p.slotIndex, p); break;
      case 'updateEmployee': await updateEmployee(p.id, p);                      break;
      case 'deleteEmployee': await deleteEmployee(p.id);                         break;
    }
  }
}

export const offlineSync = new OfflineSyncManager();

// ─── Keep old function names working (backwards compatible) ───────────────────
export function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp'>) {
  return offlineSync.enqueue(op);
}
export function getQueue(): QueuedOp[]       { return loadQueue(); }
export function removeFromQueue(id: string)  { saveQueue(loadQueue().filter(o => o.id !== id)); }
export function clearQueue()                 { saveQueue([]); }
export function hasQueuedOps(): boolean      { return loadQueue().length > 0; }

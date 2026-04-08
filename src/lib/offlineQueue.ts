// src/lib/offlineQueue.ts
export type QueuedOp = {
  id: string;
  type:
    | 'createHotel' | 'updateHotel' | 'deleteHotel'
    | 'createDuration' | 'updateDuration' | 'deleteDuration'
    | 'createEmployee' | 'updateEmployee' | 'deleteEmployee';
  payload: any;
  timestamp: number;
};

const STORAGE_KEY = 'eurotrack_offline_queue';

function loadQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(q: QueuedOp[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); } catch {}
}

export function enqueue(op: Omit<QueuedOp, 'id' | 'timestamp'>) {
  const q = loadQueue();
  q.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
  saveQueue(q);
}

export function getQueue(): QueuedOp[] { return loadQueue(); }
export function removeFromQueue(id: string) { saveQueue(loadQueue().filter(op => op.id !== id)); }
export function clearQueue() { saveQueue([]); }
export function hasQueuedOps(): boolean { return loadQueue().length > 0; }

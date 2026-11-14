/**
 * Offline-first write queue ("outbox").
 *
 * Every change the user makes is first written to a per-user outbox in localStorage and
 * shown immediately (see optimistic.ts), then replayed to the server in FIFO order.
 *
 * Guarantees:
 *  - No duplicates: each op carries a unique `X-Idempotency-Key`. The server stores the
 *    result per key, so replays (retry after a lost response, two tabs flushing, app
 *    killed mid-request) return the stored result instead of applying twice.
 *  - Nothing silently lost: ops stay queued through network errors, 5xx and expired
 *    sessions. Ops the server permanently rejects are kept in a "failed" list for the
 *    user to retry or discard, never dropped silently.
 *  - Order preserved: ops are sent one at a time in the order they were made, and an op
 *    that depends on a rejected op (e.g. editing a job whose creation failed) is skipped.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type OpKind =
  | 'job.create'
  | 'job.update'
  | 'job.delete'
  | 'invoice.create'
  | 'inventory.create'
  | 'inventory.edit'
  | 'inventory.txn';

export interface OutboxOp {
  opId: string;
  userId: string;
  username: string;
  kind: OpKind;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: any;
  /** id of the record this op targets (job id, invoice id, inventory item id) */
  entityId: string;
  /** short human readable description shown in the sync panel */
  label: string;
  createdAt: string;
  attempts: number;
  state: 'pending' | 'failed';
  lastError?: string;
  dependsOn?: string[];
}

export type OpInput = Pick<OutboxOp, 'kind' | 'method' | 'url' | 'body' | 'entityId' | 'label'>;
export type SubmitResult = 'synced' | 'queued';

const OUTBOX_PREFIX = 'ys_outbox_';
const LOCK_NAME = 'ys-offline-sync';
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_INTERVAL_MS = 15000;

const outboxKey = (userId: string) => `${OUTBOX_PREFIX}${userId}`;

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------
function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Collision-resistant short id, e.g. `JOB-2026-K3F9ZQ2M` (8 base36 chars ≈ 41 bits). */
export function generateId(prefix: string, length = 8): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % 36];
  return `${prefix}${out}`;
}

function newOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
export function loadOutbox(userId: string): OutboxOp[] {
  try {
    const raw = localStorage.getItem(outboxKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOutbox(userId: string, ops: OutboxOp[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(outboxKey(userId));
    else localStorage.setItem(outboxKey(userId), JSON.stringify(ops));
  } catch (err) {
    console.error('Failed to persist offline outbox:', err);
  }
}

function updateOutbox(userId: string, fn: (ops: OutboxOp[]) => OutboxOp[]): OutboxOp[] {
  const next = fn(loadOutbox(userId));
  saveOutbox(userId, next);
  return next;
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------
type SendResult =
  | { outcome: 'success'; data: any }
  | { outcome: 'transient'; error: string }
  | { outcome: 'auth'; error: string }
  | { outcome: 'rejected'; error: string };

async function sendOp(op: OutboxOp): Promise<SendResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  let res: Response;
  try {
    res = await fetch(op.url, {
      method: op.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': op.opId,
      },
      body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
      signal: controller?.signal,
    });
  } catch {
    return { outcome: 'transient', error: 'No connection to the server.' };
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const serverError = (data && typeof data.error === 'string' && data.error) || `Server responded with ${res.status}`;

  if (res.ok) return { outcome: 'success', data };

  // The record already exists with the id this device generated: an earlier attempt landed.
  if (res.status === 409 && data?.code === 'DUPLICATE_ID' && op.kind.endsWith('.create')) {
    return { outcome: 'success', data: data.existing ?? null };
  }
  // Deleting something that is already gone achieves the same end state.
  if (res.status === 404 && op.kind === 'job.delete') {
    return { outcome: 'success', data: null };
  }
  if (res.status === 409 && data?.code === 'IDEMPOTENCY_IN_PROGRESS') {
    return { outcome: 'transient', error: serverError };
  }
  if (res.status === 401) return { outcome: 'auth', error: 'Session expired. Sign in again to sync.' };
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    return { outcome: 'transient', error: serverError };
  }
  return { outcome: 'rejected', error: serverError };
}

async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
  if (locks && typeof locks.request === 'function') {
    return locks.request(LOCK_NAME, fn);
  }
  return fn();
}

/** After an inventory item created offline gets its real server id, point queued ops at it. */
function remapEntityId(ops: OutboxOp[], oldId: string, newId: string): OutboxOp[] {
  return ops.map((op) => {
    if (op.entityId !== oldId) return op;
    const next: OutboxOp = { ...op, entityId: newId, url: op.url.split(`/${oldId}`).join(`/${newId}`) };
    if (op.body && typeof op.body === 'object' && op.body.itemId === oldId) {
      next.body = { ...op.body, itemId: newId };
    }
    return next;
  });
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------
interface UseOfflineSyncOptions {
  userId: string | undefined;
  username: string | undefined;
  /** called with the server response for every op this tab successfully syncs */
  onOpSynced?: (op: OutboxOp, data: any) => void;
  /** called after a flush in which at least one op was synced (here or in another tab) */
  onSyncComplete?: () => void;
}

interface Waiter {
  resolve: (r: SubmitResult) => void;
  reject: (e: Error) => void;
}

export function useOfflineSync({ userId, username, onOpSynced, onSyncComplete }: UseOfflineSyncOptions) {
  const [ops, setOps] = useState<OutboxOp[]>(() => (userId ? loadOutbox(userId) : []));
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const waitersRef = useRef<Map<string, Waiter>>(new Map());
  const flushingRef = useRef(false);
  const rerunRef = useRef(false);
  const callbacksRef = useRef({ onOpSynced, onSyncComplete });
  callbacksRef.current = { onOpSynced, onSyncComplete };

  const refresh = useCallback(() => {
    setOps(userId ? loadOutbox(userId) : []);
  }, [userId]);

  useEffect(() => {
    refresh();
    setAuthBlocked(false);
  }, [refresh]);

  const settleWaiters = useCallback(() => {
    if (!userId) return;
    const stored = loadOutbox(userId);
    const toRemove: string[] = [];
    for (const [opId, waiter] of waitersRef.current) {
      const op = stored.find((o) => o.opId === opId);
      if (!op) {
        waiter.resolve('synced');
      } else if (op.state === 'failed') {
        // The user is looking at the form that made this change: show the error there and
        // roll the change back instead of also parking it in the failed list.
        waiter.reject(new Error(op.lastError || 'The server rejected this change.'));
        toRemove.push(opId);
      } else {
        waiter.resolve('queued');
      }
      waitersRef.current.delete(opId);
    }
    if (toRemove.length) {
      updateOutbox(userId, (all) => all.filter((o) => !toRemove.includes(o.opId)));
    }
  }, [userId]);

  const flush = useCallback(async () => {
    if (!userId) return;
    if (flushingRef.current) {
      rerunRef.current = true;
      return;
    }
    flushingRef.current = true;
    setIsSyncing(true);
    let syncedAny = false;

    try {
      do {
        rerunRef.current = false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;

        await withSyncLock(async () => {
          const rejectedIds = new Set<string>();
          for (const o of loadOutbox(userId)) if (o.state === 'failed') rejectedIds.add(o.opId);

          // Re-read storage every iteration so ops added meanwhile (or by another tab) are seen.
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const op = loadOutbox(userId).find((o) => o.state === 'pending');
            if (!op) break;

            const blockedBy = (op.dependsOn || []).find((dep) => rejectedIds.has(dep));
            if (blockedBy) {
              rejectedIds.add(op.opId);
              updateOutbox(userId, (all) =>
                all.map((o) =>
                  o.opId === op.opId
                    ? { ...o, state: 'failed', lastError: 'Skipped because an earlier related change failed.' }
                    : o
                )
              );
              continue;
            }

            const result = await sendOp(op);

            if (result.outcome === 'success') {
              syncedAny = true;
              setAuthBlocked(false);
              updateOutbox(userId, (all) => {
                let next = all.filter((o) => o.opId !== op.opId);
                const serverItemId = result.data?.item?.id;
                if (op.kind === 'inventory.create' && typeof serverItemId === 'string' && serverItemId !== op.entityId) {
                  next = remapEntityId(next, op.entityId, serverItemId);
                }
                return next;
              });
              try {
                callbacksRef.current.onOpSynced?.(op, result.data);
              } catch (err) {
                console.error('onOpSynced handler failed:', err);
              }
              continue;
            }

            if (result.outcome === 'rejected') {
              rejectedIds.add(op.opId);
              updateOutbox(userId, (all) =>
                all.map((o) =>
                  o.opId === op.opId ? { ...o, state: 'failed', attempts: o.attempts + 1, lastError: result.error } : o
                )
              );
              continue;
            }

            // transient / auth: keep the op and stop, so later ops never overtake it
            updateOutbox(userId, (all) =>
              all.map((o) => (o.opId === op.opId ? { ...o, attempts: o.attempts + 1, lastError: result.error } : o))
            );
            if (result.outcome === 'auth') setAuthBlocked(true);
            break;
          }
        });
      } while (rerunRef.current);
    } finally {
      flushingRef.current = false;
      setIsSyncing(false);
      settleWaiters();
      refresh();
      if (syncedAny) {
        setLastSyncedAt(new Date().toISOString());
        callbacksRef.current.onSyncComplete?.();
      }
    }
  }, [userId, refresh, settleWaiters]);

  const submit = useCallback(
    (input: OpInput): Promise<SubmitResult> => {
      if (!userId) return Promise.reject(new Error('You must be signed in to make changes.'));

      const existing = loadOutbox(userId);
      const dependsOn = existing
        .filter((o) => o.entityId === input.entityId && o.kind.endsWith('.create'))
        .map((o) => o.opId);

      const op: OutboxOp = {
        ...input,
        opId: newOpId(),
        userId,
        username: username || '',
        createdAt: new Date().toISOString(),
        attempts: 0,
        state: 'pending',
        ...(dependsOn.length ? { dependsOn } : {}),
      };
      updateOutbox(userId, (all) => [...all, op]);
      refresh();

      const promise = new Promise<SubmitResult>((resolve, reject) => {
        waitersRef.current.set(op.opId, { resolve, reject });
      });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        settleWaiters();
      } else {
        void flush();
      }
      return promise;
    },
    [userId, username, refresh, flush, settleWaiters]
  );

  const retryFailed = useCallback(
    (opId?: string) => {
      if (!userId) return;
      updateOutbox(userId, (all) =>
        all.map((o) => (o.state === 'failed' && (!opId || o.opId === opId) ? { ...o, state: 'pending' } : o))
      );
      refresh();
      void flush();
    },
    [userId, refresh, flush]
  );

  const discardFailed = useCallback(
    (opId?: string) => {
      if (!userId) return;
      updateOutbox(userId, (all) => all.filter((o) => !(o.state === 'failed' && (!opId || o.opId === opId))));
      refresh();
    },
    [userId, refresh]
  );

  // Connectivity + triggers
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const goOffline = () => setIsOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    const onStorage = (e: StorageEvent) => {
      if (!userId || e.key !== outboxKey(userId)) return;
      const before = ops.filter((o) => o.state === 'pending').length;
      const after = loadOutbox(userId).filter((o) => o.state === 'pending').length;
      refresh();
      if (after < before) callbacksRef.current.onSyncComplete?.();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, flush, refresh, ops]);

  const pendingOps = useMemo(() => ops.filter((o) => o.state === 'pending'), [ops]);
  const failedOps = useMemo(() => ops.filter((o) => o.state === 'failed'), [ops]);
  const pendingCount = pendingOps.length;

  // Flush on sign-in / load, then keep retrying while anything is pending
  useEffect(() => {
    if (!userId) return;
    void flush();
  }, [userId, flush]);

  useEffect(() => {
    if (!userId || pendingCount === 0) return;
    const id = window.setInterval(() => void flush(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [userId, pendingCount, flush]);

  return {
    ops,
    pendingOps,
    failedOps,
    pendingCount,
    isOnline,
    isSyncing,
    authBlocked,
    lastSyncedAt,
    submit,
    flush,
    retryFailed,
    discardFailed,
  };
}

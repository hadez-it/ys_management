import React, { useEffect, useRef, useState } from 'react';
import { CloudOff, Cloud, RefreshCw, AlertTriangle, CheckCircle2, X, RotateCcw, Trash2 } from 'lucide-react';
import type { OutboxOp } from '../lib/offlineSync.ts';

interface SyncStatusProps {
  isOnline: boolean;
  isSyncing: boolean;
  authBlocked: boolean;
  pendingOps: OutboxOp[];
  failedOps: OutboxOp[];
  lastSyncedAt: string | null;
  onSyncNow: () => void;
  onRetry: (opId?: string) => void;
  onDiscard: (opId?: string) => void;
}

export default function SyncStatus({
  isOnline,
  isSyncing,
  authBlocked,
  pendingOps,
  failedOps,
  lastSyncedAt,
  onSyncNow,
  onRetry,
  onDiscard,
}: SyncStatusProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pending = pendingOps.length;
  const failed = failedOps.length;

  let tone = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  let Icon = CheckCircle2;
  let text = 'Synced';
  if (failed > 0) {
    tone = 'border-rose-500/40 bg-rose-500/15 text-rose-300';
    Icon = AlertTriangle;
    text = `${failed} failed`;
  } else if (!isOnline) {
    tone = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
    Icon = CloudOff;
    text = pending > 0 ? `Offline · ${pending}` : 'Offline';
  } else if (isSyncing && pending > 0) {
    tone = 'border-sky-500/40 bg-sky-500/15 text-sky-300';
    Icon = RefreshCw;
    text = `Syncing ${pending}`;
  } else if (pending > 0) {
    tone = 'border-amber-500/40 bg-amber-500/15 text-amber-300';
    Icon = Cloud;
    text = `${pending} pending`;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        id="sync-status-btn"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-[11px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95 transition-all outline-none ${tone}`}
        title="Offline sync status"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${Icon === RefreshCw ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{text}</span>
        {(pending > 0 || failed > 0) && <span className="sm:hidden">{failed || pending}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] z-50 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-4 text-left text-xs text-slate-300 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold uppercase tracking-wider text-white text-[11px]">
              {isOnline ? 'Online' : 'Offline — changes are saved on this device'}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {authBlocked && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
              Your session expired. Sign in again to finish syncing — queued changes are kept.
            </p>
          )}

          <div className="flex items-center justify-between">
            <span>
              {pending} waiting to sync
              {lastSyncedAt && (
                <span className="block text-[10px] text-slate-500">
                  Last synced {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onSyncNow}
              disabled={!isOnline || isSyncing || pending === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} /> Sync now
            </button>
          </div>

          {pending > 0 && (
            <ul className="max-h-32 overflow-y-auto space-y-1">
              {pendingOps.map((op) => (
                <li key={op.opId} className="truncate text-slate-400" title={op.lastError || op.label}>
                  • {op.label}
                </li>
              ))}
            </ul>
          )}

          {failed > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-300">Rejected by the server</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onRetry()} className="rounded-lg border border-white/10 px-2 py-1 hover:bg-white/10 cursor-pointer">
                    Retry all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Discard all failed changes? This cannot be undone.')) onDiscard();
                    }}
                    className="rounded-lg border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                  >
                    Discard all
                  </button>
                </div>
              </div>
              <ul className="max-h-48 overflow-y-auto space-y-2">
                {failedOps.map((op) => (
                  <li key={op.opId} className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-2">
                    <p className="font-bold text-slate-200 truncate">{op.label}</p>
                    <p className="text-rose-300/90 break-words">{op.lastError}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button type="button" onClick={() => onRetry(op.opId)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 hover:bg-white/10 cursor-pointer">
                        <RotateCcw className="h-3 w-3" /> Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => onDiscard(op.opId)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-0.5 text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Discard
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

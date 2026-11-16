import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock3, History, Plus, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { ActivityLog as ActivityLogEntry } from '../types.ts';
import { activityAction, activityDateKey, activityDayLabel, ActivityPeriod, filterActivityLogs } from '../lib/activityLog.ts';

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  loading: boolean;
  error: boolean;
  isOnline: boolean;
  lastUpdated: string | null;
  pendingCount: number;
  onRefresh: () => void;
}

const PAGE_SIZE = 30;

function actionStyle(action: string) {
  switch (activityAction(action)) {
    case 'Created': return { icon: Plus, color: 'text-teal-300 bg-teal-500/10 border-teal-500/20' };
    case 'Completed': return { icon: CheckCircle2, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
    case 'Canceled': return { icon: XCircle, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
    case 'Deleted': return { icon: Trash2, color: 'text-rose-300 bg-rose-500/10 border-rose-500/20' };
    default: return { icon: ClipboardList, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' };
  }
}

export default function ActivityLog({ logs, loading, error, isOnline, lastUpdated, pendingCount, onRefresh }: ActivityLogProps) {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [period, setPeriod] = useState<ActivityPeriod>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const actions = useMemo(() => Array.from(new Set([...logs.map((log) => activityAction(log.actionType)), ...(action ? [action] : [])])).sort(), [logs, action]);
  const filtered = useMemo(() => filterActivityLogs(logs, search, action, period), [logs, search, action, period]);
  const hasFilters = !!search || !!action || period !== 'all';
  const groups = filtered.slice(0, visibleCount).reduce<{ key: string; label: string; entries: ActivityLogEntry[] }[]>((list, log) => {
    const key = activityDateKey(log.timestamp);
    const last = list[list.length - 1];
    if (last?.key === key) last.entries.push(log);
    else list.push({ key, label: activityDayLabel(log.timestamp), entries: [log] });
    return list;
  }, []);

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setPeriod('all');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <section id="deleted-list-tab-module" className="space-y-5 text-left">
      <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-300">
              <History className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Service history</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Activity log</h2>
              <p className="mt-1 text-sm text-slate-400">Track changes to service tickets, who made them, and when.</p>
            </div>
          </div>
          <button type="button" onClick={onRefresh} disabled={!isOnline || loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-4 text-xs text-slate-400" role="status">
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Times in Yangon</span>
          <span>Most recent 1,000 ticket events</span>
          {lastUpdated && <span>Updated {new Date(lastUpdated).toLocaleTimeString('en-US', { timeZone: 'Asia/Yangon', hour: 'numeric', minute: '2-digit' })}</span>}
        </div>
      </div>

      {(!isOnline || error || pendingCount > 0) && (
        <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
          {!isOnline ? 'You are offline. Showing saved activity; new events appear after they sync.' : error ? 'Could not refresh activity. Showing saved results if available; try again.' : 'Pending ticket changes appear here after they sync.'}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative block">
            <span className="sr-only">Search activity</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search ticket, customer, user or details" className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-400/60 focus:outline-none" />
          </label>
          <label>
            <span className="sr-only">Filter by action</span>
            <select value={action} onChange={(event) => { setAction(event.target.value); setVisibleCount(PAGE_SIZE); }} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 focus:border-teal-400/60 focus:outline-none">
              <option value="">All actions</option>
              {actions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by date</span>
            <select value={period} onChange={(event) => { setPeriod(event.target.value as ActivityPeriod); setVisibleCount(PAGE_SIZE); }} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 focus:border-teal-400/60 focus:outline-none">
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'event' : 'events'}{hasFilters ? ' found' : ''}</span>
          {hasFilters && <button type="button" onClick={clearFilters} className="font-semibold text-teal-300 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-teal-400">Clear filters</button>}
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-10 text-center text-sm text-slate-400" role="status">Loading activity…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 px-5 py-14 text-center">
          <History className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-200">{hasFilters ? 'No matching activity' : error || !isOnline ? 'Activity is unavailable' : 'No activity yet'}</h3>
          <p className="mt-1 text-sm text-slate-400">{hasFilters ? 'Try a different search or filter.' : error || !isOnline ? 'Refresh when the connection is available.' : 'Ticket changes will appear here as they happen.'}</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-teal-300 hover:text-teal-200">Clear filters</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">{group.label}</h3>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 divide-y divide-white/5">
                {group.entries.map((log, index) => {
                  const { icon: Icon, color } = actionStyle(log.actionType);
                  const date = new Date(log.timestamp);
                  const time = Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString('en-US', { timeZone: 'Asia/Yangon', hour: 'numeric', minute: '2-digit' });
                  return (
                    <article key={log.id || [log.timestamp, log.jobId, index].join('-')} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                      <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ' + color}><Icon className="h-4 w-4" aria-hidden="true" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-sm text-white">{activityAction(log.actionType)}</span>
                          <span className="text-xs text-slate-400">by {log.username || 'system'}</span>
                          <time className="ml-auto text-xs text-slate-400" dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}>{time}</time>
                        </div>
                        <p className="mt-1.5 break-words text-sm text-slate-300">
                          <span className="font-medium text-teal-300">{log.jobId || 'Unknown ticket'}</span>
                          {log.customerName && log.customerName !== 'N/A' && <span> · {log.customerName}</span>}
                          {log.deviceType && log.deviceType !== 'N/A' && <span className="text-slate-400"> · {log.deviceType}</span>}
                        </p>
                        {log.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-400">{log.details}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
          {visibleCount < filtered.length && (
            <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-teal-400">
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </section>
  );
}

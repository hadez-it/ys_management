import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  History,
  Layers,
  Plus,
  RefreshCw,
  Rows3,
  Rows4,
  Search,
  SlidersHorizontal,
  Ticket,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { ActivityLog as ActivityLogEntry } from '../types.ts';
import {
  DEFAULT_ACTIVITY_FILTERS,
  activityAction,
  activityActionCounts,
  activityCsv,
  activityDateKey,
  activityDayLabel,
  activityRelativeTime,
  activitySummary,
  activityUsernames,
  filterActivityLogs,
  loadActivityFilters,
  saveActivityFilters,
  ActivityDensity,
  ActivityFilters,
  ActivityPeriod,
} from '../lib/activityLog.ts';

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  loading: boolean;
  error: boolean;
  isOnline: boolean;
  lastUpdated: string | null;
  pendingCount: number;
  onRefresh: () => void;
  currentUsername?: string;
  onOpenJob?: (jobId: string) => boolean;
}

const PAGE_SIZE = 30;

const PERIOD_OPTIONS: { id: ActivityPeriod; label: string; short: string }[] = [
  { id: 'all', label: 'All time', short: 'All' },
  { id: 'today', label: 'Today', short: 'Today' },
  { id: '7days', label: 'Last 7 days', short: '7d' },
  { id: '30days', label: 'Last 30 days', short: '30d' },
];

function actionStyle(action: string) {
  switch (activityAction(action)) {
    case 'Created': return { icon: Plus, color: 'text-teal-300 bg-teal-500/10 border-teal-500/20' };
    case 'Completed': return { icon: CheckCircle2, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
    case 'Canceled': return { icon: XCircle, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
    case 'Deleted': return { icon: Trash2, color: 'text-rose-300 bg-rose-500/10 border-rose-500/20' };
    default: return { icon: ClipboardList, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' };
  }
}

function formatExactTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Yangon',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

function PeriodControl({ value, onChange, fullWidth = false }: { value: ActivityPeriod; onChange: (period: ActivityPeriod) => void; fullWidth?: boolean }) {
  return (
    <div className={'inline-flex rounded-xl border border-white/10 bg-slate-950/60 p-0.5 ' + (fullWidth ? 'w-full' : '')} role="group" aria-label="Filter by date">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          title={option.label}
          className={'min-h-8 rounded-lg px-2.5 text-xs font-semibold transition ' + (fullWidth ? 'flex-1 ' : '') + (value === option.id ? 'bg-teal-500/20 text-teal-200 shadow-sm' : 'text-slate-400 hover:text-slate-200')}
        >
          {fullWidth ? option.label : option.short}
        </button>
      ))}
    </div>
  );
}

export default function ActivityLog({ logs, loading, error, isOnline, lastUpdated, pendingCount, onRefresh, currentUsername, onOpenJob }: ActivityLogProps) {
  const [filters, setFilters] = useState<ActivityFilters>(loadActivityFilters);
  const { search, action, period, username, onlyMine, density } = filters;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const seenNewestRef = useRef(0);
  const hasActivityBaselineRef = useRef(false);
  const topRef = useRef<HTMLElement | null>(null);
  const compact = density === 'compact';

  const setFilter = <K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    saveActivityFilters(filters);
  }, [filters]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setCollapsedDays(new Set());
  }, [search, action, period, username, onlyMine]);

  useEffect(() => {
    if (!hasActivityBaselineRef.current) {
      const initialTimes = logs.map((log) => new Date(log.timestamp).getTime()).filter(Number.isFinite);
      seenNewestRef.current = initialTimes.length ? Math.max(...initialTimes) : Date.now();
      hasActivityBaselineRef.current = true;
      return;
    }
    const cutoff = seenNewestRef.current;
    setNewCount(logs.filter((log) => {
      const time = new Date(log.timestamp).getTime();
      return !Number.isNaN(time) && time > cutoff;
    }).length);
  }, [logs]);

  const scopedLogs = useMemo(
    () => filterActivityLogs(logs, search, '', period, new Date(), { username, onlyMine, currentUsername }),
    [logs, search, period, username, onlyMine, currentUsername],
  );
  const actionCounts = useMemo(() => {
    const counts = activityActionCounts(scopedLogs);
    if (action && !counts.some((item) => item.action === action)) counts.push({ action, count: 0 });
    return counts;
  }, [scopedLogs, action]);
  const filtered = useMemo(
    () => filterActivityLogs(logs, search, action, period, new Date(), { username, onlyMine, currentUsername }),
    [logs, search, action, period, username, onlyMine, currentUsername],
  );
  const summary = useMemo(() => activitySummary(logs), [logs]);
  const usernames = useMemo(() => {
    const list = activityUsernames(logs);
    if (username && !list.includes(username)) list.push(username);
    return list.sort((a, b) => a.localeCompare(b));
  }, [logs, username]);

  const groups = useMemo(() => filtered.slice(0, visibleCount).reduce<{ key: string; label: string; entries: ActivityLogEntry[] }[]>((list, log) => {
    const key = activityDateKey(log.timestamp);
    const last = list[list.length - 1];
    if (last?.key === key) last.entries.push(log);
    else list.push({ key, label: activityDayLabel(log.timestamp), entries: [log] });
    return list;
  }, []), [filtered, visibleCount]);

  const dayTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filtered.forEach((log) => {
      const key = activityDateKey(log.timestamp);
      totals.set(key, (totals.get(key) || 0) + 1);
    });
    return totals;
  }, [filtered]);

  const hasFilters = !!search || !!action || period !== 'all' || !!username || onlyMine;
  const activeFilterCount = (username ? 1 : 0) + (onlyMine ? 1 : 0) + (period !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setFilters({ ...DEFAULT_ACTIVITY_FILTERS, density });
    setVisibleCount(PAGE_SIZE);
    setCollapsedDays(new Set());
  };

  const toggleDay = (key: string) => {
    setCollapsedDays((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleNewActivity = () => {
    const newestTimes = logs.map((log) => new Date(log.timestamp).getTime()).filter(Number.isFinite);
    seenNewestRef.current = newestTimes.length ? Math.max(...newestTimes) : Date.now();
    setNewCount(0);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExport = () => {
    if (!filtered.length) return;
    const csv = activityCsv(filtered);
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${activityDateKey(new Date().toISOString()) || 'export'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const periodLabel = PERIOD_OPTIONS.find((option) => option.id === period)?.label || 'All time';

  return (
    <section ref={topRef} id="deleted-list-tab-module" className="space-y-5 text-left">
      <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-300">
              <History className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400">Service history</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Activity log</h2>
              <p className="mt-1 text-sm text-slate-400">Track changes to service tickets, who made them, and when. Select an event to open its ticket.</p>
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Events today', value: summary.today, icon: CalendarDays, accent: 'text-teal-300' },
          { label: 'Last 7 days', value: summary.week, icon: Layers, accent: 'text-sky-300' },
          { label: 'Tickets touched', value: summary.tickets, icon: Ticket, accent: 'text-emerald-300' },
          { label: 'Contributors', value: summary.contributors, icon: Users, accent: 'text-amber-300' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-white/10 bg-slate-900/40 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tile.label}</span>
              <tile.icon className={'h-3.5 w-3.5 ' + tile.accent} aria-hidden="true" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">{tile.value}</p>
          </div>
        ))}
      </div>

      {(!isOnline || error || pendingCount > 0) && (
        <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
          {!isOnline ? 'You are offline. Showing saved activity; new events appear after they sync.' : error ? 'Could not refresh activity. Showing saved results if available; try again.' : 'Pending ticket changes appear here after they sync.'}
        </div>
      )}

      <div className="sticky top-0 z-20 space-y-3 rounded-3xl border border-white/10 bg-[#061014]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[170px] flex-1">
            <span className="sr-only">Search activity</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Search ticket, customer, user or details"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/60 py-2 pl-10 pr-9 text-sm text-white placeholder:text-slate-500 focus:border-teal-400/60 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setFilter('search', '')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-200">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </label>

          <div className="hidden items-center gap-2 md:flex">
            <label>
              <span className="sr-only">Filter by user</span>
              <select
                value={username}
                onChange={(event) => {
                  setFilter('username', event.target.value);
                  setFilter('onlyMine', false);
                }}
                className="min-h-11 max-w-[150px] rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 focus:border-teal-400/60 focus:outline-none"
              >
                <option value="">All users</option>
                {usernames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            {currentUsername && (
              <button
                type="button"
                onClick={() => setFilter('onlyMine', !onlyMine)}
                aria-pressed={onlyMine}
                className={'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition ' + (onlyMine ? 'border-teal-400/40 bg-teal-500/20 text-teal-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')}
              >
                <UserRound className="h-4 w-4" aria-hidden="true" /> Only me
              </button>
            )}
            <PeriodControl value={period} onChange={(value) => setFilter('period', value)} />
            <button
              type="button"
              onClick={() => setFilter('density', compact ? 'comfortable' : 'compact')}
              aria-pressed={compact}
              title={compact ? 'Switch to comfortable rows' : 'Switch to compact rows'}
              aria-label={compact ? 'Switch to comfortable rows' : 'Switch to compact rows'}
              className={'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition ' + (compact ? 'border-teal-400/40 bg-teal-500/20 text-teal-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')}
            >
              {compact ? <Rows4 className="h-4 w-4" aria-hidden="true" /> : <Rows3 className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!filtered.length}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Export
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-500/25 px-1 text-[10px] font-bold text-teal-200">{activeFilterCount}</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!filtered.length}
              aria-label="Export filtered activity as CSV"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" aria-label="Filter by action">
          {actionCounts.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => setFilter('action', action === item.action ? '' : item.action)}
              aria-pressed={action === item.action}
              className={'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ' + (action === item.action ? 'border-teal-400/40 bg-teal-500/20 text-teal-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')}
            >
              {item.action}
              <span className={'rounded-full px-1.5 py-0.5 text-[10px] ' + (action === item.action ? 'bg-teal-400/20 text-teal-100' : 'bg-white/5 text-slate-400')}>{item.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span aria-live="polite">
            {filtered.length === 0 ? 'No events match' : `${Math.min(visibleCount, filtered.length)} of ${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}${hasFilters ? ' (filtered)' : ''}`}
            {(username || period !== 'all' || onlyMine) && <span className="hidden sm:inline"> · {[username, periodLabel, onlyMine ? 'only me' : ''].filter(Boolean).join(' · ')}</span>}
          </span>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="font-semibold text-teal-300 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-teal-400">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {newCount > 0 && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 md:bottom-8">
          <button
            type="button"
            onClick={handleNewActivity}
            className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-4 py-2 text-xs font-bold text-teal-100 shadow-lg backdrop-blur-md transition hover:bg-teal-500/30"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            {newCount} new {newCount === 1 ? 'event' : 'events'}
          </button>
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading activity…</span>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-20 rounded-full bg-white/10" />
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="flex gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded-full bg-white/10" />
                    <div className="h-3 w-2/3 rounded-full bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 px-5 py-14 text-center">
          <History className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-200">{hasFilters ? 'No matching activity' : error || !isOnline ? 'Activity is unavailable' : 'No activity yet'}</h3>
          <p className="mt-1 text-sm text-slate-400">{hasFilters ? 'Try a different search or filter.' : error || !isOnline ? 'Refresh when the connection is available.' : 'Ticket changes will appear here as they happen.'}</p>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-teal-300 hover:text-teal-200">Clear filters</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const collapsed = collapsedDays.has(group.key);
            const total = dayTotals.get(group.key) || group.entries.length;
            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleDay(group.key)}
                  aria-expanded={!collapsed}
                  className="mb-3 flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-slate-400 transition hover:text-slate-200"
                >
                  <ChevronDown className={'h-3.5 w-3.5 shrink-0 transition-transform ' + (collapsed ? '-rotate-90' : '')} aria-hidden="true" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">{group.label}</h3>
                  <span className="ml-auto text-[11px] font-medium normal-case tracking-normal">
                    {group.entries.length < total ? `${group.entries.length} of ${total}` : total} {total === 1 ? 'event' : 'events'}
                  </span>
                </button>

                {!collapsed && (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
                    {group.entries.map((log, index) => {
                      const { icon: Icon, color } = actionStyle(log.actionType);
                      const date = new Date(log.timestamp);
                      const exact = formatExactTime(log.timestamp);
                      const relative = activityRelativeTime(log.timestamp);
                      const interactive = !!onOpenJob;
                      return (
                        <div
                          key={log.id || [log.timestamp, log.jobId, index].join('-')}
                          role={interactive ? 'button' : undefined}
                          tabIndex={interactive ? 0 : undefined}
                          onClick={interactive ? () => {
                            if (!onOpenJob(log.jobId)) {
                              window.alert(`Ticket ${log.jobId} is no longer in the active queue. It may have been deleted.`);
                            }
                          } : undefined}
                          onKeyDown={interactive ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (!onOpenJob(log.jobId)) {
                                window.alert(`Ticket ${log.jobId} is no longer in the active queue. It may have been deleted.`);
                              }
                            }
                          } : undefined}
                          aria-label={interactive ? `Open ticket ${log.jobId}` : undefined}
                          className={'group flex gap-3 px-4 text-left transition sm:gap-4 sm:px-5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-400 ' + (compact ? 'py-2.5 ' : 'py-4 ') + (interactive ? 'cursor-pointer hover:bg-white/5' : '')}
                        >
                          <div className="flex w-9 shrink-0 flex-col items-center">
                            <div className={'flex h-9 w-9 items-center justify-center rounded-xl border ' + color}>
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>
                            {index < group.entries.length - 1 && <span className="mt-1.5 w-px flex-1 bg-white/10" aria-hidden="true" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-semibold text-white">{activityAction(log.actionType)}</span>
                              <span className="text-xs text-slate-400">by {log.username || 'system'}</span>
                              <time
                                className="ml-auto text-xs text-slate-400"
                                dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}
                                title={exact}
                              >
                                {relative}
                              </time>
                              {interactive && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-teal-300" aria-hidden="true" />}
                            </div>
                            <p className="mt-1.5 break-words text-sm text-slate-300">
                              <span className="font-medium text-teal-300">{log.jobId || 'Unknown ticket'}</span>
                              {log.customerName && log.customerName !== 'N/A' && <span> · {log.customerName}</span>}
                              {log.deviceType && log.deviceType !== 'N/A' && <span className="text-slate-400"> · {log.deviceType}</span>}
                            </p>
                            {log.details && (
                              <p className={'mt-2 break-words text-sm leading-relaxed text-slate-400 ' + (compact ? 'line-clamp-1' : 'whitespace-pre-wrap')}>
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {visibleCount < filtered.length && (
            <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-teal-400">
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {filtersOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="activity-filters-title">
          <button type="button" aria-label="Close filters" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
          <div className="animate-activity-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#071318] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="activity-filters-title" className="text-base font-bold text-white">Filters</h3>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User</span>
                <select
                  value={username}
                  onChange={(event) => {
                  setFilter('username', event.target.value);
                  setFilter('onlyMine', false);
                }}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 focus:border-teal-400/60 focus:outline-none"
                >
                  <option value="">All users</option>
                  {usernames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date range</span>
                <PeriodControl value={period} onChange={(value) => setFilter('period', value)} fullWidth />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Row density</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['comfortable', 'compact'] as ActivityDensity[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter('density', option)}
                      aria-pressed={density === option}
                      className={'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold capitalize transition ' + (density === option ? 'border-teal-400/40 bg-teal-500/20 text-teal-200' : 'border-white/10 bg-white/5 text-slate-300')}
                    >
                      {option === 'compact' ? <Rows4 className="h-4 w-4" aria-hidden="true" /> : <Rows3 className="h-4 w-4" aria-hidden="true" />}
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {currentUsername && (
                <button
                  type="button"
                  onClick={() => setFilter('onlyMine', !onlyMine)}
                  aria-pressed={onlyMine}
                  className={'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition ' + (onlyMine ? 'border-teal-400/40 bg-teal-500/20 text-teal-200' : 'border-white/10 bg-white/5 text-slate-300')}
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Only my actions
                </button>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="min-h-11 flex-[1.5] rounded-xl bg-teal-600 text-sm font-bold text-white transition hover:bg-teal-500"
              >
                Show {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

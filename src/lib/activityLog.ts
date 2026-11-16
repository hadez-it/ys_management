import { ActivityLog } from '../types.ts';

export type ActivityPeriod = 'all' | 'today' | '7days' | '30days';
export type ActivityDensity = 'comfortable' | 'compact';

export interface ActivityFilterOptions {
  username?: string;
  onlyMine?: boolean;
  currentUsername?: string;
}

export interface ActivityFilters {
  search: string;
  action: string;
  period: ActivityPeriod;
  username: string;
  onlyMine: boolean;
  density: ActivityDensity;
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  search: '',
  action: '',
  period: 'all',
  username: '',
  onlyMine: false,
  density: 'comfortable',
};

export const ACTIVITY_FILTERS_STORAGE_KEY = 'ys_activity_filters';

const PERIODS: ActivityPeriod[] = ['all', 'today', '7days', '30days'];

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function activityDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function daysBefore(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function activityAction(action: string): string {
  return action === 'Cancelled' ? 'Canceled' : action || 'Unknown';
}

export function filterActivityLogs(
  logs: ActivityLog[],
  search: string,
  action: string,
  period: ActivityPeriod,
  now = new Date(),
  options: ActivityFilterOptions = {},
): ActivityLog[] {
  const query = search.trim().toLocaleLowerCase();
  const today = activityDateKey(now.toISOString());
  const firstDay = period === 'today' ? today : daysBefore(today, period === '7days' ? 6 : 29);
  const username = options.username?.trim();
  const onlyMine = !!options.onlyMine && !!options.currentUsername;

  return logs.filter((log) => {
    if (action && activityAction(log.actionType) !== action) return false;
    if (username && log.username !== username) return false;
    if (onlyMine && log.username !== options.currentUsername) return false;
    if (period !== 'all') {
      const day = activityDateKey(log.timestamp);
      if (!day || day < firstDay || day > today) return false;
    }
    return !query || [log.jobId, log.customerName, log.deviceType, log.username, log.details, log.actionType, activityAction(log.actionType)]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  }).sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return (Number.isNaN(bTime) ? -Infinity : bTime) - (Number.isNaN(aTime) ? -Infinity : aTime) || 0;
  });
}

export function activityDayLabel(timestamp: string, now = new Date()): string {
  const day = activityDateKey(timestamp);
  if (!day) return 'Unknown date';
  const today = activityDateKey(now.toISOString());
  if (day === today) return 'Today';
  if (day === daysBefore(today, 1)) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString('en-US', {
    timeZone: 'Asia/Yangon', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function activityUsernames(logs: ActivityLog[]): string[] {
  return Array.from(new Set(logs.map((log) => log.username).filter((name): name is string => !!name?.trim())))
    .sort((a, b) => a.localeCompare(b));
}

export function activityActionCounts(logs: ActivityLog[]): { action: string; count: number }[] {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const action = activityAction(log.actionType);
    counts.set(action, (counts.get(action) || 0) + 1);
  });
  return Array.from(counts, ([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

export function activitySummary(logs: ActivityLog[], now = new Date()): { today: number; week: number; tickets: number; contributors: number } {
  const today = activityDateKey(now.toISOString());
  const firstDay = daysBefore(today, 6);
  const tickets = new Set<string>();
  const contributors = new Set<string>();
  let todayCount = 0;
  let weekCount = 0;

  logs.forEach((log) => {
    const day = activityDateKey(log.timestamp);
    if (day === today) todayCount += 1;
    if (day && day >= firstDay && day <= today) weekCount += 1;
    if (log.jobId) tickets.add(log.jobId);
    if (log.username) contributors.add(log.username);
  });

  return { today: todayCount, week: weekCount, tickets: tickets.size, contributors: contributors.size };
}

export function activityRelativeTime(timestamp: string, now = new Date()): string {
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return 'Unknown time';
  const diff = now.getTime() - time;
  if (diff < 45_000) return 'Just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    timeZone: 'Asia/Yangon', month: 'short', day: 'numeric',
  });
}

const CSV_HEADERS = ['Timestamp', 'Action', 'Ticket', 'Customer', 'Device', 'User', 'Details'];

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Prevent spreadsheet apps from executing untrusted log text as a formula.
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function activityCsv(logs: ActivityLog[]): string {
  return [
    CSV_HEADERS.join(','),
    ...logs.map((log) => [
      log.timestamp,
      activityAction(log.actionType),
      log.jobId,
      log.customerName,
      log.deviceType,
      log.username,
      log.details,
    ].map(csvCell).join(',')),
  ].join('\r\n');
}

export function loadActivityFilters(): ActivityFilters {
  if (typeof window === 'undefined') return { ...DEFAULT_ACTIVITY_FILTERS };
  try {
    const storage = window.sessionStorage;
    if (!storage) return { ...DEFAULT_ACTIVITY_FILTERS };
    const raw = storage.getItem(ACTIVITY_FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACTIVITY_FILTERS };
    const parsed = JSON.parse(raw) as Partial<ActivityFilters> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ACTIVITY_FILTERS };
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      action: typeof parsed.action === 'string' ? parsed.action : '',
      period: PERIODS.includes(parsed.period as ActivityPeriod) ? parsed.period as ActivityPeriod : 'all',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      onlyMine: parsed.onlyMine === true,
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
    };
  } catch {
    return { ...DEFAULT_ACTIVITY_FILTERS };
  }
}

export function saveActivityFilters(filters: ActivityFilters): void {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.sessionStorage;
    if (!storage) return;
    storage.setItem(ACTIVITY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage can be unavailable (private mode); filters simply won't persist.
  }
}

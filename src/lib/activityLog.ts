import { ActivityLog } from '../types.ts';

export type ActivityPeriod = 'all' | 'today' | '7days' | '30days';

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
): ActivityLog[] {
  const query = search.trim().toLocaleLowerCase();
  const today = activityDateKey(now.toISOString());
  const firstDay = period === 'today' ? today : daysBefore(today, period === '7days' ? 6 : 29);

  return logs.filter((log) => {
    if (action && activityAction(log.actionType) !== action) return false;
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

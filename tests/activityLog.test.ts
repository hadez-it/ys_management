import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ActivityLogView from '../src/components/ActivityLog.tsx';
import {
  DEFAULT_ACTIVITY_FILTERS,
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
} from '../src/lib/activityLog.ts';
import { ActivityLog } from '../src/types.ts';
import { changedJobFields } from '../api/activity.ts';

const now = new Date('2026-11-14T18:00:00Z'); // Nov 15 in Yangon
const entry = (id: string, timestamp: string, fields: Partial<ActivityLog> = {}): ActivityLog => ({
  id, timestamp, actionType: 'Updated', jobId: 'JOB-123', customerName: 'Aye Aye',
  deviceType: 'Laptop', username: 'Ko Min', details: 'Replaced battery', ...fields,
});

test('filters and sorts activity by search and action, including legacy cancellation spelling', () => {
  const logs = [
    entry('old', '2026-11-13T00:00:00Z', { actionType: 'Cancelled' }),
    entry('new', '2026-11-14T00:00:00Z', { actionType: 'Canceled', customerName: 'Thiri' }),
    entry('invalid', 'invalid', { actionType: 'Canceled' }),
  ];
  assert.deepEqual(filterActivityLogs(logs, ' BATTERY ', 'Canceled', 'all', now).map((log) => log.id), ['new', 'old', 'invalid']);
  assert.deepEqual(filterActivityLogs(logs, 'thiri', '', 'all', now).map((log) => log.id), ['new']);
  assert.deepEqual(filterActivityLogs(logs, 'canceled', '', 'all', now).map((log) => log.id), ['new', 'old', 'invalid']);
  assert.deepEqual(filterActivityLogs(logs, 'job-123', '', 'all', now).length, 3);
  assert.deepEqual(logs.map((log) => log.id), ['old', 'new', 'invalid']);
});

test('changed ticket fields reflect actual updates, including locations and cleared priorities', () => {
  const previous = { status: 'Created', priorityNumber: 3, remarks: '', locationCoords: { lat: 1, lng: 2 } };
  assert.deepEqual(changedJobFields(previous, { status: 'Created', priorityNumber: 3, locationCoords: { lng: 2, lat: 1 } }), []);
  assert.deepEqual(changedJobFields(previous, { priorityNumber: null, remarks: 'Called customer', locationCoords: { lat: 1, lng: 3 }, ignored: 'value' }), ['Priority', 'Remarks', 'Map location']);
  assert.deepEqual(changedJobFields({}, { priorityNumber: null }), []);
});

test('date filters use inclusive Yangon calendar days and exclude invalid or future dates', () => {
  const logs = [
    entry('today', '2026-11-14T17:30:00Z'),
    entry('yesterday', '2026-11-14T17:29:59Z'),
    entry('seven-day-boundary', '2026-11-08T17:30:00Z'),
    entry('outside-seven', '2026-11-08T17:29:59Z'),
    entry('thirty-day-boundary', '2026-10-16T17:30:00Z'),
    entry('outside-thirty', '2026-10-16T17:29:59Z'),
    entry('future', '2026-11-15T17:30:00Z'),
    entry('invalid', 'invalid'),
  ];
  assert.equal(activityDateKey(logs[0].timestamp), '2026-11-15');
  assert.equal(activityDayLabel(logs[0].timestamp, now), 'Today');
  assert.equal(activityDayLabel(logs[1].timestamp, now), 'Yesterday');
  assert.equal(activityDayLabel('invalid', now), 'Unknown date');
  assert.deepEqual(filterActivityLogs(logs, '', '', 'today', now).map((log) => log.id), ['today']);
  assert.deepEqual(filterActivityLogs(logs, '', '', '7days', now).map((log) => log.id), ['today', 'yesterday', 'seven-day-boundary']);
  assert.deepEqual(filterActivityLogs(logs, '', '', '30days', now).map((log) => log.id), ['today', 'yesterday', 'seven-day-boundary', 'outside-seven', 'thirty-day-boundary']);
});

test('filters by user and only-mine scope', () => {
  const logs = [
    entry('ko', '2026-11-14T10:00:00Z', { username: 'Ko Min' }),
    entry('aye', '2026-11-14T11:00:00Z', { username: 'Aye Chan' }),
  ];
  assert.deepEqual(filterActivityLogs(logs, '', '', 'all', now, { username: 'Ko Min' }).map((log) => log.id), ['ko']);
  assert.deepEqual(filterActivityLogs(logs, '', '', 'all', now, { onlyMine: true, currentUsername: 'Aye Chan' }).map((log) => log.id), ['aye']);
  assert.equal(filterActivityLogs(logs, '', '', 'all', now, { onlyMine: true }).length, 2);
  assert.deepEqual(activityUsernames(logs), ['Aye Chan', 'Ko Min']);
});

test('derives action counts, summary tiles, relative times and CSV export', () => {
  const logs = [
    entry('a', '2026-11-14T17:30:00Z', { actionType: 'Completed', username: 'Ko Min', jobId: 'JOB-1', details: 'Said "hi", done' }),
    entry('b', '2026-11-14T16:00:00Z', { actionType: 'Updated', username: 'Aye Chan', jobId: 'JOB-2' }),
    entry('c', '2026-11-10T03:00:00Z', { actionType: 'Updated', username: 'Ko Min', jobId: 'JOB-1' }),
    entry('invalid', 'invalid', { actionType: 'Cancelled', jobId: '' }),
  ];
  assert.deepEqual(activityActionCounts(logs), [
    { action: 'Updated', count: 2 },
    { action: 'Canceled', count: 1 },
    { action: 'Completed', count: 1 },
  ]);
  assert.deepEqual(activitySummary(logs, now), { today: 1, week: 3, tickets: 2, contributors: 2 });
  assert.equal(activityRelativeTime('2026-11-14T17:30:00Z', new Date('2026-11-14T18:00:00Z')), '30m ago');
  assert.equal(activityRelativeTime('2026-11-14T16:00:00Z', new Date('2026-11-14T18:00:00Z')), '2h ago');
  assert.equal(activityRelativeTime('2026-11-10T03:00:00Z', new Date('2026-11-14T18:00:00Z')), '4d ago');
  assert.equal(activityRelativeTime('2026-11-14T17:59:30Z', new Date('2026-11-14T18:00:00Z')), 'Just now');
  assert.equal(activityRelativeTime('invalid', new Date('2026-11-14T18:00:00Z')), 'Unknown time');
  const csv = activityCsv([logs[0]]);
  assert.match(csv, /^Timestamp,Action,Ticket,Customer,Device,User,Details/);
  assert.ok(csv.includes('"Completed"'));
  assert.ok(csv.includes('"Said ""hi"", done"'));
  assert.ok(activityCsv([entry('formula', '2026-11-14T17:30:00Z', { details: '=HYPERLINK("https://example.com")' })]).includes('"\'=HYPERLINK(""https://example.com"")"'));
});

test('stored filters fall back to defaults when storage is unavailable', () => {
  assert.deepEqual(loadActivityFilters(), DEFAULT_ACTIVITY_FILTERS);
  assert.doesNotThrow(() => saveActivityFilters(DEFAULT_ACTIVITY_FILTERS));
});

test('the feed distinguishes empty, offline, and failed states while retaining saved activity', () => {
  const props = { logs: [], loading: false, error: false, isOnline: true, lastUpdated: null, pendingCount: 0, onRefresh: () => {} };
  const empty = renderToStaticMarkup(React.createElement(ActivityLogView, props));
  assert.match(empty, /No activity yet/);
  const offline = renderToStaticMarkup(React.createElement(ActivityLogView, { ...props, isOnline: false }));
  assert.match(offline, /You are offline/);
  assert.match(offline, /Activity is unavailable/);
  const failed = renderToStaticMarkup(React.createElement(ActivityLogView, { ...props, error: true, logs: [entry('saved', now.toISOString())] }));
  assert.match(failed, /Could not refresh activity/);
  assert.match(failed, /Replaced battery/);
});

test('the feed exposes ticket opening, export, summary and scoped filters', () => {
  const props = {
    logs: [entry('linked', now.toISOString())],
    loading: false, error: false, isOnline: true, lastUpdated: null, pendingCount: 0,
    onRefresh: () => {}, currentUsername: 'Ko Min', onOpenJob: () => {},
  };
  const html = renderToStaticMarkup(React.createElement(ActivityLogView, props));
  assert.match(html, /Tickets touched/);
  assert.match(html, /Open ticket JOB-123/);
  assert.match(html, /Only me/);
  assert.match(html, /Export/);
  assert.match(html, /Completed|Updated/);
  assert.match(html, /Show more|1 event/);
});

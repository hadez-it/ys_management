import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ActivityLogView from '../src/components/ActivityLog.tsx';
import { activityDateKey, activityDayLabel, filterActivityLogs } from '../src/lib/activityLog.ts';
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

/**
 * Displayed data = last server snapshot + pending outbox ops replayed on top.
 *
 * Because the overlay is recomputed from scratch, a server refresh can never wipe out
 * unsynced local changes, and an op that gets rejected/discarded disappears cleanly.
 */
import type { InventoryItem, InventoryLog, Invoice, ServiceJob } from '../types.ts';
import type { OutboxOp } from './offlineSync.ts';

const JOB_UPDATE_FIELDS = new Set([
  'customerName',
  'customerPhone',
  'dateTime',
  'locationText',
  'locationCoords',
  'deviceType',
  'deviceModel',
  'deviceIssue',
  'urgency',
  'status',
  'technicianName',
  'diagnosedProblem',
  'resolutionNotes',
  'invoiceId',
  'remarks',
  'priorityNumber',
]);

export function applyJobOps(serverJobs: ServiceJob[], ops: OutboxOp[]): ServiceJob[] {
  let jobs = serverJobs;
  for (const op of ops) {
    if (op.state !== 'pending') continue;

    if (op.kind === 'job.create') {
      if (jobs.some((j) => j.id === op.entityId)) continue;
      const job: ServiceJob = {
        editHistory: [],
        ...op.body,
        id: op.entityId,
        status: op.body?.status || 'Created',
        createdAt: op.createdAt,
        updatedAt: op.createdAt,
      };
      jobs = [job, ...jobs];
    } else if (op.kind === 'job.update') {
      jobs = jobs.map((j) => {
        if (j.id !== op.entityId) return j;
        const next: any = { ...j, updatedAt: op.createdAt };
        const body = op.body || {};
        for (const [key, val] of Object.entries(body)) {
          if (!JOB_UPDATE_FIELDS.has(key) || val === undefined) continue;
          if (val === null) delete next[key];
          else next[key] = val;
        }
        if (next.status === 'Completed') delete next.priorityNumber;
        if (typeof body.editReason === 'string' && body.editReason) {
          next.editHistory = [
            ...(j.editHistory || []),
            { editedAt: op.createdAt, reason: body.editReason, changedFields: 'Pending sync' },
          ];
        }
        return next as ServiceJob;
      });
    } else if (op.kind === 'job.delete') {
      jobs = jobs.filter((j) => j.id !== op.entityId);
    }
  }
  return jobs;
}

export function applyInvoiceOps(serverInvoices: Invoice[], ops: OutboxOp[]): Invoice[] {
  let invoices = serverInvoices;
  for (const op of ops) {
    if (op.state !== 'pending' || op.kind !== 'invoice.create') continue;
    if (invoices.some((i) => i.id === op.entityId)) continue;
    invoices = [{ ...op.body, id: op.entityId, createdTime: op.createdAt } as Invoice, ...invoices];
  }
  return invoices;
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function txnImpact(body: any): number {
  const qty = Number(body?.qty) || 0;
  return body?.type === 'fill' ? qty : -qty;
}

export function applyInventoryOps(serverItems: InventoryItem[], ops: OutboxOp[]): InventoryItem[] {
  let items = serverItems;
  for (const op of ops) {
    if (op.state !== 'pending') continue;
    const body = op.body || {};

    if (op.kind === 'inventory.create') {
      const qty = Number(body.qty) || 0;
      const match = items.find((i) => sameText(i.name, body.name || '') && sameText(i.category, body.category || ''));
      if (match) {
        items = items.map((i) => (i === match ? { ...i, qty: i.qty + qty, updatedAt: op.createdAt } : i));
      } else {
        items = [
          {
            id: op.entityId,
            name: String(body.name || '').trim(),
            category: String(body.category || '').trim(),
            qty,
            date: body.date || op.createdAt.split('T')[0],
            createdAt: op.createdAt,
            updatedAt: op.createdAt,
          },
          ...items,
        ];
      }
    } else if (op.kind === 'inventory.edit') {
      items = items.map((i) =>
        i.id === op.entityId ? { ...i, name: body.name ?? i.name, category: body.category ?? i.category, updatedAt: op.createdAt } : i
      );
    } else if (op.kind === 'inventory.txn') {
      items = items.map((i) =>
        i.id === op.entityId ? { ...i, qty: i.qty + txnImpact(body), updatedAt: op.createdAt } : i
      );
    }
  }
  return items;
}

/** Shows not-yet-synced stock movements at the top of the inventory log. */
export function applyInventoryLogOps(serverLogs: InventoryLog[], ops: OutboxOp[], items: InventoryItem[]): InventoryLog[] {
  const pendingLogs: InventoryLog[] = [];
  for (const op of ops) {
    if (op.state !== 'pending') continue;
    const body = op.body || {};
    const item = items.find((i) => i.id === op.entityId);
    const base = {
      id: `pending-${op.opId}`,
      date: body.date || op.createdAt.split('T')[0],
      username: op.username,
      timestamp: op.createdAt,
    };
    if (op.kind === 'inventory.create') {
      pendingLogs.push({ ...base, itemName: body.name, category: body.category, actionType: 'Add Item (pending sync)', qty: Number(body.qty) || 0 });
    } else if (op.kind === 'inventory.txn' && item) {
      const label =
        body.type === 'fill' ? 'Fill Stock' : body.type === 'sell' ? `Sell: ${body.customerName}` : `Damaged: ${body.customerName}`;
      pendingLogs.push({ ...base, itemName: item.name, category: item.category, actionType: `${label} (pending sync)`, qty: txnImpact(body) });
    } else if (op.kind === 'inventory.edit' && item) {
      pendingLogs.push({ ...base, itemName: item.name, category: item.category, actionType: 'Edit Item (pending sync)', qty: 0 });
    }
  }
  return pendingLogs.length ? [...pendingLogs.reverse(), ...serverLogs] : serverLogs;
}

export type JobStatus =
  | 'Created'            // Job registered
  | 'Assigned'           // Technician assigned
  | 'Dispatched'         // Technician on the way
  | 'ServiceInProgress'  // Service being performed at customer site
  | 'Repairing'          // Machine undergoing manual repair works
  | 'Completed'          // Work completed, ready for invoice or invoiced
  | 'Cancelled';         // Job aborted

export type DeviceType = string;
export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerName: string;
  customerPhone: string;
  dateTime: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partially Paid';
  paymentMethod: 'Cash' | 'KBZPay' | 'CBPay' | 'WavePay' | 'Bank Transfer';
  notes?: string;
  createdTime: string;
}

export interface EditLog {
  editedAt: string;
  reason: string;
  changedFields?: string; // summary of modified properties
}

export interface ServiceJob {
  id: string;
  customerName: string;
  customerPhone: string;
  dateTime: string; // appointment date/time
  locationText: string; // address
  locationCoords: LocationCoords;
  deviceType: DeviceType;
  deviceModel?: string;
  deviceIssue: string;
  urgency: UrgencyLevel;
  status: JobStatus;
  technicianName?: string;
  diagnosedProblem?: string; // set by tech
  resolutionNotes?: string;  // set by tech
  createdAt: string;
  updatedAt: string;
  invoiceId?: string; // link to invoice if any
  remarks?: string; // notes/remarks like customer unreachable, etc.
  priorityNumber?: number; // custom queue priority rank
  editHistory?: EditLog[];
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  status: 'Available' | 'Busy' | 'Offline';
  currentJobId?: string;
}

export interface DeletedJob {
  id: string;
  customerName: string;
  customerPhone: string;
  dateTime: string;
  deletedAt: string;
  deleteReason: string;
  originalJobData: ServiceJob;
}

export interface ActivityLog {
  id: string;
  actionType: string; // e.g. 'Created' | 'Canceled' | 'Completed' | 'Deleted' | 'Updated'
  jobId: string;
  customerName: string;
  deviceType: string;
  username: string;
  timestamp: string;
  details: string;
}

export type UserRole = 'admin' | 'coordinator' | 'senior_technician' | 'technician';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  phone?: string;
  token?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  qty: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLog {
  id: string;
  itemName: string;
  category: string;
  actionType: string;
  qty: number;
  date: string;
  username: string;
  timestamp: string;
}


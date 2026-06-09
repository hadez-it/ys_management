import { ServiceJob, Technician, Invoice } from './types.ts';

// Helper to format currency in Myanmar Kyats (MMK)
export function formatMMK(amount: number): string {
  return new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('MMK', 'Ks'); // standard local shorthand
}

// Helper to format dates
export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Yangon city coordinates center fallback
export const MAP_CENTER_YANGON = { lat: 16.8409, lng: 96.1735 };

// Mock technicians for assignment list
export const INITIAL_TECHNICIANS: Technician[] = [
  { id: 'tech-1', name: 'Ko Min Min', phone: '09791234567', status: 'Available' },
  { id: 'tech-2', name: 'Ko Aung Phyo', phone: '09451122334', status: 'Available' },
  { id: 'tech-3', name: 'Ma Thiri', phone: '09261234567', status: 'Busy' },
  { id: 'tech-4', name: 'Ko Kyaw Swar', phone: '09971234569', status: 'Offline' },
];

// Rich realistic pre-populated service jobs
export const INITIAL_JOBS: ServiceJob[] = [
  {
    id: 'JOB-2026-001',
    customerName: 'Daw Tin Tin Aye',
    customerPhone: '09421055667',
    dateTime: '2026-06-07T10:00',
    locationText: 'No. (45), Pyay Road, Sanchaung Township, Yangon',
    locationCoords: { lat: 16.8122, lng: 96.1345 },
    deviceType: 'Laptop',
    deviceModel: 'Dell Inspiron 15',
    deviceIssue: 'Screen flickering heavily and battery drains within 10 minutes. Needs diagnostic and likely a replacement screen and battery.',
    urgency: 'High',
    status: 'Created',
    createdAt: '2026-06-06T09:00:00Z',
    updatedAt: '2026-06-06T09:00:00Z',
  },
  {
    id: 'JOB-2026-002',
    customerName: 'Ko Sai Sai',
    customerPhone: '09254332115',
    dateTime: '2026-06-06T14:30',
    locationText: 'No. (12), Malikha Street, Mayangone Township, Yangon',
    locationCoords: { lat: 16.8524, lng: 96.1518 },
    deviceType: 'Desktop',
    deviceModel: 'Custom Built Gaming PC',
    deviceIssue: 'No display when powering on. RGB lights turn on, fans run, but no signal to the monitor. Tried reseating RAM but still no display.',
    urgency: 'Medium',
    status: 'Assigned',
    createdAt: '2026-06-05T14:00:00Z',
    updatedAt: '2026-06-06T10:30:00Z',
  },
  {
    id: 'JOB-2026-003',
    customerName: 'U Kyaw Myint (Bright Star Co., Ltd.)',
    customerPhone: '09951122334',
    dateTime: '2026-06-06T11:00',
    locationText: 'Room 502, Prime Hill Business Square, Dagon, Yangon',
    locationCoords: { lat: 16.7915, lng: 96.1488 },
    deviceType: 'Networking',
    deviceModel: 'TP-Link Archer & Switch 24-Port',
    deviceIssue: 'Office Wi-Fi drops frequently. Staff cannot access local file server (NAS). Need on-site network diagnostic and configuration fix.',
    urgency: 'Critical',
    status: 'Dispatched',
    createdAt: '2026-06-06T08:15:00Z',
    updatedAt: '2026-06-06T11:05:00Z',
  },
  {
    id: 'JOB-2026-004',
    customerName: 'Ma Hnin Nu',
    customerPhone: '09786543210',
    dateTime: '2026-06-05T09:30',
    locationText: 'Apartment 4B, Pearl Condo, Bahan Township, Yangon',
    locationCoords: { lat: 16.8208, lng: 96.1554 },
    deviceType: 'Laptop',
    deviceModel: 'MacBook Air M1 2020',
    deviceIssue: 'Spilled coffee over the keyboard. Laptop shut down immediately. Customer has dried it out, but it refuses to power on now.',
    urgency: 'Critical',
    status: 'Completed',
    diagnosedProblem: 'Liquid damage on the logic board power management circuit (PMIC). Carbonized residue on multiple capacitors.',
    resolutionNotes: 'Ultrasonic board clean was performed. Replaced shorted capacitors on PPBUS_AON line. Fully functional now. Diagnostics and motherboard level repair completed successfully.',
    createdAt: '2026-06-04T10:00:00Z',
    updatedAt: '2026-06-05T12:00:00Z',
    invoiceId: 'INV-2026-101',
  },
];

// Mock invoice for the completed job
export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-2026-101',
    jobId: 'JOB-2026-004',
    customerName: 'Ma Hnin Nu',
    customerPhone: '09786543210',
    dateTime: '2026-06-05T12:30',
    items: [
      {
        id: 'item-1',
        description: 'Motherboard Logic Board Motherboard Level Circuit Repair (Liquid Damage)',
        quantity: 1,
        unitPrice: 180000,
        amount: 180000,
      },
      {
        id: 'item-2',
        description: 'SMD Capacitors & Power IC Sourcing Charge',
        quantity: 1,
        unitPrice: 35000,
        amount: 35000,
      },
      {
        id: 'item-3',
        description: 'On-site Technician Home Visit & Diagnostic Service Fee',
        quantity: 1,
        unitPrice: 15000,
        amount: 15000,
      }
    ],
    subtotal: 230000,
    tax: 11500, // 5% commercial tax
    discount: 15000, // discount
    total: 226500,
    paymentStatus: 'Paid',
    paymentMethod: 'KBZPay',
    notes: 'Payment verified via KBZPay Transaction ID: KBP887261902. Warranty: 3 Months for board circuitry.',
    createdTime: '2026-06-05T12:35:00Z',
  }
];

// LocalStorage helpers to simulate database operations
export function getStoredJobs(): ServiceJob[] {
  const jobs = localStorage.getItem('cs_jobs');
  if (!jobs) {
    localStorage.setItem('cs_jobs', JSON.stringify(INITIAL_JOBS));
    return INITIAL_JOBS;
  }
  return JSON.parse(jobs);
}

export function saveStoredJobs(jobs: ServiceJob[]) {
  localStorage.setItem('cs_jobs', JSON.stringify(jobs));
}

export function getStoredTechnicians(): Technician[] {
  const techs = localStorage.getItem('cs_technicians');
  if (!techs) {
    localStorage.setItem('cs_technicians', JSON.stringify(INITIAL_TECHNICIANS));
    return INITIAL_TECHNICIANS;
  }
  return JSON.parse(techs);
}

export function saveStoredTechnicians(techs: Technician[]) {
  localStorage.setItem('cs_technicians', JSON.stringify(techs));
}

export function getStoredInvoices(): Invoice[] {
  const invoices = localStorage.getItem('cs_invoices');
  if (!invoices) {
    localStorage.setItem('cs_invoices', JSON.stringify(INITIAL_INVOICES));
    return INITIAL_INVOICES;
  }
  return JSON.parse(invoices);
}

export function saveStoredInvoices(invoices: Invoice[]) {
  localStorage.setItem('cs_invoices', JSON.stringify(invoices));
}

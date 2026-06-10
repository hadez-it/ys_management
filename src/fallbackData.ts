import { ServiceJob, Invoice, DeletedJob } from './types.ts';

export const INITIAL_FALLBACK_USERS = [
  {
    id: "usr-01",
    username: "admin",
    password: "admin",
    name: "System Admin Ko Phyo",
    role: "admin",
    phone: "09971234567"
  },
  {
    id: "usr-02",
    username: "coordinator",
    password: "coordinator",
    name: "Coordinator Daw Su",
    role: "coordinator",
    phone: "09971234568"
  },
  {
    id: "usr-03",
    username: "senior",
    password: "senior",
    name: "Senior Tech Ko Tin",
    role: "senior_technician",
    phone: "09971234569"
  },
  {
    id: "usr-04",
    username: "tech",
    password: "tech",
    name: "Technician Ko Sai",
    role: "technician",
    phone: "09971234570"
  }
];

export const INITIAL_JOBS_FALLBACK: ServiceJob[] = [
  {
    id: "JOB-2026-001",
    customerName: "Daw Tin Tin Aye",
    customerPhone: "09421055667",
    dateTime: "2026-06-07T10:00",
    locationText: "No. (45), Pyay Road, Sanchaung Township, Yangon",
    locationCoords: { lat: 16.8122, lng: 96.1345 },
    deviceType: "Laptop",
    deviceModel: "Dell Inspiron 15",
    deviceIssue: "Screen flickering heavily and battery drains within 10 minutes. Needs diagnostic and likely a replacement screen and battery.",
    urgency: "High",
    status: "Created",
    createdAt: "2026-06-06T09:00:00Z",
    updatedAt: "2026-06-06T09:00:00Z"
  },
  {
    id: "JOB-2026-002",
    customerName: "Ko Sai Sai",
    customerPhone: "09254332115",
    dateTime: "2026-06-06T14:30",
    locationText: "No. (12), Malikha Street, Mayangone Township, Yangon",
    locationCoords: { lat: 16.8524, lng: 96.1518 },
    deviceType: "Desktop",
    deviceModel: "Custom Built Gaming PC",
    deviceIssue: "No display when powering on. RGB lights turn on, fans run, but no signal to the monitor.",
    urgency: "Medium",
    status: "Dispatched",
    createdAt: "2026-06-05T14:00:00Z",
    updatedAt: "2026-06-06T10:30:00Z"
  },
  {
    id: "JOB-2026-003",
    customerName: "Ma Hnin Nu",
    customerPhone: "09786543210",
    dateTime: "2026-06-05T09:30",
    locationText: "Apartment 4B, Pearl Condo, Bahan Township, Yangon",
    locationCoords: { lat: 16.8208, lng: 96.1554 },
    deviceType: "Laptop",
    deviceModel: "MacBook Air M1 2020",
    deviceIssue: "Spilled coffee over keyboard. Refuses to power on.",
    urgency: "Critical",
    status: "Completed",
    diagnosedProblem: "Liquid damage on power management (PMIC).",
    resolutionNotes: "Ultrasonic cleaned and replaced PPBUS shorted logic capacitors.",
    createdAt: "2026-06-04T10:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z",
    invoiceId: "INV-2026-101"
  }
];

export const INITIAL_INVOICES_FALLBACK: Invoice[] = [
  {
    id: "INV-2026-101",
    jobId: "JOB-2026-003",
    customerName: "Ma Hnin Nu",
    customerPhone: "09786543210",
    dateTime: "2026-06-05T12:30",
    items: [
      {
        id: "item-1",
        description: "Motherboard Logic Board Circuit Repair (Coffee damage)",
        quantity: 1,
        unitPrice: 180000,
        amount: 180000
      },
      {
        id: "item-2",
        description: "On-site diagnostic and component sourcing",
        quantity: 1,
        unitPrice: 20000,
        amount: 20000
      }
    ],
    subtotal: 200000,
    tax: 10000,
    discount: 5000,
    total: 205000,
    paymentStatus: "Paid",
    paymentMethod: "KBZPay",
    notes: "Completed by head workshop engineer. Standard 3 months warranty.",
    createdTime: "2026-06-05T12:35:00Z"
  }
];

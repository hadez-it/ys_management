import { ServiceJob, Invoice, DeletedJob } from './types.ts';

export const INITIAL_FALLBACK_USERS = [
  {
    id: "usr-01",
    username: "admin",
    name: "System Admin Ko Phyo",
    role: "admin",
    phone: "09971234567"
  },
  {
    id: "usr-02",
    username: "coordinator",
    name: "Coordinator Daw Su",
    role: "coordinator",
    phone: "09971234568"
  },
  {
    id: "usr-03",
    username: "senior",
    name: "Senior Tech Ko Tin",
    role: "senior_technician",
    phone: "09971234569"
  },
  {
    id: "usr-04",
    username: "tech",
    name: "Technician Ko Sai",
    role: "technician",
    phone: "09971234570"
  }
];

export const INITIAL_JOBS_FALLBACK: ServiceJob[] = [];

export const INITIAL_INVOICES_FALLBACK: Invoice[] = [];

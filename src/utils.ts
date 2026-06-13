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
  
  if (dateString.includes('Tnone') || dateString.endsWith('T') || dateString.includes('none')) {
    const datePart = dateString.split('T')[0];
    const date = new Date(datePart);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) + ' (No specific time)';
    }
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    const datePart = dateString.split('T')[0];
    const testDate = new Date(datePart);
    if (!isNaN(testDate.getTime())) {
      return testDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) + ' (No specific time)';
    }
    return dateString;
  }
  
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
export const INITIAL_JOBS: ServiceJob[] = [];

// Mock invoice for the completed job
export const INITIAL_INVOICES: Invoice[] = [];

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

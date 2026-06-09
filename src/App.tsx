import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Inbox,
  PlusCircle,
  FileText,
  Sparkles,
  Laptop,
  Cpu,
  History,
  Info,
  Layers,
  MapPin,
  TrendingUp,
  Settings,
  Database,
  Trash2,
  Users,
  LogOut,
  Calendar,
  Layers3
} from 'lucide-react';
import { ServiceJob, Invoice, JobStatus, DeviceType, UrgencyLevel, LocationCoords, DeletedJob, User, UserRole } from './types.ts';
import {
  formatMMK,
  MAP_CENTER_YANGON
} from './utils.ts';

// Import components
import DashboardStats from './components/DashboardStats.tsx';
import JobForm from './components/JobForm.tsx';
import JobList from './components/JobList.tsx';
import InvoiceGenerator from './components/InvoiceGenerator.tsx';
import InvoiceView from './components/InvoiceView.tsx';
import Login from './components/Login.tsx';
import UserManagement from './components/UserManagement.tsx';

export default function App() {
  // User Session Management
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cached = sessionStorage.getItem('smartfix_current_user');
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  });

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('smartfix_current_user', JSON.stringify(user));
    } catch (_) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('smartfix_current_user');
    } catch (_) {}
  };

  // Global States synced with Express REST + MongoDB Server
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deletedJobs, setDeletedJobs] = useState<DeletedJob[]>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; isDemo: boolean; modeMessage?: string; uriUsed?: string } | null>(null);

  // Routing and interactive view triggers
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'invoices' | 'deleted' | 'users'>('dashboard');
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  
  // Specific wizard triggers
  const [invoiceWizardJob, setInvoiceWizardJob] = useState<ServiceJob | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const fetchDeletedJobs = () => {
    fetch('/api/deleted-jobs')
      .then((res) => res.json())
      .then((data) => setDeletedJobs(data || []))
      .catch((err) => console.error('Error fetching deleted jobs:', err));
  };

  // If role changes, reset activeTab to dashboard if current tab is restricted
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role;
    if (activeTab === 'deleted' && role !== 'admin') {
      setActiveTab('dashboard');
    } else if (activeTab === 'users' && role !== 'admin') {
      setActiveTab('dashboard');
    } else if (activeTab === 'invoices' && (role === 'coordinator' || role === 'technician')) {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  // Load state on mount from Backend APIs
  useEffect(() => {
    fetch('/api/db-status')
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((err) => console.error('Error fetching db status:', err));

    const fetchJobs = () => {
      fetch('/api/jobs')
        .then((res) => res.json())
        .then((data) => setJobs(data || []))
        .catch((err) => console.error('Error fetching jobs:', err));
    };

    fetchJobs();

    fetch('/api/invoices')
      .then((res) => res.json())
      .then((data) => setInvoices(data || []))
      .catch((err) => console.error('Error fetching invoices:', err));

    fetchDeletedJobs();

    // Poll jobs endpoint every 60 seconds
    const intervalId = setInterval(fetchJobs, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // 1. Create a service job trigger
  const handleCreateJob = (jobDetails: Omit<ServiceJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const nextIdNum = jobs.length + 101 + Math.floor(Math.random() * 900);
    const newJob: ServiceJob = {
      ...jobDetails,
      id: `JOB-2026-${nextIdNum}`,
      status: 'Created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJob),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to create job');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => [savedJob, ...prev]);
        setIsNewTicketModalOpen(false);
        setActiveTab('queue'); // Jump straight to dispatching queue
      })
      .catch((err) => {
        alert('Server sync error: ' + err.message);
      });
  };

  // 2. Update service job status
  const handleUpdateJobStatus = (
    jobId: string,
    status: JobStatus,
    technicianName?: string,
    diagnosedProblem?: string,
    resolutionNotes?: string,
    remarks?: string
  ) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const updatedFields = {
      status,
      technicianName: technicianName !== undefined ? technicianName : targetJob.technicianName,
      diagnosedProblem: diagnosedProblem !== undefined ? diagnosedProblem : targetJob.diagnosedProblem,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : targetJob.resolutionNotes,
      remarks: remarks !== undefined ? remarks : targetJob.remarks,
      updatedAt: new Date().toISOString(),
    };

    fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFields),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update job status');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
        if (status === 'Completed') {
          setInvoiceWizardJob(savedJob);
        }
      })
      .catch((err) => {
        alert('Server sync status error: ' + err.message);
      });
  };

  // Update priority ranking
  const handleUpdateJobPriority = (jobId: string, priorityNumber: number | undefined) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const updatedFields = {
      priorityNumber,
      updatedAt: new Date().toISOString(),
    };

    fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFields),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update priority ranking');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
      })
      .catch((err) => {
        alert('Server priority sync error: ' + err.message);
      });
  };

  // Delete customer job and log reason
  const handleDeleteJob = (jobId: string, reason: string) => {
    fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete job');
        return res.json();
      })
      .then(() => {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        fetchDeletedJobs();
      })
      .catch((err) => {
        alert('Server deletion sync error: ' + err.message);
      });
  };

  // Edit job details
  const handleEditJob = (jobId: string, updatedJobData: any) => {
    fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedJobData),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to edit job');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
      })
      .catch((err) => {
        alert('Server job update sync error: ' + err.message);
      });
  };

  // Open invoice wizard
  const handleOpenInvoiceWizard = (jobToBill: ServiceJob) => {
    setInvoiceWizardJob(jobToBill);
  };

  // Save invoice
  const handleSaveInvoice = (invoiceDetails: Omit<Invoice, 'id' | 'createdTime'>) => {
    if (!invoiceWizardJob) return;

    const nextInvIdNum = invoices.length + 501 + Math.floor(Math.random() * 900);
    const newInvoice: Invoice = {
      ...invoiceDetails,
      id: `INV-2026-${nextInvIdNum}`,
      createdTime: new Date().toISOString(),
    };

    fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvoice),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to save invoice');
        return res.json();
      })
      .then((savedInvoice) => {
        setInvoices((prev) => [savedInvoice, ...prev]);

        // Link invoice key to job and lock job
        const updatedJobFields = {
          status: 'Completed' as JobStatus,
          invoiceId: savedInvoice.id,
          updatedAt: new Date().toISOString(),
        };

        return fetch(`/api/jobs/${invoiceWizardJob.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedJobFields),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Failed to update job reference');
            return res.json();
          })
          .then((updatedJob) => {
            setJobs((prev) => prev.map((j) => (j.id === invoiceWizardJob.id ? updatedJob : j)));
            setInvoiceWizardJob(null);
            setViewingInvoice(savedInvoice);
          });
      })
      .catch((err) => {
        alert('Invoicing sync error: ' + err.message);
      });
  };

  const handleOpenStatusFilterFromDashboard = (filter: string) => {
    setStatusFilter(filter);
    setActiveTab('queue');
  };

  const handleViewInvoiceById = (invoiceId: string) => {
    const found = invoices.find((i) => i.id === invoiceId);
    if (found) {
      setViewingInvoice(found);
    } else {
      alert('Invoice receipt trace missing in local registers.');
    }
  };

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Filter visible tabs based on role
  const visibleTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'queue', label: 'Service Queue', icon: Inbox },
    { id: 'invoices', label: 'Invoice Ledger', icon: FileText },
    { id: 'deleted', label: 'Disposal Logs', icon: Trash2 },
    { id: 'users', label: 'Operators', icon: Users },
  ].filter((tab) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'senior_technician') {
      return tab.id !== 'deleted' && tab.id !== 'users';
    }
    // Coordinator and technician only see Dashboard and Service Queue
    return tab.id === 'dashboard' || tab.id === 'queue';
  });

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans antialiased pb-20 lg:pb-0 flex flex-col lg:flex-row" id="app-viewport">
      
      {/* DESKTOP SIDEBAR (Visible only on screens lg and up) */}
      <aside className="hidden lg:flex lg:w-64 bg-slate-950 text-white flex-col shrink-0 fixed top-0 bottom-0 left-0 border-r border-slate-900 z-30 select-none" id="desktop-sidebar">
        {/* Brand Banner */}
        <div className="p-6 border-b border-slate-900 flex items-center gap-3">
          <div className="bg-white text-slate-950 p-2 rounded-xl flex items-center justify-center shadow-sm">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest font-display text-slate-100">
              SmartFix
            </h1>
            <p className="text-[10px] text-slate-450 font-bold">Solutions Enterprise</p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setInvoiceWizardJob(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-150 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile Details */}
        <div className="p-4 border-t border-slate-900 bg-slate-950 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center font-extrabold text-xs text-slate-205 uppercase tracking-wider shrink-0 select-none">
              {currentUser?.name[0]}
            </div>
            <div className="flex-1 min-w-0 pr-1 text-left">
              <p className="text-xs font-bold text-slate-100 truncate leading-none mb-1">{currentUser?.name}</p>
              <span className="text-[9px] font-extrabold uppercase bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                {currentUser?.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 inline-flex items-center justify-center gap-1.5 border border-slate-800 hover:border-rose-500/30 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" /> Log Out
            </button>
            {dbStatus && (
              <div 
                className={`flex items-center justify-center h-8 w-8 rounded-lg border shrink-0 ${
                  dbStatus.connected ? 'border-emerald-900 bg-emerald-950/25' : 'border-amber-900 bg-amber-950/25'
                }`}
                title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed}` : "Sandbox Local Mode"}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${
                  dbStatus.connected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-amber-500'
                }`} />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE MAIN CONTAINER */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* RESPONSIVE FLUID HEADER */}
        <header className="bg-white border-b border-slate-200/55 sticky top-0 z-20 shrink-0 select-none" id="shop-header">
          <div className="mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            
            {/* Title / Mobile Brand */}
            <div className="flex items-center gap-2.5 text-left">
              <div className="bg-slate-950 text-white p-2 rounded-xl flex items-center justify-center lg:hidden shrink-0">
                <Wrench className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm lg:text-base font-extrabold tracking-tight text-slate-900 font-display">
                  {activeTab === 'dashboard' ? 'Overview Stats' :
                   activeTab === 'queue' ? 'Dispatching Queue' :
                   activeTab === 'invoices' ? 'Billing History' :
                   activeTab === 'deleted' ? 'Disposal Registry' : 'Team Directory'}
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase hidden sm:block">
                  SmartFix Dispatch Hub
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              
              {/* User Identity - Hidden in lg sidebar format but visible in md size header */}
              <div className="text-right hidden sm:block lg:hidden select-none">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name}
                </p>
                <span className="inline-block text-[9px] font-extrabold bg-slate-100 text-slate-500 px-1.5 rounded uppercase mt-0.5 border border-slate-200">
                  {currentUser?.role.replace('_', ' ')}
                </span>
              </div>

              {(currentUser?.role === 'admin' || currentUser?.role === 'coordinator') && (
                <button
                  type="button"
                  id="btn-shortcut-add-job"
                  onClick={() => setIsNewTicketModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-850 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all active:scale-98 shadow-sm"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New Ticket</span><span className="sm:hidden">New</span>
                </button>
              )}

              {/* Log out for small screens */}
              <div className="flex items-center gap-1.5 lg:hidden">
                {dbStatus && (
                  <div 
                    className={`flex items-center justify-center h-9 w-9 rounded-xl border ${
                      dbStatus.connected ? 'border-emerald-100 bg-emerald-50/40 text-emerald-600' : 'border-amber-100 bg-amber-50/40 text-amber-600'
                    }`}
                    title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed}` : "Sandbox Local Mode"}
                  >
                    <span className={`h-2 w-2 rounded-full ${
                      dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-slate-450 hover:text-rose-600 border border-slate-200 rounded-xl p-2.5 transition-all bg-white cursor-pointer hover:bg-rose-50/20"
                  title="Log Out Session"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>


        {/* MAIN BODY AREA & WORKSPACE */}
        <main className="w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
          
          {invoiceWizardJob ? (
            <InvoiceGenerator
              job={invoiceWizardJob}
              onSaveInvoice={handleSaveInvoice}
              onCancel={() => setInvoiceWizardJob(null)}
            />
          ) : (
            <div className="space-y-6">
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in" id="dashboard-tab-module">
                  <DashboardStats
                    jobs={jobs}
                    invoices={invoices}
                    onSelectedStatusFilter={handleOpenStatusFilterFromDashboard}
                  />
                </div>
              )}

              {activeTab === 'queue' && (
                <div className="animate-fade-in" id="dispatcher-queue-tab-module">
                  <JobList
                    jobs={jobs}
                    onUpdateJobStatus={handleUpdateJobStatus}
                    onUpdateJobPriority={handleUpdateJobPriority}
                    onOpenInvoiceWizard={handleOpenInvoiceWizard}
                    onViewInvoice={handleViewInvoiceById}
                    onDeleteJob={handleDeleteJob}
                    onEditJob={handleEditJob}
                    currentUser={currentUser || undefined}
                  />
                </div>
              )}

              {activeTab === 'invoices' && (
                <div className="bg-white border border-slate-200/55 rounded-2xl p-5 md:p-6 shadow-xs text-left animate-fade-in space-y-5" id="invoices-list-tab-module">
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-slate-900 text-base tracking-tight font-display flex items-center gap-1.5">
                      <History className="h-5 w-5 text-slate-800" /> Settlement Ledger
                    </h3>
                    <p className="text-xs text-slate-400">Review final transaction logs, KBZPay entries, and invoices details.</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto" id="historic-invoices-register">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                        <tr>
                          <th className="p-4">Ref Number</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4">Payment Method</th>
                          <th className="p-4 text-right">Settled Amount</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-center w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="p-4 font-mono font-bold text-slate-900">{inv.id}</td>
                            <td className="p-4">
                              <p className="font-bold text-slate-900">{inv.customerName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</p>
                            </td>
                            <td className="p-4 font-semibold text-slate-600">{inv.paymentMethod}</td>
                            <td className="p-4 text-right font-extrabold text-slate-900 font-display">{formatMMK(inv.total)}</td>
                            <td className="p-4 text-center">
                              <span className="inline-flex text-[9px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-250 font-bold select-none">
                                Paid
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                type="button"
                                id={`view-registered-inv-${inv.id}`}
                                onClick={() => setViewingInvoice(inv)}
                                className="text-xs text-slate-950 hover:text-slate-800 font-bold cursor-pointer"
                              >
                                View Invoice
                              </button>
                            </td>
                          </tr>
                        ))}
                        {invoices.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                              No settlements logged yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'deleted' && (
                <div className="bg-white border border-slate-200/55 rounded-2xl p-5 md:p-6 shadow-xs text-left animate-fade-in space-y-5" id="deleted-list-tab-module">
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-slate-900 text-base tracking-tight font-display flex items-center gap-1.5 text-rose-600">
                      <Trash2 className="h-5 w-5 text-rose-650" /> Disposal & Disposal Archive
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Archived cancellations logs and delete reasons</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto" id="deleted-jobs-register">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                        <tr>
                          <th className="p-4">Ticket Ref</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4">Deleted Clock</th>
                          <th className="p-4">Original Device</th>
                          <th className="p-4">Cancellation Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {deletedJobs.map((delJob) => {
                          const dateText = delJob.deletedAt ? new Date(delJob.deletedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-';
                          return (
                            <tr key={delJob.id + delJob.deletedAt} className="hover:bg-rose-50/10">
                              <td className="p-4 font-mono font-bold text-rose-655">{delJob.id}</td>
                              <td className="p-4">
                                <p className="font-bold text-slate-900">{delJob.customerName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{delJob.customerPhone}</p>
                              </td>
                              <td className="p-4 font-semibold text-slate-500">{dateText}</td>
                              <td className="p-4 font-bold text-slate-800">{delJob.originalJobData?.deviceType} {delJob.originalJobData?.deviceModel ? `(${delJob.originalJobData.deviceModel})` : ''}</td>
                              <td className="p-4">
                                <div className="bg-rose-50/60 text-rose-800 font-semibold px-3 py-1.5 rounded-lg border border-rose-100 text-[11px] leading-relaxed select-text">
                                  {delJob.deleteReason}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {deletedJobs.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                              No archived deletions logs yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <UserManagement currentUser={currentUser} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* POPUP RECEIPT MODAL */}
      {viewingInvoice && (
        <InvoiceView invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}

      {/* NEW TICKET REGISTRATION POPUP */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in" id="new-ticket-modal-overlay">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/30 max-h-[90vh] flex flex-col overflow-hidden animate-scale-up" id="new-ticket-modal-container">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 text-left select-none">
              <div>
                <h3 className="font-extrabold text-slate-905 text-base font-display">Register Service Work</h3>
                <p className="text-xs text-slate-400">Map coordinates pinning & urgent dispatcher dispatching</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 text-2xl font-bold rounded-lg hover:bg-slate-100 tracking-none leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            {/* Modal Form */}
            <div className="p-6 overflow-y-auto flex-1 text-left">
              <JobForm
                onSubmit={handleCreateJob}
                onCancel={() => setIsNewTicketModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* RESPONSIVE BOTTOM MOBILE NAVBAR (Invisible in wide viewports) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/70 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] lg:hidden select-none" id="workspace-bottom-nav">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-around">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-btn-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setInvoiceWizardJob(null);
                }}
                className={`flex-1 relative flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer transition-all outline-none group ${
                  isSelected
                    ? 'text-slate-950 scale-102'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${
                  isSelected ? 'bg-slate-100 text-slate-950' : 'group-hover:bg-slate-50'
                }`}>
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                </div>
                <span className={`text-[9px] font-bold tracking-tight mt-0.5 transition-colors ${
                  isSelected ? 'text-slate-950 font-black' : 'text-slate-400'
                }`}>
                  {tab.label.split(' ')[0]}
                </span>

                {isSelected && (
                  <span className="absolute top-0 w-2 h-1 rounded-b-full bg-slate-950 shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

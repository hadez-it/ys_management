import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Layers3,
  Terminal
} from 'lucide-react';
import { ServiceJob, Invoice, JobStatus, DeviceType, UrgencyLevel, LocationCoords, DeletedJob, User, UserRole, ActivityLog } from './types.ts';
import {
  formatMMK,
  MAP_CENTER_YANGON
} from './utils.ts';
import { INITIAL_JOBS_FALLBACK, INITIAL_INVOICES_FALLBACK } from './fallbackData.ts';

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

  // Authenticated fetch wrapper for custom JWT authorization
  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    if (currentUser?.token) {
      headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    if (currentUser?.username) {
      headers['X-Operator-Username'] = currentUser.username;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Global States synced with Express REST + MongoDB Server
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; isDemo: boolean; modeMessage?: string; uriUsed?: string; error?: string } | null>(null);

  // Routing and interactive view triggers
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'invoices' | 'deleted' | 'users'>('dashboard');
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [showDbStatusModal, setShowDbStatusModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  
  // Specific wizard triggers
  const [invoiceWizardJob, setInvoiceWizardJob] = useState<ServiceJob | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isWiping, setIsWiping] = useState(false);

  const fetchActivityLogs = () => {
    authFetch('/api/activity-logs')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setActivityLogs(data || []);
        localStorage.setItem('smartfix_activity_logs', JSON.stringify(data || []));
      })
      .catch((err) => {
        console.warn('Sandbox mode fallback: fetching activity logs.', err.message || err);
        const localActVal = localStorage.getItem('smartfix_activity_logs');
        if (localActVal) {
          setActivityLogs(JSON.parse(localActVal));
        } else {
          setActivityLogs([]);
          localStorage.setItem('smartfix_activity_logs', JSON.stringify([]));
        }
      });
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

  // Fetch DB Status (Public endpoint)
  useEffect(() => {
    fetch('/api/db-status')
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((err) => {
        console.info('Service environment db status check finished.', err.message || err);
        setDbStatus({
          connected: false,
          isDemo: false,
          modeMessage: 'Database Connection Offline. Please check your MONGO_URI setup in Settings/Secrets.'
        });
      });
  }, []);

  // Load state from Backend APIs when user is logged-authorized
  useEffect(() => {
    if (!currentUser?.token) {
      // Just fallback to local storage values silently if user is not authenticated yet
      const localJobsVal = localStorage.getItem('smartfix_jobs');
      const localInvsVal = localStorage.getItem('smartfix_invoices');
      const localActVal = localStorage.getItem('smartfix_activity_logs');
      
      if (localJobsVal) {
        setJobs(JSON.parse(localJobsVal));
      } else {
        setJobs(INITIAL_JOBS_FALLBACK);
      }
      
      if (localInvsVal) {
        setInvoices(JSON.parse(localInvsVal));
      } else {
        setInvoices(INITIAL_INVOICES_FALLBACK);
      }
      
      if (localActVal) {
        setActivityLogs(JSON.parse(localActVal));
      } else {
        setActivityLogs([]);
      }
      return;
    }

    const fetchJobs = () => {
      authFetch('/api/jobs')
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setJobs(data || []);
          localStorage.setItem('smartfix_jobs', JSON.stringify(data || []));
        })
        .catch((err) => {
          console.warn('Sandbox mode fallback: fetching jobs.', err.message || err);
          const localJobsVal = localStorage.getItem('smartfix_jobs');
          if (localJobsVal) {
            setJobs(JSON.parse(localJobsVal));
          } else {
            setJobs(INITIAL_JOBS_FALLBACK);
            localStorage.setItem('smartfix_jobs', JSON.stringify(INITIAL_JOBS_FALLBACK));
          }
        });
    };

    fetchJobs();

    authFetch('/api/invoices')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setInvoices(data || []);
        localStorage.setItem('smartfix_invoices', JSON.stringify(data || []));
      })
      .catch((err) => {
        console.warn('Sandbox mode fallback: fetching invoices.', err.message || err);
        const localInvsVal = localStorage.getItem('smartfix_invoices');
        if (localInvsVal) {
          setInvoices(JSON.parse(localInvsVal));
        } else {
          setInvoices(INITIAL_INVOICES_FALLBACK);
          localStorage.setItem('smartfix_invoices', JSON.stringify(INITIAL_INVOICES_FALLBACK));
        }
      });

    // Fetch activity logs helper
    const fetchActivityLogsOnStart = () => {
      authFetch('/api/activity-logs')
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setActivityLogs(data || []);
          localStorage.setItem('smartfix_activity_logs', JSON.stringify(data || []));
        })
        .catch((err) => {
          console.warn('Sandbox mode fallback: fetching activity logs.', err.message || err);
          const localActVal = localStorage.getItem('smartfix_activity_logs');
          if (localActVal) {
            setActivityLogs(JSON.parse(localActVal));
          } else {
            setActivityLogs([]);
            localStorage.setItem('smartfix_activity_logs', JSON.stringify([]));
          }
        });
    };

    fetchActivityLogsOnStart();

    // Poll jobs endpoint every 8 seconds for a near-realtime dynamic auto-update
    const intervalId = setInterval(() => {
      authFetch('/api/jobs')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((data) => {
          setJobs(data || []);
          localStorage.setItem('smartfix_jobs', JSON.stringify(data || []));
        })
        .catch(() => {
          // Keep offline state silently running
        });
    }, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser?.token]);

  // Global modal watcher hook to prevent background body and container scrolling
  useEffect(() => {
    const checkModals = () => {
      const activeOverlay = document.getElementById('new-ticket-modal-overlay') || 
                            document.getElementById('job-detail-modal-backdrop') || 
                            document.getElementById('priority-selector-overlay') || 
                            document.getElementById('edit-details-modal-overlay') || 
                            document.getElementById('invoice-view-modal') ||
                            document.getElementById('db-status-detail-modal-overlay');
      if (activeOverlay) {
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');
      } else {
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
      }
    };

    checkModals();

    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isNewTicketModalOpen, viewingInvoice, invoiceWizardJob, showDbStatusModal]);

  // Android / Mobile Focus and Keyboard Recovery on app-switch or backgrounding
  useEffect(() => {
    const handleFocusRecovery = () => {
      // Force DOM and rendering reflow for Chrome Android to prevent tap/typing freeze issues
      // Touches the body height slightly to trigger an immediate browser layout update.
      const currentBodyMinHeight = document.body.style.minHeight;
      document.body.style.minHeight = '100.1vh';
      
      // Trigger a force repaint/style-recalculation
      document.body.offsetHeight; // force reflow

      setTimeout(() => {
        document.body.style.minHeight = currentBodyMinHeight;
      }, 50);
    };

    window.addEventListener('pageshow', handleFocusRecovery, true);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocusRecovery();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handleFocusRecovery, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 1. Create a service job trigger
  const handleCreateJob = (jobDetails: Omit<ServiceJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    if (isDispatching) return;
    setIsDispatching(true);

    const nextIdNum = jobs.length + 101 + Math.floor(Math.random() * 900);
    const newJob: ServiceJob = {
      ...jobDetails,
      id: `JOB-2026-${nextIdNum}`,
      status: 'Created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    authFetch('/api/jobs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newJob),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to create job');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => {
          const updated = [savedJob, ...prev];
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        fetchActivityLogs();
        setIsNewTicketModalOpen(false);
        setIsDispatching(false);
        setActiveTab('queue');
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = [newJob, ...prev];
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        setIsNewTicketModalOpen(false);
        setIsDispatching(false);
        setActiveTab('queue');
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

    const updatedJob: ServiceJob = {
      ...targetJob,
      status,
      technicianName: technicianName !== undefined ? technicianName : targetJob.technicianName,
      diagnosedProblem: diagnosedProblem !== undefined ? diagnosedProblem : targetJob.diagnosedProblem,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : targetJob.resolutionNotes,
      remarks: remarks !== undefined ? remarks : targetJob.remarks,
      updatedAt: new Date().toISOString(),
    };

    authFetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedJob),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update job status');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? savedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        fetchActivityLogs();
        if (status === 'Completed') {
          setInvoiceWizardJob(savedJob);
        }
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? updatedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        if (status === 'Completed') {
          setInvoiceWizardJob(updatedJob);
        }
      });
  };

  // Update priority ranking
  const handleUpdateJobPriority = (jobId: string, priorityNumber: number | undefined) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const updatedJob: ServiceJob = {
      ...targetJob,
      updatedAt: new Date().toISOString(),
    };
    if (priorityNumber !== undefined) {
      updatedJob.priorityNumber = priorityNumber;
    } else {
      delete updatedJob.priorityNumber;
    }

    authFetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priorityNumber: priorityNumber === undefined ? null : priorityNumber, updatedAt: updatedJob.updatedAt }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update priority ranking');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? savedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? updatedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
      });
  };

  // Delete customer job and log reason
  const handleDeleteJob = (jobId: string, reason: string) => {
    const jobToDelete = jobs.find((j) => j.id === jobId);

    authFetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to delete job');
        return res.json();
      })
      .then(() => {
        setJobs((prev) => {
          const updated = prev.filter((j) => j.id !== jobId);
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        fetchActivityLogs();
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = prev.filter((j) => j.id !== jobId);
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });

        if (jobToDelete) {
          const newActLog: ActivityLog = {
            id: 'ACT-LOCAL-' + Date.now(),
            actionType: 'Deleted',
            jobId: jobToDelete.id,
            customerName: jobToDelete.customerName,
            deviceType: jobToDelete.deviceType,
            username: currentUser?.username || 'system',
            timestamp: new Date().toISOString(),
            details: `Ticket permanently deleted. Reason/Explanations: ${reason}`
          };
          setActivityLogs((prev) => {
            const updated = [newActLog, ...prev];
            localStorage.setItem('smartfix_activity_logs', JSON.stringify(updated));
            return updated;
          });
        }
      });
  };

  // Edit job details
  const handleEditJob = (jobId: string, updatedJobData: any) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    const updatedJob = targetJob ? { ...targetJob, ...updatedJobData, updatedAt: new Date().toISOString() } : null;

    authFetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedJobData),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to edit job');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? savedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });
        fetchActivityLogs();
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        if (updatedJob) {
          setJobs((prev) => {
            const updated = prev.map((j) => (j.id === jobId ? updatedJob : j));
            localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
            return updated;
          });
        }
      });
  };

  // Completely clean dataset of all legacy/mock jobs and invoices
  const handleWipeAllData = () => {
    if (!window.confirm('Are you absolutely sure you want to completely erase all active jobs, invoices, and history to start with a fresh blank workspace? This operation clears all pre-setup/mock data.')) {
      return;
    }
    setIsWiping(true);
    authFetch('/api/system/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Wipe operation failed');
        return res.json();
      })
      .then(() => {
        setJobs([]);
        setInvoices([]);
        setActivityLogs([]);
        localStorage.setItem('smartfix_jobs', JSON.stringify([]));
        localStorage.setItem('smartfix_invoices', JSON.stringify([]));
        localStorage.setItem('smartfix_activity_logs', JSON.stringify([]));
        setShowDbStatusModal(false);
      })
      .catch((err) => {
        console.error('Wipe error:', err);
        // Clean up client-side fallback as fallback
        setJobs([]);
        setInvoices([]);
        setActivityLogs([]);
        localStorage.setItem('smartfix_jobs', JSON.stringify([]));
        localStorage.setItem('smartfix_invoices', JSON.stringify([]));
        localStorage.setItem('smartfix_activity_logs', JSON.stringify([]));
        setShowDbStatusModal(false);
      })
      .finally(() => {
        setIsWiping(false);
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

    authFetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvoice),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to save invoice');
        return res.json();
      })
      .then((savedInvoice) => {
        setInvoices((prev) => {
          const updated = [savedInvoice, ...prev];
          localStorage.setItem('smartfix_invoices', JSON.stringify(updated));
          return updated;
        });

        // Link invoice key to job and lock job
        const updatedJobFields = {
          status: 'Completed' as JobStatus,
          invoiceId: savedInvoice.id,
          updatedAt: new Date().toISOString(),
        };

        return authFetch(`/api/jobs/${invoiceWizardJob.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedJobFields),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Failed to update job reference');
            return res.json();
          })
          .then((updatedJob) => {
            setJobs((prev) => {
              const updated = prev.map((j) => (j.id === invoiceWizardJob.id ? updatedJob : j));
              localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
              return updated;
            });
            setInvoiceWizardJob(null);
            setViewingInvoice(savedInvoice);
          });
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setInvoices((prev) => {
          const updated = [newInvoice, ...prev];
          localStorage.setItem('smartfix_invoices', JSON.stringify(updated));
          return updated;
        });

        const updatedJob: ServiceJob = {
          ...invoiceWizardJob,
          status: 'Completed' as JobStatus,
          invoiceId: newInvoice.id,
          updatedAt: new Date().toISOString(),
        };

        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === invoiceWizardJob.id ? updatedJob : j));
          localStorage.setItem('smartfix_jobs', JSON.stringify(updated));
          return updated;
        });

        setInvoiceWizardJob(null);
        setViewingInvoice(newInvoice);
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
    return <Login onLoginSuccess={handleLoginSuccess} dbStatus={dbStatus} />;
  }

  // Filter visible tabs based on role
  const visibleTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'queue', label: 'Service Queue', icon: Inbox },
    { id: 'invoices', label: 'Invoice Ledger', icon: FileText },
    { id: 'deleted', label: 'Activity Logs', icon: History },
    { id: 'users', label: 'Users', icon: Users },
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
    <div className="h-screen bg-slate-50/50 text-slate-800 font-sans antialiased flex flex-col lg:flex-row overflow-hidden" id="app-viewport">
      
      {/* DESKTOP SIDEBAR (Visible only on screens lg and up) */}
      <aside className="hidden lg:flex lg:w-64 bg-slate-950 text-white flex-col shrink-0 fixed top-0 bottom-0 left-0 border-r border-slate-900 z-30 select-none" id="desktop-sidebar">
        {/* Brand Banner */}
        <div className="p-6 border-b border-slate-900 flex items-center gap-3">
          <div className="bg-black text-slate-100 border border-slate-800 p-2 rounded-xl flex items-center justify-center shadow-sm">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest font-display text-slate-100">
              YS SVC
            </h1>
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
              <button 
                type="button"
                onClick={() => setShowDbStatusModal(true)}
                className={`flex items-center justify-center h-8 w-8 rounded-lg border shrink-0 cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none ${
                  dbStatus.connected ? 'border-emerald-900 bg-emerald-950/25 focus:ring-1 focus:ring-emerald-500' : 'border-amber-900 bg-amber-950/25 focus:ring-1 focus:ring-amber-500'
                }`}
                title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed} (Click for details)` : (dbStatus.error ? `DB Connection Failed: ${dbStatus.error} (Click for details)` : `${dbStatus.modeMessage || "Sandbox Local Mode"} (Click for details)`)}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${
                  dbStatus.connected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-amber-500'
                }`} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE MAIN CONTAINER */}
      <div className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden">
        
        {/* RESPONSIVE FLUID HEADER */}
        <header className="bg-white border-b border-slate-200/55 z-20 shrink-0 select-none" id="shop-header">
          <div className="mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            
            {/* Title / Mobile Brand */}
            <div className="flex items-center gap-2.5 text-left">
              <div className="bg-slate-950 text-white p-2 rounded-xl flex items-center justify-center lg:hidden shrink-0">
                <Terminal className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm lg:text-base font-extrabold tracking-tight text-slate-900 font-display">
                  {activeTab === 'dashboard' ? 'Overview Stats' :
                   activeTab === 'queue' ? 'Dispatching Queue' :
                   activeTab === 'invoices' ? 'Billing History' :
                   activeTab === 'deleted' ? 'Activity Log History' : 'Team Directory'}
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase hidden sm:block">
                  YS SVC Dispatch Hub
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
                  onClick={() => {
                    setIsDispatching(false);
                    setIsNewTicketModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-850 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all active:scale-98 shadow-sm"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New Ticket</span><span className="sm:hidden">New</span>
                </button>
              )}

              {/* Log out for small screens */}
              <div className="flex items-center gap-1.5 lg:hidden">
                {dbStatus && (
                  <button 
                    type="button"
                    onClick={() => setShowDbStatusModal(true)}
                    className={`flex items-center justify-center h-9 w-9 rounded-xl border cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none ${
                      dbStatus.connected ? 'border-emerald-100 bg-emerald-50/40 text-emerald-600 focus:ring-1 focus:ring-emerald-500' : 'border-amber-100 bg-amber-50/40 text-amber-600 focus:ring-1 focus:ring-amber-500'
                    }`}
                    title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed} (Click for details)` : (dbStatus.error ? `DB Connection Failed: ${dbStatus.error} (Click for details)` : `${dbStatus.modeMessage || "Sandbox Local Mode"} (Click for details)`)}
                  >
                    <span className={`h-2 w-2 rounded-full ${
                      dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`} />
                  </button>
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
        <main className="w-full px-4 sm:px-6 py-6 flex-1 overflow-y-auto pb-24 lg:pb-6 space-y-6">
          
          {invoiceWizardJob ? (
            <InvoiceGenerator
              job={invoiceWizardJob}
              onSaveInvoice={handleSaveInvoice}
              onCancel={() => setInvoiceWizardJob(null)}
            />
          ) : (
            <div className="overflow-x-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  {activeTab === 'dashboard' && (
                    <div className="space-y-6" id="dashboard-tab-module">
                      <DashboardStats
                        jobs={jobs}
                        invoices={invoices}
                        onSelectedStatusFilter={handleOpenStatusFilterFromDashboard}
                      />
                    </div>
                  )}

                  {activeTab === 'queue' && (
                    <div id="dispatcher-queue-tab-module">
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
                    <div className="bg-white border border-slate-200/55 rounded-2xl p-5 md:p-6 shadow-xs text-left space-y-5" id="invoices-list-tab-module">
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
                    <div className="bg-white border border-slate-200/55 rounded-2xl p-5 md:p-6 shadow-xs text-left space-y-5" id="deleted-list-tab-module">
                      <div className="space-y-0.5">
                        <h3 className="font-extrabold text-slate-900 text-base tracking-tight font-display flex items-center gap-1.5 text-slate-800">
                          <History className="h-5 w-5 text-slate-700" /> Operational Activity Logs
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Audit trail of ticket creations, completions, cancellations, and deletions</p>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-x-auto" id="deleted-jobs-register">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 select-none">
                            <tr>
                              <th className="p-4">Timestamp</th>
                              <th className="p-4">Ticket Ref</th>
                              <th className="p-4">Operator</th>
                              <th className="p-4">Event Action</th>
                              <th className="p-4">Customer Details</th>
                              <th className="p-4">Activity Log Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {activityLogs.map((log) => {
                              const dateText = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              }) : '-';

                              let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                              if (log.actionType === 'Created') badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                              if (log.actionType === 'Completed') badgeBg = 'bg-purple-50 text-purple-700 border-purple-100';
                              if (log.actionType === 'Canceled' || log.actionType === 'Cancelled') badgeBg = 'bg-amber-50 text-amber-700 border-amber-100';
                              if (log.actionType === 'Deleted') badgeBg = 'bg-rose-50 text-rose-700 border-rose-100';
                              if (log.actionType === 'Updated' || log.actionType === 'Updated Status') badgeBg = 'bg-sky-50 text-sky-700 border-sky-100';

                              return (
                                <tr key={log.id || ('log-' + Math.random())} className="hover:bg-slate-50/50">
                                  <td className="p-4 font-semibold text-slate-500 font-mono whitespace-nowrap">{dateText}</td>
                                  <td className="p-4 font-mono font-bold text-slate-700">{log.jobId}</td>
                                  <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200/60 lowercase">@{log.username || 'system'}</span>
                                  </td>
                                  <td className="p-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeBg}`}>
                                      {log.actionType}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <p className="font-bold text-slate-900">{log.customerName || 'N/A'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono italic">{log.deviceType || 'Unknown Device'}</p>
                                  </td>
                                  <td className="p-4">
                                    <p className="text-slate-600 leading-relaxed max-w-sm select-text font-normal">
                                      {log.details || 'No additional activity notes provided.'}
                                    </p>
                                  </td>
                                </tr>
                              );
                            })}
                            {activityLogs.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-slate-400 italic font-medium">
                                  No recorded activity logs found. Try performing actions such as creating, updating, or deleting tickets.
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
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      {/* POPUP RECEIPT MODAL */}
      {viewingInvoice && (
        <InvoiceView invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}

      {/* DATABASE CONNECTION STATUS DETAIL MODAL */}
      {showDbStatusModal && dbStatus && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto" 
          id="db-status-detail-modal-overlay"
          onClick={() => setShowDbStatusModal(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200/50 flex flex-col overflow-hidden animate-scale-up" 
            id="db-status-detail-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 text-left select-none">
              <div className="flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-slate-700" />
                <h3 className="font-extrabold text-slate-900 text-sm font-display">Database Status Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDbStatusModal(false)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-xl font-bold cursor-pointer transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 text-left space-y-4">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  dbStatus.connected 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : 'bg-rose-50 text-rose-750 border border-rose-100'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  {dbStatus.connected ? 'Connected' : 'Database Offline'}
                </span>
                
                <span className="text-[11px] text-slate-400 font-mono font-semibold">
                  MongoDB Atlas
                </span>
              </div>

              {/* Status Message */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 space-y-1 text-slate-705 text-xs select-text">
                <p className="font-bold text-slate-800">Current Message:</p>
                <p className="leading-relaxed font-medium text-slate-600">{dbStatus.modeMessage}</p>
                {dbStatus.uriUsed && (
                  <p className="text-[10px] text-slate-450 mt-1.5 font-mono truncate">
                    <strong>URI Endpoint:</strong> {dbStatus.uriUsed}
                  </p>
                )}
              </div>

              {/* Error Message Details */}
              {dbStatus.error && (
                <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 space-y-1 text-xs select-text text-rose-800">
                  <p className="font-bold text-rose-900">Error Log:</p>
                  <p className="font-mono text-[11px] leading-relaxed break-words bg-white/70 p-2 rounded border border-rose-200/50">{dbStatus.error}</p>
                </div>
              )}

              {/* Dismiss controls */}
              <div className="pt-2 flex justify-between gap-2">
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    disabled={isWiping}
                    onClick={handleWipeAllData}
                    className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isWiping ? 'Wiping Data...' : 'Wipe Mock/Simulated Data'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDbStatusModal(false)}
                  className="bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* NEW TICKET REGISTRATION POPUP */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-4 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto" id="new-ticket-modal-overlay">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/30 max-h-[90vh] flex flex-col overflow-hidden animate-scale-up" id="new-ticket-modal-container">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 text-left select-none">
              <div>
                <h3 className="font-extrabold text-slate-905 text-base font-display">Register Service Work</h3>
                <p className="text-xs text-slate-400">Assign technician & record service ticket details</p>
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

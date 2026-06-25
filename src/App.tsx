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
import { secureStorage } from './lib/secureStorage.ts';

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
      return secureStorage.getItem<User>('smartfix_current_user');
    } catch (_) {
      return null;
    }
  });

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      secureStorage.setItem('smartfix_current_user', user);
    } catch (_) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      secureStorage.removeItem('smartfix_current_user');
      // Call server logout to clear secure cookie
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
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
        const logsArray = Array.isArray(data) ? data : [];
        setActivityLogs(logsArray);
        secureStorage.setItem('smartfix_activity_logs', logsArray);
      })
      .catch((err) => {
        console.warn('Fallback: fetching activity logs offline.', err.message || err);
        const cachedLogs = secureStorage.getItem<ActivityLog[]>('smartfix_activity_logs');
        const logsArray = Array.isArray(cachedLogs) ? cachedLogs : [];
        setActivityLogs(logsArray);
        secureStorage.setItem('smartfix_activity_logs', logsArray);
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
      const cachedJobs = secureStorage.getItem<ServiceJob[]>('smartfix_jobs');
      const cachedInvs = secureStorage.getItem<Invoice[]>('smartfix_invoices');
      const cachedLogs = secureStorage.getItem<ActivityLog[]>('smartfix_activity_logs');
      
      setJobs(Array.isArray(cachedJobs) ? cachedJobs : []);
      setInvoices(Array.isArray(cachedInvs) ? cachedInvs : []);
      setActivityLogs(Array.isArray(cachedLogs) ? cachedLogs : []);
      return;
    }

    const fetchJobs = () => {
      authFetch('/api/jobs')
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data: ServiceJob[]) => {
          const dataArray = Array.isArray(data) ? data : [];
          const now = new Date();
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
          const filtered = dataArray.filter((job) => {
            if (!job.createdAt) return true;
            const jobDate = new Date(job.createdAt);
            return jobDate >= startOfLastMonth && jobDate <= endOfNextMonth;
          });
          setJobs(filtered);
          secureStorage.setItem('smartfix_jobs', filtered);
        })
        .catch((err) => {
          console.warn('Fallback: fetching jobs offline.', err.message || err);
          const cachedJobs = secureStorage.getItem<ServiceJob[]>('smartfix_jobs');
          let loadedJobs: ServiceJob[] = Array.isArray(cachedJobs) ? cachedJobs : [];
          const now = new Date();
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
          const filtered = loadedJobs.filter((job) => {
            if (!job.createdAt) return true;
            const jobDate = new Date(job.createdAt);
            return jobDate >= startOfLastMonth && jobDate <= endOfNextMonth;
          });
          setJobs(filtered);
          secureStorage.setItem('smartfix_jobs', filtered);
        });
    };

    fetchJobs();

    authFetch('/api/invoices')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        const invoicesArray = Array.isArray(data) ? data : [];
        setInvoices(invoicesArray);
        secureStorage.setItem('smartfix_invoices', invoicesArray);
      })
      .catch((err) => {
        console.warn('Fallback: fetching invoices offline.', err.message || err);
        const cachedInvs = secureStorage.getItem<Invoice[]>('smartfix_invoices');
        const invoicesArray = Array.isArray(cachedInvs) ? cachedInvs : [];
        setInvoices(invoicesArray);
        secureStorage.setItem('smartfix_invoices', invoicesArray);
      });

    // Fetch activity logs helper
    const fetchActivityLogsOnStart = () => {
      authFetch('/api/activity-logs')
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          const logsArray = Array.isArray(data) ? data : [];
          setActivityLogs(logsArray);
          secureStorage.setItem('smartfix_activity_logs', logsArray);
        })
        .catch((err) => {
          console.warn('Fallback: fetching activity logs offline.', err.message || err);
          const cachedLogs = secureStorage.getItem<ActivityLog[]>('smartfix_activity_logs');
          const logsArray = Array.isArray(cachedLogs) ? cachedLogs : [];
          setActivityLogs(logsArray);
          secureStorage.setItem('smartfix_activity_logs', logsArray);
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
          const dataArray = Array.isArray(data) ? data : [];
          setJobs(dataArray);
          secureStorage.setItem('smartfix_jobs', dataArray);
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
          secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
          return updated;
        });
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = prev.map((j) => (j.id === jobId ? updatedJob : j));
          secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
          return updated;
        });
        fetchActivityLogs();
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        setJobs((prev) => {
          const updated = prev.filter((j) => j.id !== jobId);
          secureStorage.setItem('smartfix_jobs', updated);
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
            secureStorage.setItem('smartfix_activity_logs', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
          return updated;
        });
        fetchActivityLogs();
      })
      .catch((err) => {
        // Fallback for offline/Vercel
        if (updatedJob) {
          setJobs((prev) => {
            const updated = prev.map((j) => (j.id === jobId ? updatedJob : j));
            secureStorage.setItem('smartfix_jobs', updated);
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
      body: JSON.stringify({ confirm: "WIPE_ALL_DATA" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Wipe operation failed');
        return res.json();
      })
      .then(() => {
        setJobs([]);
        setInvoices([]);
        setActivityLogs([]);
        secureStorage.setItem('smartfix_jobs', []);
        secureStorage.setItem('smartfix_invoices', []);
        secureStorage.setItem('smartfix_activity_logs', []);
        setShowDbStatusModal(false);
      })
      .catch((err) => {
        console.error('Wipe error:', err);
        // Clean up client-side fallback as fallback
        setJobs([]);
        setInvoices([]);
        setActivityLogs([]);
        secureStorage.setItem('smartfix_jobs', []);
        secureStorage.setItem('smartfix_invoices', []);
        secureStorage.setItem('smartfix_activity_logs', []);
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
          secureStorage.setItem('smartfix_invoices', updated);
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
              secureStorage.setItem('smartfix_jobs', updated);
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
          secureStorage.setItem('smartfix_invoices', updated);
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
          secureStorage.setItem('smartfix_jobs', updated);
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
    <div className="h-screen bg-[#050e12] text-slate-100 font-sans antialiased flex flex-col lg:flex-row overflow-hidden relative" id="app-viewport">
      
      {/* Drifting background liquid glass blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] left-[15%] w-[450px] h-[450px] rounded-full bg-teal-600 opacity-[0.14] blur-[110px] animate-blob-1" />
        <div className="absolute bottom-[10%] left-[40%] w-[500px] h-[500px] rounded-full bg-emerald-600 opacity-[0.12] blur-[120px] animate-blob-2" />
        <div className="absolute top-[35%] right-[5%] w-[420px] h-[420px] rounded-full bg-cyan-500 opacity-[0.15] blur-[100px] animate-blob-3" />
      </div>
      
      {/* DESKTOP SIDEBAR (Visible only on screens lg and up) */}
      <aside className="hidden lg:flex lg:w-64 ios-glass-sidebar text-white flex-col shrink-0 fixed top-0 bottom-0 left-0 z-30 select-none" id="desktop-sidebar">
        {/* Brand Banner */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-600 text-slate-100 border border-white/20 p-2.5 rounded-xl flex items-center justify-center shadow-md">
            <Terminal className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest font-display text-white">
              YS SVC
            </h1>
            <span className="text-[9px] text-teal-400 font-bold uppercase tracking-wider block">Liquid Svc</span>
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
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer active:scale-97 ${
                  isSelected
                    ? 'bg-white/15 text-white font-bold border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.05)] backdrop-blur-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile Details */}
        <div className="p-4 border-t border-white/5 bg-white/2 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8.5 w-8.5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center font-black text-xs text-teal-300 uppercase tracking-wider shrink-0 select-none">
              {currentUser?.name[0]}
            </div>
            <div className="flex-1 min-w-0 pr-1 text-left">
              <p className="text-xs font-bold text-white truncate leading-none mb-1">{currentUser?.name}</p>
              <span className="text-[9px] font-extrabold uppercase bg-white/5 border border-white/10 text-slate-400 px-1.5 py-0.5 rounded">
                {currentUser?.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 inline-flex items-center justify-center gap-1.5 border border-white/10 hover:border-rose-500/30 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" /> Log Out
            </button>
            {dbStatus && (
              <button 
                type="button"
                onClick={() => setShowDbStatusModal(true)}
                className={`flex items-center justify-center h-8 w-8 rounded-lg border shrink-0 cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none ${
                  dbStatus.connected ? 'border-emerald-500/30 bg-emerald-500/10 focus:ring-1 focus:ring-emerald-500' : 'border-amber-500/30 bg-amber-500/10 focus:ring-1 focus:ring-amber-500'
                }`}
                title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed} (Click for details)` : (dbStatus.error ? `DB Connection Failed: ${dbStatus.error} (Click for details)` : `${dbStatus.modeMessage || "Local Offline Mode"} (Click for details)`)}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${
                  dbStatus.connected ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-amber-400 animate-pulse'
                }`} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE MAIN CONTAINER */}
      <div className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden relative z-10">
        
        {/* RESPONSIVE FLUID HEADER */}
        <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 z-20 shrink-0 select-none" id="shop-header">
          <div className="mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            
            {/* Title / Mobile Brand */}
            <div className="flex items-center gap-2.5 text-left">
              <div className="bg-gradient-to-tr from-teal-500 to-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center lg:hidden shrink-0 shadow-md">
                <Terminal className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm lg:text-base font-extrabold tracking-tight text-white font-display">
                  {activeTab === 'dashboard' ? 'Overview Stats' :
                   activeTab === 'queue' ? 'Dispatching Queue' :
                   activeTab === 'invoices' ? 'Billing History' :
                   activeTab === 'deleted' ? 'Activity Log History' : 'Team Directory'}
                </h2>
                <p className="text-[10px] text-teal-400 font-bold tracking-wider uppercase hidden sm:block">
                  YS SVC Dispatch Hub
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              
              {/* User Identity - Hidden in lg sidebar format but visible in md size header */}
              <div className="text-right hidden sm:block lg:hidden select-none">
                <p className="text-xs font-bold text-white leading-tight">
                  {currentUser?.name}
                </p>
                <span className="inline-block text-[9px] font-extrabold bg-white/10 text-slate-300 px-1.5 rounded uppercase mt-0.5 border border-white/5">
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
                  className="inline-flex items-center gap-1.5 ios-btn-primary text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer shadow-md"
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
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-white cursor-pointer hover:bg-white/10 active:scale-95 transition-all outline-none"
                    title={dbStatus.connected ? `DB Live Status Verified: ${dbStatus.uriUsed} (Click for details)` : (dbStatus.error ? `DB Connection Failed: ${dbStatus.error} (Click for details)` : `${dbStatus.modeMessage || "Local Offline Mode"} (Click for details)`)}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      dbStatus.connected ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-amber-400'
                    }`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-slate-300 hover:text-rose-400 border border-white/10 rounded-xl p-2.5 transition-all bg-white/5 cursor-pointer hover:bg-rose-950/20"
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
                    <div className="ios-glass-card rounded-3xl p-5 md:p-6 text-left space-y-5" id="invoices-list-tab-module">
                      <div className="space-y-0.5">
                        <h3 className="font-extrabold text-white text-base tracking-tight font-display flex items-center gap-1.5">
                          <History className="h-5 w-5 text-teal-400" /> Settlement Ledger
                        </h3>
                        <p className="text-xs text-slate-400">Review final transaction logs, KBZPay entries, and invoices details.</p>
                      </div>

                      <div className="border border-white/5 rounded-2xl overflow-x-auto" id="historic-invoices-register">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-white/5 text-slate-350 font-bold uppercase tracking-wider text-[10px] border-b border-white/5 select-none">
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
                      {/* Developer-style Console / Terminal container */}
                      <div className="rounded-xl overflow-hidden border border-slate-950 shadow-lg text-slate-200 font-mono text-[11px] md:text-xs">
                        {/* Terminal Header */}
                        <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between select-none border-b border-slate-950">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-inner" />
                            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-inner" />
                            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-inner" />
                            <span className="text-slate-400 text-[11px] font-semibold pl-2 tracking-wide font-mono">system.log — bash</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">Asia/Yangon Timezone</span>
                        </div>

                        {/* Terminal Log Output Body */}
                        <div className="bg-slate-950 p-4 min-h-[350px] max-h-[550px] overflow-y-auto space-y-2 select-text custom-scrollbar">
                          {activityLogs.map((log) => {
                            const dateText = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                              timeZone: 'Asia/Yangon',
                            }) : '-';
                            
                            let level = 'INFO';
                            let levelColor = 'text-sky-400 font-bold';
                            if (log.actionType === 'Deleted') {
                              level = 'FATAL';
                              levelColor = 'text-rose-500 font-semibold';
                            } else if (log.actionType === 'Canceled' || log.actionType === 'Cancelled') {
                              level = 'WARN ';
                              levelColor = 'text-amber-500 font-semibold';
                            } else if (log.actionType === 'Completed') {
                              level = 'DONE ';
                              levelColor = 'text-emerald-400 font-semibold';
                            } else if (log.actionType === 'Created') {
                              level = 'NEW  ';
                              levelColor = 'text-lime-400 font-semibold';
                            }

                            return (
                              <div key={log.id || ('log-' + Math.random())} className="hover:bg-slate-900/60 py-0.5 px-2 rounded-md flex flex-col md:flex-row md:items-start gap-1 select-text transition-colors duration-150">
                                <span className="text-slate-500 shrink-0 font-medium">[{dateText}]</span>
                                <span className={`shrink-0 ${levelColor}`}>[{level}]</span>
                                <span className="text-teal-400 shrink-0">@{log.username || 'system'}</span>
                                <div className="flex-1 md:pl-1 text-slate-300">
                                  <span className="text-zinc-400 font-medium uppercase text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/40 mr-1.5 shrink-0 inline-block align-middle">{log.actionType}</span>
                                  <span className="text-amber-300 font-bold mr-1.5">[TICKET #{log.jobId}]</span>
                                  {log.customerName && (
                                    <span className="text-slate-100 font-semibold mr-1">
                                      {log.customerName} ({log.deviceType || 'Device'}) &raquo;
                                    </span>
                                  )}
                                  <span className="text-slate-400 font-normal italic select-text pl-1">
                                    {log.details || 'No additional activity notes provided.'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {activityLogs.length === 0 && (
                            <div className="py-20 text-center text-slate-500 italic select-none">
                              $ tail -n 100 activity.log<br />
                              <span className="text-slate-600">No logs found in registry. Performing actions on tickets will populate live audit logs here.</span>
                            </div>
                          )}
                        </div>
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
            className="bg-[#050e12]/95 backdrop-blur-xl w-full max-w-md rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-scale-up text-slate-100" 
            id="db-status-detail-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-white/5 px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 text-left select-none">
              <div className="flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-teal-400" />
                <h3 className="font-extrabold text-white text-sm font-display">Database Status Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDbStatusModal(false)}
                className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
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
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' 
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  {dbStatus.connected ? 'Connected' : 'Database Offline'}
                </span>
                
                <span className="text-[11px] text-teal-400 font-mono font-semibold">
                  MongoDB Atlas
                </span>
              </div>

              {/* Status Message */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1 text-slate-300 text-xs select-text">
                <p className="font-bold text-teal-300">Current Message:</p>
                <p className="leading-relaxed font-medium text-slate-300">{dbStatus.modeMessage}</p>
                {dbStatus.uriUsed && (
                  <p className="text-[10px] text-slate-400 mt-1.5 font-mono truncate">
                    <strong>URI Endpoint:</strong> {dbStatus.uriUsed}
                  </p>
                )}
              </div>

              {/* Error Message Details */}
              {dbStatus.error && (
                <div className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-900/30 space-y-1 text-xs select-text text-rose-300">
                  <p className="font-bold text-rose-200">Error Log:</p>
                  <p className="font-mono text-[11px] leading-relaxed break-words bg-black/40 p-2 rounded border border-rose-500/20 text-rose-200">{dbStatus.error}</p>
                </div>
              )}

              {/* Dismiss controls */}
              <div className="pt-2 flex justify-between gap-2">
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    disabled={isWiping}
                    onClick={handleWipeAllData}
                    className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isWiping ? 'Wiping Data...' : 'Wipe Mock/Simulated Data'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDbStatusModal(false)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer border border-teal-500/20"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-4 sm:pt-4 bg-slate-955/75 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto" id="new-ticket-modal-overlay">
          <div className="bg-[#050e12]/95 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl border border-white/10 max-h-[90vh] flex flex-col overflow-hidden animate-scale-up text-slate-100" id="new-ticket-modal-container">
            {/* Modal Header */}
            <div className="bg-white/5 px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 text-left select-none">
              <div>
                <h3 className="font-extrabold text-white text-base font-display">Register Service Work</h3>
                <p className="text-xs text-slate-400">Assign technician & record service ticket details</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 text-2xl font-bold rounded-lg hover:bg-white/5 tracking-none leading-none cursor-pointer"
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
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#050e12]/90 backdrop-blur-lg border-t border-white/10 shadow-[0_-4px_16px_rgba(0,0,0,0.15)] lg:hidden select-none" id="workspace-bottom-nav">
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
                    ? 'text-teal-400 scale-102'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${
                  isSelected ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' : 'group-hover:bg-white/5'
                }`}>
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                </div>
                <span className={`text-[9px] font-bold tracking-tight mt-0.5 transition-colors ${
                  isSelected ? 'text-teal-300 font-bold' : 'text-slate-400'
                }`}>
                  {tab.label.split(' ')[0]}
                </span>

                {isSelected && (
                  <span className="absolute top-0 w-2 h-1 rounded-b-full bg-teal-450 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

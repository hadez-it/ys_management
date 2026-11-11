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
  Terminal,
  Package,
  Menu,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import { ServiceJob, Invoice, JobStatus, DeviceType, UrgencyLevel, LocationCoords, DeletedJob, User, UserRole, ActivityLog, InventoryItem, InventoryLog } from './types.ts';
import {
  formatMMK,
  MAP_CENTER_YANGON
} from './utils.ts';
import { localCache } from './lib/localCache.ts';

// Import components
import DashboardStats from './components/DashboardStats.tsx';
import JobForm from './components/JobForm.tsx';
import JobList from './components/JobList.tsx';
import InvoiceGenerator from './components/InvoiceGenerator.tsx';
import InvoiceView from './components/InvoiceView.tsx';
import Login from './components/Login.tsx';
import UserManagement from './components/UserManagement.tsx';
import Inventory from './components/Inventory.tsx';

// Saved sessions last 7 days and are silently refreshed while the app stays in use
const SESSION_HEARTBEAT_MS = 60 * 60 * 1000; // check/renew the session once an hour

function toCachedUserProfile(user: User): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

export default function App() {
  // User Session Management
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cached = localCache.getItem<User>('smartfix_current_user');
      return cached?.id ? toCachedUserProfile(cached) : null;
    } catch (_) {
      return null;
    }
  });
  const [sessionRestoring, setSessionRestoring] = useState<boolean>(() => {
    try {
      return !!localCache.getItem<User>('smartfix_current_user')?.id;
    } catch (_) {
      return false;
    }
  });

  const handleLoginSuccess = (user: User) => {
    const profile = toCachedUserProfile(user);
    setCurrentUser(profile);
    try {
      localCache.setItem('smartfix_current_user', profile);
    } catch (_) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setJobs([]);
    setInvoices([]);
    setActivityLogs([]);
    setInventoryItems([]);
    setInventoryLogs([]);
    setInventoryCategories([]);
    try {
      localCache.clearSessionCache();
      // Call server logout to clear secure cookie
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch (_) {}
  };

  // Restore the saved session on load and keep it alive: the server slides the 7-day
  // expiry forward whenever the app is used, so the user stays signed in until they log out.
  useEffect(() => {
    let cancelled = false;

    const refreshSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (res.status === 401 || res.status === 403) {
          // Session expired or was revoked server-side -> clear session cache and return to login
          if (cancelled) return;
          localCache.clearSessionCache();
          setCurrentUser(null);
          setJobs([]);
          setInvoices([]);
          setActivityLogs([]);
          setInventoryItems([]);
          setInventoryLogs([]);
          setInventoryCategories([]);
          return;
        }
        if (!res.ok) {
          // Server/database hiccup: keep the saved session and retry on the next heartbeat
          return;
        }

        const refreshedUser = (await res.json()) as User;
        if (cancelled || !refreshedUser?.id) return;
        const profile = toCachedUserProfile(refreshedUser);
        setCurrentUser(profile);
        localCache.setItem('smartfix_current_user', profile);
      } catch (_) {
        // Offline: keep the saved session and try again on the next heartbeat
      } finally {
        if (!cancelled) setSessionRestoring(false);
      }
    };

    refreshSession();

    if (!currentUser?.id) {
      return () => {
        cancelled = true;
      };
    }

    // Keep the sliding 7-day session alive while the app is open and when the tab wakes up
    const heartbeat = window.setInterval(refreshSession, SESSION_HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser?.id]);

  // Authenticated fetch wrapper relying on the httpOnly session cookie
  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    }).then((res) => {
      if (res.status === 401 || res.status === 403) {
        // Session is invalid/expired or revoked; clear cache and log out automatically
        handleLogout();
      }
      return res;
    });
  };

  // Global States synced with Express REST + MongoDB Server
  const [jobs, setJobs] = useState<ServiceJob[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_jobs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_invoices');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_activity_logs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [dataLoading, setDataLoading] = useState<boolean>(() => {
    try {
      const hasJobs = localStorage.getItem('ys_cached_jobs');
      return !hasJobs; // Only show initial loading screen if no cached data exists
    } catch {
      return true;
    }
  });
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; isDemo: boolean; modeMessage?: string; uriUsed?: string; error?: string } | null>(null);

  // Inventory States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_inventory_items');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_inventory_logs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inventoryCategories, setInventoryCategories] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('ys_cached_inventory_categories');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'logs'>('stock');
  const [isAddInventoryOpen, setIsAddInventoryOpen] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const fetchInventoryData = () => {
    if (!currentUser?.id) return;
    setInventoryLoading(true);
    
    Promise.all([
      authFetch('/api/inventory').then(res => res.json()),
      authFetch('/api/inventory/logs').then(res => res.json()),
      authFetch('/api/inventory/categories').then(res => res.json())
    ]).then(([items, logs, categories]) => {
      const itemsArray = Array.isArray(items) ? items : [];
      const logsArray = Array.isArray(logs) ? logs : [];
      const categoriesArray = Array.isArray(categories) ? categories : [];
      
      setInventoryItems(itemsArray);
      setInventoryLogs(logsArray);
      setInventoryCategories(categoriesArray);
      
      try {
        localStorage.setItem('ys_cached_inventory_items', JSON.stringify(itemsArray));
        localStorage.setItem('ys_cached_inventory_logs', JSON.stringify(logsArray));
        localStorage.setItem('ys_cached_inventory_categories', JSON.stringify(categoriesArray));
      } catch (e) {
        console.error(e);
      }
    }).catch(err => {
      console.error('Error fetching inventory data:', err);
    }).finally(() => {
      setInventoryLoading(false);
    });
  };

  // Routing and interactive view triggers
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'invoices' | 'deleted' | 'users' | 'inventory'>('dashboard');
  const [lastServiceTab, setLastServiceTab] = useState<'dashboard' | 'queue' | 'invoices' | 'deleted' | 'users'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Pull-to-refresh for Fullscreen PWA mobile device
  const mainRef = React.useRef<HTMLElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;

    let startY = 0;
    let isAtTop = false;

    const handleTouchStart = (e: TouchEvent) => {
      isAtTop = element.scrollTop <= 0;
      if (isAtTop && e.touches.length === 1) {
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop || e.touches.length !== 1 || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diffY = currentY - startY;

      if (diffY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        setIsPulling(true);
        const dampFactor = 0.45;
        const dist = Math.min(diffY * dampFactor, 150);
        setPullDistance(dist);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    const handleTouchEnd = () => {
      if (isRefreshing) return;
      
      if (pullDistance > 65) {
        setIsRefreshing(true);
        setIsPulling(false);
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  // Navigation History Stack for Back button support
  const [navHistory, setNavHistory] = useState<{ activeTab: string; inventorySubTab: 'stock' | 'logs' }[]>([]);
  const isBackTransitionRef = React.useRef(false);
  const lastStateRef = React.useRef({ activeTab: 'dashboard', inventorySubTab: 'stock' as const });

  // Handle back-confirm
  const [exitConfirmActive, setExitConfirmActive] = useState(false);

  // Track navigation changes for the Back gesture/button
  useEffect(() => {
    const prevState = lastStateRef.current;
    const currState = { activeTab, inventorySubTab };

    if (prevState.activeTab !== currState.activeTab || prevState.inventorySubTab !== currState.inventorySubTab) {
      if (isBackTransitionRef.current) {
        isBackTransitionRef.current = false;
      } else {
        // Push the previous state into the stack
        setNavHistory((prev) => [...prev, prevState]);
      }
      lastStateRef.current = currState;
    }

    if (activeTab !== 'inventory') {
      setLastServiceTab(activeTab as any);
    }
  }, [activeTab, inventorySubTab]);

  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [showDbStatusModal, setShowDbStatusModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  
  // Specific wizard triggers
  const [invoiceWizardJob, setInvoiceWizardJob] = useState<ServiceJob | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Back action implementation
  const handleBack = React.useCallback(() => {
    // If any modal is open, close it first
    if (isNewTicketModalOpen) {
      setIsNewTicketModalOpen(false);
      return;
    }
    if (isAddInventoryOpen) {
      setIsAddInventoryOpen(false);
      return;
    }
    if (viewingInvoice) {
      setViewingInvoice(null);
      return;
    }
    if (showDbStatusModal) {
      setShowDbStatusModal(false);
      return;
    }
    if (invoiceWizardJob) {
      setInvoiceWizardJob(null);
      return;
    }

    if (navHistory.length > 0) {
      const prevState = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      isBackTransitionRef.current = true;
      setActiveTab(prevState.activeTab as any);
      setInventorySubTab(prevState.inventorySubTab);
      setExitConfirmActive(false);
    } else {
      if (exitConfirmActive) {
        window.close();
        window.location.href = 'about:blank';
      } else {
        setExitConfirmActive(true);
      }
    }
  }, [
    navHistory,
    exitConfirmActive,
    isNewTicketModalOpen,
    isAddInventoryOpen,
    viewingInvoice,
    showDbStatusModal,
    invoiceWizardJob,
    setInventorySubTab
  ]);

  const handleBackRef = React.useRef(handleBack);
  useEffect(() => {
    handleBackRef.current = handleBack;
  }, [handleBack]);

  // Handle hardware/browser Back Button
  useEffect(() => {
    // Push a dummy state to history so there is always a state to pop from
    window.history.pushState(null, '', window.location.pathname);

    const handlePopState = () => {
      // Re-push a dummy state to keep the back button interceptable next time
      window.history.pushState(null, '', window.location.pathname);
      
      // Dispatch a custom cancelable event
      const backEvent = new CustomEvent('app-back-intercept', { cancelable: true });
      const wasInterrupted = !window.dispatchEvent(backEvent);

      if (wasInterrupted) {
        // A modal or component intercepted and handled it! Do absolutely nothing else.
        return;
      }

      handleBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Handle exit confirmation auto-timeout
  useEffect(() => {
    if (exitConfirmActive) {
      const t = setTimeout(() => {
        setExitConfirmActive(false);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [exitConfirmActive]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isWiping, setIsWiping] = useState(false);

  const fetchActivityLogs = () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'coordinator')) {
      return;
    }
    authFetch('/api/activity-logs')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        const logsArray = Array.isArray(data) ? data : [];
        setActivityLogs(logsArray);
      })
      .catch((err) => {
        console.error('Error fetching activity logs online:', err.message || err);
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

  // Fetch Inventory Data when logged in and active tab is inventory
  useEffect(() => {
    if (currentUser?.id && activeTab === 'inventory') {
      fetchInventoryData();
    }
  }, [currentUser, activeTab]);

  // Load state from Backend APIs when user is logged-authorized
  useEffect(() => {
    if (!currentUser?.id) {
      setJobs([]);
      setInvoices([]);
      setActivityLogs([]);
      setDataLoading(false);
      return;
    }

    const hasCachedJobs = localStorage.getItem('ys_cached_jobs');
    if (!hasCachedJobs) {
      setDataLoading(true);
    }

    const p1 = authFetch('/api/jobs')
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
        try {
          localStorage.setItem('ys_cached_jobs', JSON.stringify(filtered));
        } catch (e) {
          console.error(e);
        }
      })
      .catch((err) => {
        console.error('Error fetching jobs online:', err.message || err);
      });

    const canReadInvoices = currentUser.role === 'admin' || currentUser.role === 'coordinator' || currentUser.role === 'senior_technician';
    const p2 = canReadInvoices
      ? authFetch('/api/invoices')
          .then((res) => {
            if (!res.ok) throw new Error();
            return res.json();
          })
          .then((data) => {
            const invoicesArray = Array.isArray(data) ? data : [];
            setInvoices(invoicesArray);
            try {
              localStorage.setItem('ys_cached_invoices', JSON.stringify(invoicesArray));
            } catch (e) {
              console.error(e);
            }
          })
          .catch((err) => {
            console.error('Error fetching invoices online:', err.message || err);
          })
      : Promise.resolve();

    const canReadActivityLogs = currentUser.role === 'admin' || currentUser.role === 'coordinator';
    const p3 = canReadActivityLogs
      ? authFetch('/api/activity-logs')
          .then((res) => {
            if (!res.ok) throw new Error();
            return res.json();
          })
          .then((data) => {
            const logsArray = Array.isArray(data) ? data : [];
            setActivityLogs(logsArray);
            try {
              localStorage.setItem('ys_cached_activity_logs', JSON.stringify(logsArray));
            } catch (e) {
              console.error(e);
            }
          })
          .catch((err) => {
            console.error('Error fetching activity logs online:', err.message || err);
          })
      : Promise.resolve();

    Promise.allSettled([p1, p2, p3]).finally(() => {
      // Small artificial delay for polished, high-fidelity skeleton animation
      setTimeout(() => {
        setDataLoading(false);
      }, 600);
    });

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
          try {
            localStorage.setItem('ys_cached_jobs', JSON.stringify(dataArray));
          } catch (e) {
            console.error(e);
          }
        })
        .catch(() => {
          // Keep offline state silently running
        });
    }, 8000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser?.id]);

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
        setJobs((prev) => [savedJob, ...prev]);
        fetchActivityLogs();
        setIsNewTicketModalOpen(false);
        setIsDispatching(false);
        setActiveTab('queue');
      })
      .catch((err) => {
        alert(err.message || 'Failed to create job. Please check your internet connection.');
        setIsDispatching(false);
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

    const updatePayload: Record<string, any> = {
      status,
      diagnosedProblem: diagnosedProblem !== undefined ? diagnosedProblem : targetJob.diagnosedProblem,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : targetJob.resolutionNotes,
      remarks: remarks !== undefined ? remarks : targetJob.remarks,
    };
    if (currentUser?.role !== 'technician' && technicianName !== undefined) {
      updatePayload.technicianName = technicianName;
    }

    authFetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update job status');
        return res.json();
      })
      .then((savedJob) => {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
        fetchActivityLogs();
        if (status === 'Completed' && (currentUser?.role === 'admin' || currentUser?.role === 'coordinator' || currentUser?.role === 'senior_technician')) {
          setInvoiceWizardJob(savedJob);
        }
      })
      .catch((err) => {
        alert(err.message || 'Failed to update job. Please check your internet connection.');
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
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
      })
      .catch((err) => {
        alert(err.message || 'Failed to update priority. Please check your connection.');
      });
  };

  // Delete customer job and log reason
  const handleDeleteJob = (jobId: string, reason: string) => {
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
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        fetchActivityLogs();
      })
      .catch((err) => {
        alert(err.message || 'Failed to delete job. Please check your connection.');
      });
  };

  // Edit job details
  const handleEditJob = (jobId: string, updatedJobData: any) => {
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
        setJobs((prev) => prev.map((j) => (j.id === jobId ? savedJob : j)));
        fetchActivityLogs();
      })
      .catch((err) => {
        alert(err.message || 'Failed to edit job. Please check your connection.');
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
        setShowDbStatusModal(false);
      })
      .catch((err) => {
        alert(err.message || 'Failed to wipe data. Please check your connection.');
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
        setInvoices((prev) => [savedInvoice, ...prev]);

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
            setJobs((prev) => prev.map((j) => (j.id === invoiceWizardJob.id ? updatedJob : j)));
            setInvoiceWizardJob(null);
            setViewingInvoice(savedInvoice);
          });
      })
      .catch((err) => {
        alert(err.message || 'Failed to process invoice payment online. Please check your connection.');
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

  if (!currentUser && sessionRestoring) {
    return (
      <div className="min-h-screen bg-[#050e12] flex flex-col items-center justify-center gap-4 font-sans select-none" id="session-restore-screen">
        <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white shadow-xl border border-white/20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-50 blur-[2px]" />
          <Terminal className="h-6 w-6 relative z-10" />
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="h-3.5 w-3.5 text-teal-400 animate-spin" />
          <span className="text-[11px] font-bold uppercase tracking-widest">Restoring your session</span>
        </div>
      </div>
    );
  }

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

  const renderNavItems = (onItemClick?: () => void) => {
    const isServiceActive = activeTab !== 'inventory';
    return (
      <div className="space-y-3">
        {/* Category 1: Service */}
        <div>
          <button
            type="button"
            onClick={() => {
              setActiveTab(lastServiceTab);
              setInvoiceWizardJob(null);
              if (onItemClick) onItemClick();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer active:scale-97 text-left outline-none ${
              isServiceActive
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-[0_0_12px_rgba(20,184,166,0.15)] font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 shrink-0 text-teal-400" />
              <span>Service</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-450 opacity-60" />
          </button>
        </div>

        {/* Category 2: Inventory */}
        <div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('inventory');
              setInvoiceWizardJob(null);
              if (onItemClick) onItemClick();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer active:scale-97 text-left outline-none ${
              activeTab === 'inventory'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-[0_0_12px_rgba(20,184,166,0.15)] font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package className="h-4 w-4 shrink-0 text-teal-400" />
              <span>Inventory</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-450 opacity-60" />
          </button>
        </div>
      </div>
    );
  };

  // Desktop tab rail. The bottom nav is a phone pattern (fixed, capped at max-w-lg), so
  // wide screens get a real tab strip under the header instead.
  const renderDesktopTabs = () => {
    const tabButtonClass = (isSelected: boolean) =>
      `relative inline-flex items-center gap-2 px-3 py-3 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-colors cursor-pointer outline-none ${
        isSelected
          ? 'border-teal-400 text-teal-300'
          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-white/15'
      }`;

    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 flex items-center gap-1.5">
        {activeTab === 'inventory'
          ? ([
              { id: 'stock', label: 'Stock', icon: Package },
              { id: 'logs', label: 'Logs', icon: History },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const isSelected = inventorySubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`desktop-tab-btn-inventory-${tab.id}`}
                  onClick={() => setInventorySubTab(tab.id)}
                  className={tabButtonClass(isSelected)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })
          : visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`desktop-tab-btn-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setInvoiceWizardJob(null);
                  }}
                  className={tabButtonClass(isSelected)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#050e12] text-slate-100 font-sans antialiased flex flex-col lg:flex-row overflow-hidden relative" id="app-viewport">
      
      {/* Drifting background liquid glass blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] left-[15%] w-[450px] h-[450px] rounded-full bg-teal-600 opacity-[0.14] blur-[110px] animate-blob-1" />
        <div className="absolute bottom-[10%] left-[40%] w-[500px] h-[500px] rounded-full bg-emerald-600 opacity-[0.12] blur-[120px] animate-blob-2" />
        <div className="absolute top-[35%] right-[5%] w-[420px] h-[420px] rounded-full bg-cyan-500 opacity-[0.15] blur-[100px] animate-blob-3" />
      </div>
      
      {/* DESKTOP SIDEBAR (Visible only on screens lg and up) */}
      <aside className={`hidden lg:flex lg:w-64 ios-glass-sidebar text-white flex-col shrink-0 fixed top-0 bottom-0 left-0 z-30 select-none transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} id="desktop-sidebar">
        {/* Brand Banner */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-600 text-slate-100 border border-white/20 p-2.5 rounded-xl flex items-center justify-center shadow-md">
            <Terminal className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest font-display text-white">
              Yangon Store
            </h1>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {renderNavItems()}
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
      <div className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-300 ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        
        {/* RESPONSIVE FLUID HEADER */}
        <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 z-20 shrink-0 select-none" id="shop-header">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
            
            {/* Title / Mobile Brand */}
            <div className="flex items-center gap-2.5 text-left">
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth >= 1024) {
                    setIsSidebarOpen(!isSidebarOpen);
                  } else {
                    setIsMobileSidebarOpen(true);
                  }
                }}
                className="bg-gradient-to-tr from-teal-500 to-emerald-600 text-white p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-md cursor-pointer hover:from-teal-400 hover:to-emerald-500 active:scale-95 transition-all outline-none animate-pulse-slow"
                title="Toggle Navigation Menu"
                id="sidebar-toggle-btn"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div>
                <h2 className="text-sm lg:text-base font-extrabold tracking-tight text-white font-display">
                  {activeTab === 'dashboard' ? 'Overview Stats' :
                   activeTab === 'queue' ? 'Dispatching Queue' :
                   activeTab === 'invoices' ? 'Billing History' :
                   activeTab === 'deleted' ? 'Activity Log History' :
                   activeTab === 'inventory' ? 'Inventory Center' : 'Team Directory'}
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
                    if (activeTab === 'inventory') {
                      setIsAddInventoryOpen(true);
                    } else {
                      setIsDispatching(false);
                      setIsNewTicketModalOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 ios-btn-primary text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer shadow-md"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> 
                  <span className="hidden sm:inline">{activeTab === 'inventory' ? 'Add Item' : 'New Ticket'}</span>
                  <span className="sm:hidden">{activeTab === 'inventory' ? 'Add' : 'New'}</span>
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

          {/* DESKTOP TAB RAIL (lg and up) */}
          <div className="hidden lg:block border-t border-white/5" id="desktop-tab-rail">
            {renderDesktopTabs()}
          </div>
        </header>


        {/* MAIN BODY AREA & WORKSPACE */}
        <main ref={mainRef} className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 overflow-y-auto pb-24 lg:pb-6 space-y-6 relative">
          
          {/* Pull to Refresh Tactile Indicator */}
          {(isPulling || isRefreshing || pullDistance > 0) && (
            <div 
              className="absolute left-0 right-0 top-2 flex justify-center pointer-events-none z-50 transition-all duration-75"
              style={{
                transform: `translateY(${Math.min(pullDistance - 50, 40)}px)`,
                opacity: Math.min(pullDistance / 50, 1),
              }}
            >
              <div className="bg-[#0b151a]/95 backdrop-blur-md border border-teal-500/30 text-teal-300 py-2.5 px-4 rounded-full flex items-center gap-2.5 shadow-[0_4px_25px_rgba(20,184,166,0.3)] text-xs font-bold">
                {isRefreshing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-400" />
                    <span>Reloading...</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className={`h-3.5 w-3.5 transition-transform duration-200 text-teal-400 ${pullDistance > 65 ? 'rotate-180' : ''}`} />
                    <span>{pullDistance > 65 ? 'Release to reload' : 'Pull to reload'}</span>
                  </>
                )}
              </div>
            </div>
          )}
          
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
                      {dataLoading ? (
                        <div className="space-y-6 animate-pulse">
                          {/* Main metric row skeleton */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 md:p-5 rounded-3xl h-28 md:h-32 flex flex-col justify-between">
                                <div className="space-y-2">
                                  <div className="h-3.5 bg-white/10 rounded-full w-20" />
                                  <div className="h-6 bg-white/10 rounded-lg w-12" />
                                </div>
                                <div className="h-2.5 bg-white/5 rounded-full w-16" />
                              </div>
                            ))}
                          </div>
                          {/* Graph and sub-tables skeleton */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 p-5 md:p-6 rounded-3xl h-80 flex flex-col justify-between">
                              <div className="space-y-2">
                                <div className="h-4 bg-white/10 rounded-full w-32" />
                                <div className="h-3 bg-white/5 rounded-full w-48" />
                              </div>
                              <div className="h-44 bg-white/5 rounded-2xl w-full" />
                            </div>
                            <div className="bg-slate-900/40 border border-white/5 p-5 md:p-6 rounded-3xl h-80 flex flex-col justify-between">
                              <div className="space-y-2">
                                <div className="h-4 bg-white/10 rounded-full w-24" />
                                <div className="h-3 bg-white/5 rounded-full w-32" />
                              </div>
                              <div className="space-y-3 flex-1 mt-6">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex justify-between items-center py-1">
                                    <div className="h-3.5 bg-white/10 rounded-full w-20" />
                                    <div className="h-3.5 bg-white/5 rounded-full w-12" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <DashboardStats
                          jobs={jobs}
                          invoices={invoices}
                          onSelectedStatusFilter={handleOpenStatusFilterFromDashboard}
                        />
                      )}
                    </div>
                  )}

                  {activeTab === 'queue' && (
                    <div id="dispatcher-queue-tab-module">
                      {dataLoading ? (
                        <div className="space-y-4 animate-pulse">
                          {/* Quick filters line */}
                          <div className="flex gap-2 pb-1 overflow-x-auto">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="h-8 bg-white/10 rounded-xl w-16 md:w-20 shrink-0" />
                            ))}
                          </div>
                          {/* Tickets skeletons */}
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-slate-900/40 border border-white/5 p-5 rounded-3xl space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-2.5 w-2/3">
                                  <div className="h-4.5 bg-white/10 rounded-full w-3/4" />
                                  <div className="h-3 bg-white/5 rounded-full w-1/2" />
                                </div>
                                <div className="h-6 bg-white/10 rounded-full w-16" />
                              </div>
                              <div className="h-px bg-white/5" />
                              <div className="flex justify-between items-center pt-1">
                                <div className="h-3.5 bg-white/5 rounded-full w-28" />
                                <div className="h-6 bg-white/10 rounded-lg w-24" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <JobList
                          jobs={jobs}
                          onUpdateJobStatus={handleUpdateJobStatus}
                          onUpdateJobPriority={handleUpdateJobPriority}
                          onOpenInvoiceWizard={handleOpenInvoiceWizard}
                          onViewInvoice={handleViewInvoiceById}
                          onDeleteJob={handleDeleteJob}
                          onEditJob={handleEditJob}
                          currentUser={currentUser || undefined}
                          statusFilter={statusFilter}
                        />
                      )}
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

                      {dataLoading ? (
                        <div className="space-y-4 animate-pulse">
                          <div className="border border-white/5 rounded-2xl overflow-hidden">
                            <div className="bg-white/5 h-10 w-full" />
                            <div className="divide-y divide-white/5">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="p-4 flex justify-between items-center">
                                  <div className="space-y-2">
                                    <div className="h-4 bg-white/10 rounded-full w-24" />
                                    <div className="h-3 bg-white/5 rounded-full w-16" />
                                  </div>
                                  <div className="h-4 bg-white/10 rounded-full w-20" />
                                  <div className="h-4 bg-white/10 rounded-full w-24" />
                                  <div className="h-6 bg-white/10 rounded-lg w-20" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
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
                            <tbody className="divide-y divide-white/5 font-sans">
                              {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-4 font-mono font-bold text-teal-400">{inv.id}</td>
                                  <td className="p-4">
                                    <p className="font-bold text-slate-100">{inv.customerName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{inv.customerPhone}</p>
                                  </td>
                                  <td className="p-4 font-semibold text-slate-300">{inv.paymentMethod}</td>
                                  <td className="p-4 text-right font-extrabold text-slate-100 font-display">{formatMMK(inv.total)}</td>
                                  <td className="p-4 text-center">
                                    <span className="inline-flex text-[9px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold select-none">
                                      Paid
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      type="button"
                                      id={`view-registered-inv-${inv.id}`}
                                      onClick={() => setViewingInvoice(inv)}
                                      className="text-xs text-teal-400 hover:text-teal-300 font-bold cursor-pointer transition-colors"
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
                      )}
                    </div>
                  )}

                  {activeTab === 'deleted' && (
                    <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl text-left space-y-5" id="deleted-list-tab-module">
                      {/* Developer-style Console / Terminal container */}
                      <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg text-slate-200 font-mono text-[11px] md:text-xs">
                        {/* Terminal Header */}
                        <div className="bg-slate-900/80 px-4 py-2.5 flex items-center justify-between select-none border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-inner" />
                            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-inner" />
                            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-inner" />
                            <span className="text-slate-400 text-[11px] font-semibold pl-2 tracking-wide font-mono">system.log — bash</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">Asia/Yangon Timezone</span>
                        </div>

                        {/* Terminal Log Output Body */}
                        <div className="bg-slate-950/60 backdrop-blur-sm p-4 min-h-[350px] max-h-[550px] overflow-y-auto space-y-2 select-text custom-scrollbar">
                          {dataLoading ? (
                            <div className="space-y-3.5 animate-pulse">
                              {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex gap-3">
                                  <div className="h-4 bg-white/10 rounded-full w-24 shrink-0" />
                                  <div className="h-4 bg-white/5 rounded-full w-12 shrink-0" />
                                  <div className="h-4 bg-white/5 rounded-full w-16 shrink-0" />
                                  <div className="h-4 bg-white/10 rounded-full w-full" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'users' && (
                    <UserManagement currentUser={currentUser} />
                  )}

                  {activeTab === 'inventory' && currentUser && (
                    <Inventory
                      currentUser={currentUser}
                      authFetch={authFetch}
                      inventoryItems={inventoryItems}
                      inventoryLogs={inventoryLogs}
                      inventoryCategories={inventoryCategories}
                      inventorySubTab={inventorySubTab}
                      setInventorySubTab={setInventorySubTab}
                      fetchInventoryData={fetchInventoryData}
                      inventoryLoading={inventoryLoading}
                      isAddInventoryOpen={isAddInventoryOpen}
                      setIsAddInventoryOpen={setIsAddInventoryOpen}
                    />
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
                  Cloud Database
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
              <div className="pt-2 flex justify-end gap-2">
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

      {/* MOBILE SIDEBAR DRAWER (AnimatePresence slide-out) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-45 lg:hidden"
            />
            
            {/* Drawer Content */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-[#050e12] border-r border-white/10 text-white flex flex-col z-50 lg:hidden shadow-2xl select-none"
              id="mobile-sidebar"
            >
              {/* Brand Banner */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-tr from-teal-500 to-emerald-600 text-slate-100 border border-white/20 p-2 rounded-xl flex items-center justify-center">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <h1 className="text-xs font-black uppercase tracking-widest font-display text-white">
                      Yangon Store
                    </h1>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Sidebar Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {renderNavItems(() => setIsMobileSidebarOpen(false))}
              </div>

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
                    onClick={() => {
                      setIsMobileSidebarOpen(false);
                      handleLogout();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 border border-white/10 hover:border-rose-500/30 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 text-xs font-bold py-2 px-3 rounded-lg transition-all cursor-pointer active:scale-95"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Log Out
                  </button>
                  {dbStatus && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsMobileSidebarOpen(false);
                        setShowDbStatusModal(true);
                      }}
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* RESPONSIVE BOTTOM NAVBAR FOR SERVICE SUB-MENU TABS */}
      {activeTab !== 'inventory' && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#050e12]/90 backdrop-blur-lg border-t border-white/10 shadow-[0_-4px_16px_rgba(0,0,0,0.15)] select-none transition-all duration-300 lg:hidden"
          id="workspace-bottom-nav"
        >
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
                    <span className="absolute top-0 w-2 h-1 rounded-b-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* RESPONSIVE BOTTOM NAVBAR FOR INVENTORY TABS */}
      {activeTab === 'inventory' && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#050e12]/90 backdrop-blur-lg border-t border-white/10 shadow-[0_-4px_16px_rgba(0,0,0,0.15)] select-none transition-all duration-300 lg:hidden"
          id="inventory-bottom-nav"
        >
          <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-around">
            <button
              type="button"
              id="tab-btn-inventory-stock"
              onClick={() => {
                setInventorySubTab('stock');
              }}
              className={`flex-1 relative flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer transition-all outline-none group ${
                inventorySubTab === 'stock'
                  ? 'text-teal-400 scale-102'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                inventorySubTab === 'stock' ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' : 'group-hover:bg-white/5'
              }`}>
                <Package className="h-4.5 w-4.5 shrink-0" />
              </div>
              <span className={`text-[9px] font-bold tracking-tight mt-0.5 transition-colors ${
                inventorySubTab === 'stock' ? 'text-teal-300 font-bold' : 'text-slate-400'
              }`}>
                Stock
              </span>

              {inventorySubTab === 'stock' && (
                <span className="absolute top-0 w-2 h-1 rounded-b-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
              )}
            </button>

            <button
              type="button"
              id="tab-btn-inventory-logs"
              onClick={() => {
                setInventorySubTab('logs');
              }}
              className={`flex-1 relative flex flex-col items-center justify-center py-1 rounded-xl cursor-pointer transition-all outline-none group ${
                inventorySubTab === 'logs'
                  ? 'text-teal-400 scale-102'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${
                inventorySubTab === 'logs' ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20' : 'group-hover:bg-white/5'
              }`}>
                <History className="h-4.5 w-4.5 shrink-0" />
              </div>
              <span className={`text-[9px] font-bold tracking-tight mt-0.5 transition-colors ${
                inventorySubTab === 'logs' ? 'text-teal-300 font-bold' : 'text-slate-400'
              }`}>
                Logs
              </span>

              {inventorySubTab === 'logs' && (
                <span className="absolute top-0 w-2 h-1 rounded-b-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* DOUBLE PRESS BACK TO EXIT CONFIRMATION TOAST */}
      {exitConfirmActive && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 backdrop-blur-md border border-white/10 text-white text-xs font-semibold py-3 px-5 rounded-full shadow-2xl flex items-center gap-2.5 animate-bounce shadow-teal-500/10 select-none">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          <span>Press back again to exit the application</span>
        </div>
      )}
    </div>
  );
}

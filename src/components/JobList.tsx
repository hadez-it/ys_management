import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Wrench,
  Clock,
  User as UserIcon,
  Phone,
  MapPin,
  Calendar,
  AlertOctagon,
  UserCheck,
  Navigation,
  CheckCircle,
  FileText,
  AlertCircle,
  Cpu,
  X,
  Trash2,
  Edit
} from 'lucide-react';
import { ServiceJob, JobStatus, UrgencyLevel, User } from '../types.ts';
import { formatDateTime } from '../utils.ts';
import JobForm from './JobForm.tsx';

interface JobListProps {
  jobs: ServiceJob[];
  onUpdateJobStatus: (
    jobId: string,
    status: JobStatus,
    technicianName?: string,
    diagnosedProblem?: string,
    resolutionNotes?: string,
    remarks?: string
  ) => void;
  onUpdateJobPriority?: (jobId: string, priorityNumber: number | undefined) => void;
  onOpenInvoiceWizard: (job: ServiceJob) => void;
  onViewInvoice: (invoiceId: string) => void;
  onDeleteJob?: (jobId: string, reason: string) => void;
  onEditJob?: (jobId: string, updatedJobData: any) => void;
  currentUser?: User;
}

export default function JobList({ jobs, onUpdateJobStatus, onUpdateJobPriority, onOpenInvoiceWizard, onViewInvoice, onDeleteJob, onEditJob, currentUser }: JobListProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'repairing' | 'completed'>('upcoming');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [mobileView, setMobileView] = useState<'list' | 'details'>('list');
  
  const [tempRemark, setTempRemark] = useState('');

  const tabIndexMap = {
    upcoming: 0,
    repairing: 1,
    completed: 2
  };

  const handleTabChange = (newTab: 'upcoming' | 'repairing' | 'completed') => {
    if (newTab === activeTab) return;
    const currentIdx = tabIndexMap[activeTab];
    const newIdx = tabIndexMap[newTab];
    setSlideDirection(newIdx > currentIdx ? 'right' : 'left');
    setActiveTab(newTab);
  };

  // Mobile Swipe Gesture Event Handlers
  const touchStartXRef = React.useRef<number | null>(null);
  const touchStartYRef = React.useRef<number | null>(null);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartXRef.current;
    const diffY = touch.clientY - touchStartYRef.current;

    // Reset touch trackers
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Minimum distance required for registering a swipe gesture (in pixels)
    const minSwipeDistance = 65;

    // Verify horizontal movement was dominant (avoid trigger on simple vertical scroll operations)
    if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        // Swiped Right -> Navigates to previous tab (direction is leftwards transition)
        if (activeTab === 'completed') {
          setSlideDirection('left');
          setActiveTab('repairing');
        } else if (activeTab === 'repairing') {
          setSlideDirection('left');
          setActiveTab('upcoming');
        }
      } else {
        // Swiped Left -> Navigates to next tab (direction is rightwards transition)
        if (activeTab === 'upcoming') {
          setSlideDirection('right');
          setActiveTab('repairing');
        } else if (activeTab === 'repairing') {
          setSlideDirection('right');
          setActiveTab('completed');
        }
      }
    }
  };

  // Technician inputs during repair
  const [diagnosedProblem, setDiagnosedProblem] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Priority queue interactive states
  const [prioritySettingJob, setPrioritySettingJob] = useState<ServiceJob | null>(null);
  const [priorityInputValue, setPriorityInputValue] = useState<string>('');

  // Delete option interactive states
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteReasonText, setDeleteReasonText] = useState('');

  // Edit ticket interactive states
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  // Lock body touch track/scroll when modal is active
  React.useEffect(() => {
    if (isModalOpen || !!prioritySettingJob || isDeleteConfirmOpen || isEditFormOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, prioritySettingJob, isDeleteConfirmOpen, isEditFormOpen]);

  // Capture Android / mobile browser back button to close open modals instead of exiting page completely
  const isAnyModalOpen = isModalOpen || !!prioritySettingJob || isDeleteConfirmOpen || isEditFormOpen;
  const didPushStateRef = React.useRef(false);

  React.useEffect(() => {
    if (isAnyModalOpen) {
      if (!didPushStateRef.current) {
        window.history.pushState({ modalActive: true }, '');
        didPushStateRef.current = true;
      }
    } else {
      if (didPushStateRef.current) {
        didPushStateRef.current = false;
        if (window.history.state && window.history.state.modalActive) {
          window.history.back();
        }
      }
    }
  }, [isAnyModalOpen]);

  React.useEffect(() => {
    const handlePopState = () => {
      if (didPushStateRef.current) {
        didPushStateRef.current = false;
        setIsModalOpen(false);
        setPrioritySettingJob(null);
        setIsDeleteConfirmOpen(false);
        setIsEditFormOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Touch hold state refs to differentiate tap vs long touch on mobile
  const touchTimerRef = React.useRef<any>(null);
  const isLongPressRef = React.useRef(false);

  const handleTouchStart = (job: ServiceJob) => {
    isLongPressRef.current = false;
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      handleOpenPrioritySelector(job);
    }, 600); // 600ms long press hold
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleOpenPrioritySelector = (job: ServiceJob) => {
    setPrioritySettingJob(job);
    setPriorityInputValue(job.priorityNumber !== undefined ? String(job.priorityNumber) : '');
  };

  const handleSavePriority = () => {
    if (!prioritySettingJob) return;
    const val = priorityInputValue.trim();
    const cleanNum = val === '' ? undefined : parseInt(val, 10);
    
    if (onUpdateJobPriority) {
      onUpdateJobPriority(prioritySettingJob.id, cleanNum);
    }
    setPrioritySettingJob(null);
  };

  const sortJobsInQueue = (a: ServiceJob, b: ServiceJob) => {
    const aPriority = typeof a.priorityNumber === 'number' && !isNaN(a.priorityNumber);
    const bPriority = typeof b.priorityNumber === 'number' && !isNaN(b.priorityNumber);

    if (aPriority && bPriority) {
      if (a.priorityNumber === b.priorityNumber) {
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      }
      return (a.priorityNumber as number) - (b.priorityNumber as number);
    }
    if (aPriority) return -1;
    if (bPriority) return 1;

    return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  // Filters logic
  const filteredJobs = jobs.filter(job => {
    return (
      job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerPhone.includes(searchQuery) ||
      (job.deviceModel || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.locationText || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const upcomingCount = filteredJobs.filter(
    j => j.status === 'Created' || j.status === 'Assigned' || j.status === 'Dispatched'
  ).length;

  const repairingCount = filteredJobs.filter(
    j => j.status === 'Repairing' || j.status === 'ServiceInProgress'
  ).length;

  const completedCount = filteredJobs.filter(
    j => j.status === 'Completed' || j.status === 'Cancelled'
  ).length;

  const tabFilteredJobs = filteredJobs.filter(job => {
    if (activeTab === 'upcoming') {
      return job.status === 'Created' || job.status === 'Assigned' || job.status === 'Dispatched';
    } else if (activeTab === 'repairing') {
      return job.status === 'Repairing' || job.status === 'ServiceInProgress';
    } else {
      return job.status === 'Completed' || job.status === 'Cancelled';
    }
  });

  const getStatusBadge = (status: JobStatus) => {
    const map = {
      Created: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      Assigned: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      Dispatched: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      ServiceInProgress: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
      Repairing: 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse',
      Completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      Cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] || 'bg-white/5 text-slate-300 border-white/10'}`}>
        {status === 'ServiceInProgress' ? '🛠️ Servicing' : status === 'Dispatched' ? '🛵 En Route' : status === 'Repairing' ? '🔧 Repairing' : status}
      </span>
    );
  };

  const getUrgencyBadge = (urgency: UrgencyLevel) => {
    const map = {
      Low: 'bg-white/5 text-slate-300 border border-white/10',
      Medium: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
      High: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      Critical: 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse',
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${map[urgency] || 'bg-white/5 border-white/10'}`}>
        {urgency === 'Critical' ? '🚨 CRITICAL' : urgency}
      </span>
    );
  };

  const getJobCategory = (job: ServiceJob): 'Overdue' | 'Today' | 'Tomorrow' | 'Upcoming' | 'Archive' => {
    if (job.status === 'Completed' || job.status === 'Cancelled') {
      return 'Archive';
    }

    try {
      const now = new Date();
      
      let cleanJobDateTime = job.dateTime || '';
      if (cleanJobDateTime.includes('none') || cleanJobDateTime.endsWith('T') || cleanJobDateTime.includes('Tnone')) {
        cleanJobDateTime = cleanJobDateTime.split('T')[0];
      }
      
      let jobDate = new Date(cleanJobDateTime);
      if (isNaN(jobDate.getTime())) {
        const datePart = cleanJobDateTime.split('T')[0];
        jobDate = new Date(datePart);
      }

      if (isNaN(jobDate.getTime())) {
        return 'Upcoming';
      }

      // Format both 'now' and 'jobDate' in Asia/Yangon region
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Yangon',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });

      const nowYangonStr = formatter.format(now);
      const [nowM, nowD, nowY] = nowYangonStr.split('/').map(Number);
      const nowMidnightYangon = Date.UTC(nowY, nowM - 1, nowD);

      const jobYangonStr = formatter.format(jobDate);
      const [jobM, jobD, jobY] = jobYangonStr.split('/').map(Number);
      const jobMidnightYangon = Date.UTC(jobY, jobM - 1, jobD);

      const diffDays = Math.round((jobMidnightYangon - nowMidnightYangon) / (24 * 60 * 60 * 1000));
      
      if (diffDays < 0) {
        return 'Overdue';
      } else if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else {
        return 'Upcoming';
      }
    } catch {
      return 'Upcoming';
    }
  };

  // Pre-fill input details only when a different job is selected or the modal is opened
  React.useEffect(() => {
    if (isModalOpen && selectedJob) {
      setDiagnosedProblem(selectedJob.diagnosedProblem || '');
      setResolutionNotes(selectedJob.resolutionNotes || '');
      setShowWorkflow(false);
    }
  }, [selectedJobId, isModalOpen]);

  // Grouped filtered jobs
  const overdueJobs = tabFilteredJobs.filter(j => getJobCategory(j) === 'Overdue').sort(sortJobsInQueue);
  const todayJobs = tabFilteredJobs.filter(j => getJobCategory(j) === 'Today').sort(sortJobsInQueue);
  const tomorrowJobs = tabFilteredJobs.filter(j => getJobCategory(j) === 'Tomorrow').sort(sortJobsInQueue);
  const upcomingJobs = tabFilteredJobs.filter(j => getJobCategory(j) === 'Upcoming').sort(sortJobsInQueue);
  const archiveJobs = tabFilteredJobs.filter(j => getJobCategory(j) === 'Archive').sort(sortJobsInQueue);

  const groupJobsByDateString = (jobsList: ServiceJob[]) => {
    const groups: { [key: string]: ServiceJob[] } = {};
    jobsList.forEach(job => {
      try {
        const datePart = job.dateTime.split('T')[0];
        const dateObj = new Date(datePart);
        const dateKey = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'Asia/Yangon'
            })
          : 'Other Date';
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(job);
      } catch {
        const fallback = 'Other Date';
        if (!groups[fallback]) {
          groups[fallback] = [];
        }
        groups[fallback].push(job);
      }
    });
    return groups;
  };

  const getSortedDateGroups = (grouped: { [key: string]: ServiceJob[] }) => {
    return Object.entries(grouped).sort(([dateA], [dateB]) => {
      if (dateA === 'Other Date') return 1;
      if (dateB === 'Other Date') return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  };

  const renderJobCard = (job: ServiceJob) => {
    const isSelected = job.id === selectedJobId && isModalOpen;
    const isOverdueAndUpcoming = activeTab === 'upcoming' && getJobCategory(job) === 'Overdue';
    
    return (
      <div
        key={job.id}
        id={`job-card-${job.id}`}
        onClick={() => {
          if (isLongPressRef.current) {
            isLongPressRef.current = false;
            return;
          }
          setSelectedJobId(job.id);
          setIsModalOpen(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          handleOpenPrioritySelector(job);
        }}
        onTouchStart={() => handleTouchStart(job)}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchEnd}
        className={`p-4 border rounded-2xl cursor-pointer text-left transition-all duration-200 relative overflow-hidden group select-none ${
          isSelected
            ? 'border-teal-500 bg-teal-500/15 shadow-[0_0_15px_rgba(13,148,136,0.15)]'
            : isOverdueAndUpcoming
            ? 'border-rose-500/40 bg-rose-500/10 hover:border-rose-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)]'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 hover:shadow-md'
        }`}
      >
        {/* Active marker left border */}
        {isSelected && (
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-teal-500" />
        )}
        {/* Overdue marker left border when not selected */}
        {!isSelected && isOverdueAndUpcoming && (
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
        )}

        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black font-mono tracking-wider text-teal-300">
              {job.id}
            </span>
            {isOverdueAndUpcoming && (
              <span className="text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-rose-750 animate-pulse">
                ⏰ OVERDUE
              </span>
            )}
            {job.status === 'Completed' ? (
              <span className="text-[10px] font-bold font-sans bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5 select-none">
                Priority: None
              </span>
            ) : (
              job.priorityNumber !== undefined && (
                <span className="text-[10px] font-extrabold font-sans bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5 border border-amber-600 animate-pulse">
                  ⭐ Priority #{job.priorityNumber}
                </span>
              )
            )}
          </div>
          {getUrgencyBadge(job.urgency)}
        </div>

        <div className="mt-2">
          <h4 className={`text-sm font-extrabold tracking-tight transition-colors ${isOverdueAndUpcoming ? 'text-rose-200 group-hover:text-rose-100' : 'text-white group-hover:text-teal-300'}`}>
            {job.customerName}
          </h4>
          <p className="text-[11px] text-slate-300 font-sans mt-0.5 flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 inline text-slate-400" /> <span className="font-mono tracking-wide">{job.customerPhone}</span>
          </p>
        </div>

        <div className="mt-2.5 text-xs bg-white/5 border border-white/5 p-2 rounded-lg text-slate-200 line-clamp-2 leading-relaxed flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
          <span>{job.locationText}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
          <div className={`flex items-center gap-1 font-semibold ${isOverdueAndUpcoming ? 'text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5' : 'text-slate-350'}`}>
            <Calendar className={`h-3.5 w-3.5 shrink-0 ${isOverdueAndUpcoming ? 'text-rose-400 animate-pulse' : 'text-teal-500'}`} /> {formatDateTime(job.dateTime)}
          </div>
          {getStatusBadge(job.status)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6" id="job-management-viewport">
      {/* Search Header Container (Full Width) */}
      <div className="ios-glass-card p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              id="job-list-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, ticket, or location..."
              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-400 pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none focus:bg-white/10 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all font-sans"
            />
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex border-b border-white/5 -mx-5 px-5 select-none overflow-x-auto scrollbar-none gap-6 shrink-0">
          <button
            type="button"
            onClick={() => handleTabChange('upcoming')}
            className={`flex items-center gap-2 pb-3 pt-1 text-xs font-bold tracking-wide uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus:outline-none ${
              activeTab === 'upcoming'
                ? 'border-teal-500 text-teal-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Upcoming
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-sans font-extrabold ${
              activeTab === 'upcoming' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'bg-white/5 text-slate-400'
            }`}>
              {upcomingCount}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => handleTabChange('repairing')}
            className={`flex items-center gap-2 pb-3 pt-1 text-xs font-bold tracking-wide uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus:outline-none ${
              activeTab === 'repairing'
                ? 'border-amber-500 text-amber-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Repairing
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-sans font-extrabold ${
              activeTab === 'repairing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'
            }`}>
              {repairingCount}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => handleTabChange('completed')}
            className={`flex items-center gap-2 pb-3 pt-1 text-xs font-bold tracking-wide uppercase border-b-2 transition-all cursor-pointer whitespace-nowrap focus:outline-none ${
              activeTab === 'completed'
                ? 'border-emerald-500 text-emerald-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Completed
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-sans font-extrabold ${
              activeTab === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-slate-400'
            }`}>
              {completedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Categories divided full-width list */}
      <div className="relative overflow-hidden w-full min-h-[450px]" id="job-cards-list-animation-viewport">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={activeTab}
            custom={slideDirection}
            variants={{
              enter: (direction: 'left' | 'right') => ({
                x: direction === 'right' ? 120 : -120,
                opacity: 0,
              }),
              center: {
                x: 0,
                opacity: 1,
              },
              exit: (direction: 'left' | 'right') => ({
                x: direction === 'right' ? -120 : 120,
                opacity: 0,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
            className="w-full space-y-6 min-h-[450px] select-none"
            id="job-cards-list"
          >
            {tabFilteredJobs.length === 0 ? (
              <div className="ios-glass-card p-16 text-center rounded-3xl min-h-[350px] flex flex-col items-center justify-center select-none" id="no-jobs-visual">
                <Clock className="h-10 w-10 text-teal-400 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-300 mt-3.5 uppercase tracking-wider">No Tickets in this tab</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  {searchQuery ? "No queues match your search query." : "There are currently no tickets assigned under this tab."}
                </p>
                <div className="mt-4 flex gap-2 text-[10px] bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-1.5 text-teal-300 font-bold font-sans">
                  <span>👉 Swipe left or right to switch tabs</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Overdue Section */}
                {overdueJobs.length > 0 && (
                  <div className="bg-rose-955/10 border border-rose-500/20 p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between select-none pb-2.5 border-b border-rose-500/15">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-xs font-extrabold text-rose-300 uppercase tracking-wider font-sans">Overdue</span>
                      </div>
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2.5 py-0.5 rounded-lg border border-rose-500/10">
                        {overdueJobs.length} ticket{overdueJobs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-5 divide-y divide-rose-500/10">
                      {getSortedDateGroups(groupJobsByDateString(overdueJobs)).map(([dateKey, jobsForDate], idx) => (
                        <div key={dateKey} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-extrabold text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20 font-mono tracking-wide">
                              📅 {dateKey}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobsForDate.map((job) => renderJobCard(job))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Today Section */}
                {todayJobs.length > 0 && (
                  <div className="bg-teal-950/10 border border-teal-500/20 p-4 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between select-none pb-2.5 border-b border-teal-500/15">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                        <span className="text-xs font-extrabold text-teal-300 uppercase tracking-wider font-sans">Today</span>
                      </div>
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-2.5 py-0.5 rounded-lg border border-teal-500/10">
                        {todayJobs.length} ticket{todayJobs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-5 divide-y divide-teal-500/10">
                      {getSortedDateGroups(groupJobsByDateString(todayJobs)).map(([dateKey, jobsForDate], idx) => (
                        <div key={dateKey} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-extrabold text-teal-300 bg-teal-500/10 px-2.5 py-0.5 rounded-lg border border-teal-500/20 font-mono tracking-wide">
                              📅 {dateKey}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobsForDate.map((job) => renderJobCard(job))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Tomorrow Section */}
                {tomorrowJobs.length > 0 && (
                  <div className="bg-amber-955/5 border border-amber-500/20 p-4 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between select-none pb-2.5 border-b border-amber-500/15">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider font-sans">Tomorrow</span>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-lg border border-amber-500/10">
                        {tomorrowJobs.length} ticket{tomorrowJobs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-5 divide-y divide-amber-500/10">
                      {getSortedDateGroups(groupJobsByDateString(tomorrowJobs)).map(([dateKey, jobsForDate], idx) => (
                        <div key={dateKey} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20 font-mono tracking-wide">
                              📅 {dateKey}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobsForDate.map((job) => renderJobCard(job))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Upcoming / Later Section */}
                {upcomingJobs.length > 0 && (
                  <div className="bg-white/2 border border-white/5 p-4 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between select-none pb-2.5 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                        <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider font-sans">Upcoming</span>
                      </div>
                      <span className="text-[10px] bg-white/5 text-slate-300 font-bold px-2.5 py-0.5 rounded-lg border border-white/5">
                        {upcomingJobs.length} ticket{upcomingJobs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-5 divide-y divide-white/5">
                      {getSortedDateGroups(groupJobsByDateString(upcomingJobs)).map(([dateKey, jobsForDate], idx) => (
                        <div key={dateKey} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-extrabold text-slate-300 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10 font-mono tracking-wide">
                              📅 {dateKey}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobsForDate.map((job) => renderJobCard(job))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Closed Archive Section */}
                {archiveJobs.length > 0 && (
                  <div className="bg-white/2 border border-white/5 p-4 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between select-none pb-2.5 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                        <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider font-sans">Completed / Closed Archive</span>
                      </div>
                      <span className="text-[10px] bg-white/5 text-slate-400 font-medium px-2.5 py-0.5 rounded-lg border border-white/5">
                        {archiveJobs.length} ticket{archiveJobs.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-5 divide-y divide-white/5">
                      {getSortedDateGroups(groupJobsByDateString(archiveJobs)).map(([dateKey, jobsForDate], idx) => (
                        <div key={dateKey} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                          <div className="flex items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10 font-mono tracking-wide">
                              📅 {dateKey}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {jobsForDate.map((job) => renderJobCard(job))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* JOBS DETAILS MODAL OVERLAY (POPUP) */}
      {isModalOpen && selectedJob && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 pt-4 sm:pt-4 z-50 animate-fade-in sm:items-center overflow-y-auto"
          id="job-detail-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="ios-glass-dark rounded-3xl w-full max-w-2xl max-h-[96vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-white/10"
            id="job-detail-modal-card"
            onClick={(e) => e.stopPropagation()} // Prevent closing on clicking card surface
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 sticky top-0 bg-[#050e12]/90 backdrop-blur-md z-25">
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight text-teal-300 bg-teal-500/20 px-2 py-0.5 sm:px-2.5 sm:rounded-md rounded border border-teal-500/10">
                    {selectedJob.id}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400">Created {formatDateTime(selectedJob.createdAt)}</span>
                </div>
                <div className="mt-1.5 text-left">
                  <h3 className="text-base sm:text-lg font-extrabold text-white font-sans tracking-tight leading-snug break-words">
                    {selectedJob.customerName} : <span className="font-mono text-teal-300 font-bold select-text">{selectedJob.customerPhone}</span>
                  </h3>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
                {getUrgencyBadge(selectedJob.urgency)}
                {getStatusBadge(selectedJob.status)}
                
                {/* EDIT DETAILS BUTTON (ADMIN & COORDINATOR) */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'coordinator') && (
                  <button
                    type="button"
                    onClick={() => setIsEditFormOpen(true)}
                    className="p-1 sm:p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-amber-500/20"
                    title="Edit Ticket Details"
                  >
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}

                {/* DELETE TICKET BUTTON (ADMIN ONLY) */}
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteReasonText('');
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-1 sm:p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-rose-500/20"
                    title="Delete Ticket"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}

                {/* CLOSE WINDOW BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 sm:p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                  title="Close Dialog"
                >
                  <X className="h-4 sm:h-5 sm:w-5 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable details wrapper */}
            <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
              {/* Grid with customer stats vs hardware stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" id="customer-expanded-details-grid">
                {/* Customer Info Card */}
                <div className="p-3 sm:p-5 bg-teal-950/20 border border-teal-500/20 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3.5 text-left shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider border-b border-teal-500/10 pb-1.5 sm:pb-2 flex items-center gap-2 select-none font-sans">
                    <UserIcon className="h-4 w-4 text-teal-400" /> Customer Information
                  </h4>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-2 bg-white/5 backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider leading-none mb-1 select-none">Phone Number</span>
                        <strong className="text-white font-mono text-xs sm:text-base tracking-tight select-text">{selectedJob.customerPhone}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(selectedJob.customerPhone);
                          alert('Copied phone number!');
                        }}
                        className="text-[9px] sm:text-[10px] bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold px-2 sm:px-2.5 py-1 rounded border border-teal-500/20 transition-colors cursor-pointer select-none"
                      >
                        Copy
                      </button>
                    </div>
                    
                    <div className="bg-white/5 backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider leading-none mb-1 select-none">Service Address</span>
                      <p className="text-white font-medium text-xs sm:text-sm leading-relaxed break-words select-text">{selectedJob.locationText}</p>
                    </div>
                  </div>
                </div>

                {/* Device Hardware Info Card */}
                <div className="p-3 sm:p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3.5 text-left shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider border-b border-emerald-500/10 pb-1.5 sm:pb-2 flex items-center gap-2 select-none font-sans">
                    <Cpu className="h-4 w-4 text-emerald-400" /> Service Ticket Data
                  </h4>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="bg-white/5 backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10 flex justify-between items-center gap-2">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider leading-none mb-1 select-none">Item Type</span>
                        <strong className="text-white text-xs sm:text-sm">{selectedJob.deviceType}</strong>
                      </div>
                    </div>
                    {selectedJob.deviceModel && (
                      <div className="bg-white/5 backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider leading-none mb-1 select-none">Model / Hardware Ref</span>
                        <strong className="text-white text-xs sm:text-sm select-text">{selectedJob.deviceModel}</strong>
                      </div>
                    )}
                    <div className="bg-white/5 backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider leading-none mb-1 select-none">Scheduled Appointment</span>
                      <strong className="text-teal-300 text-xs sm:text-sm select-text">{formatDateTime(selectedJob.dateTime)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware Problem Diagnostic description */}
              <div className="p-4 bg-rose-955/15 border border-rose-500/20 rounded-xl text-left">
                <h4 className="text-xs font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> Device Problem Description
                </h4>
                <p className="text-xs text-rose-100 leading-relaxed font-sans">
                  {selectedJob.deviceIssue}
                </p>
              </div>

              {/* Dynamic remarks tracking details */}
              <div className="p-4 bg-amber-955/10 border border-amber-500/20 rounded-xl text-left space-y-1.5">
                <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                  <AlertOctagon className="h-3.5 w-3.5 text-amber-400" /> Communication Remarks
                </h4>
                {selectedJob.remarks ? (
                  <div className="text-xs text-amber-100 whitespace-pre-wrap leading-relaxed font-sans bg-white/5 p-2.5 rounded-lg border border-white/10 max-h-[140px] overflow-y-auto">
                    {selectedJob.remarks}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No notes or remarks logged yet.</p>
                )}
                
                {/* Preset responses and Manual entry field */}
                <div className="pt-2 border-t border-white/5 mt-2">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                        const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                        const text = `[${datePrefix} ${timestamp}] Unreachable: Busy / No Answer`;
                        const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                        onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                      }}
                      className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold py-1 px-2.5 rounded-lg border border-amber-500/20 cursor-pointer transition-all"
                    >
                      📞 Busy / No Answer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                        const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                        const text = `[${datePrefix} ${timestamp}] Unreachable: Switched Off`;
                        const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                        onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                      }}
                      className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold py-1 px-2.5 rounded-lg border border-amber-500/20 cursor-pointer transition-all"
                    >
                      📴 Switched Off
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                        const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                        const text = `[${datePrefix} ${timestamp}] Site Unreachable: Customer Closed / Away`;
                        const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                        onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                      }}
                      className="text-[10px] bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 font-semibold py-1 px-2.5 rounded-lg border border-slate-500/20 cursor-pointer transition-all"
                    >
                      🏠 Closed / Not Present
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="input-manual-remark"
                      placeholder="Type custom action description..."
                      value={tempRemark}
                      onChange={(e) => setTempRemark(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 text-xs py-1.5 px-3 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans placeholder-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempRemark.trim()) return;
                        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                        const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                        const text = `[${datePrefix} ${timestamp}] ${tempRemark.trim()}`;
                        const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                        onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        setTempRemark('');
                      }}
                      className="bg-teal-600 text-white rounded-lg px-3.5 py-1 text-xs font-bold hover:bg-teal-700 cursor-pointer transition-all active:scale-95 border border-teal-500/25"
                    >
                      Save Remark
                    </button>
                  </div>
                </div>
              </div>

              {/* Audit trail / Edit Logs history */}
              {selectedJob.editHistory && selectedJob.editHistory.length > 0 && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-left space-y-2 animate-fade-in" id="ticket-edit-history-logs">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 select-none font-sans">
                    <Edit className="h-3.5 w-3.5 text-amber-400" /> Ticket Edit History & Audit Logs
                  </h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedJob.editHistory.map((log, idx) => {
                      const logDateStr = log.editedAt ? new Date(log.editedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Yangon'
                      }) : '-';
                      return (
                        <div key={idx} className="bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {logDateStr}
                            </span>
                            {log.changedFields && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                                Changed: {log.changedFields}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                            ✏️ {log.reason}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Closed diagnostics details */}
              {selectedJob.status === 'Completed' && (
                <div className="p-4 bg-emerald-955/20 border border-emerald-500/20 rounded-xl text-left space-y-1.5">
                  <h4 className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Diagnostic Summary & Resolution Notes
                  </h4>
                  <div className="text-xs space-y-1 text-slate-200">
                    <p>
                      <strong className="text-white">Diagnosed Fault finding:</strong> {selectedJob.diagnosedProblem || 'N/A'}
                    </p>
                    <p>
                      <strong className="text-white">Resolution solution:</strong> {selectedJob.resolutionNotes || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* WORKFLOW CONTROLS SECTION */}
            {selectedJob.status !== 'Completed' && selectedJob.status !== 'Cancelled' ? (
              // Active ticket: toggleable workflow
              !showWorkflow ? (
                <div className="p-4 bg-slate-955/80 border-t border-white/5 text-center shrink-0 sticky bottom-0 z-20 backdrop-blur-md flex flex-col sm:flex-row gap-3">
                  {selectedJob.status !== 'Repairing' && (
                    <button
                      type="button"
                      id="btn-mark-repairing"
                      onClick={() => {
                        onUpdateJobStatus(
                          selectedJob.id,
                          'Repairing',
                          selectedJob.technicianName,
                          selectedJob.diagnosedProblem,
                          selectedJob.resolutionNotes,
                          selectedJob.remarks
                        );
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95 border border-amber-500/25"
                    >
                      <Wrench className="h-4 w-4 shrink-0 animate-spin" />
                      Start Repairing
                    </button>
                  )}
                  {selectedJob.status === 'Repairing' && (
                    <button
                      type="button"
                      id="btn-show-workflow"
                      onClick={() => setShowWorkflow(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95 border border-teal-500/25"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Complete Repair Work
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 sm:p-5 bg-[#050e12]/95 border-t border-white/5 text-left shrink-0 space-y-3.5 animate-scale-up sticky bottom-0 z-20 backdrop-blur-md max-h-[48vh] overflow-y-auto">
                  <div className="flex items-center justify-end border-b border-white/5 pb-2">
                    <button
                      type="button"
                      onClick={() => setShowWorkflow(false)}
                      className="text-[10px] font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors cursor-pointer select-none border border-white/10"
                    >
                      ▲ Hide
                    </button>
                  </div>

                  <div>
                    {/* Only 1 workflow: complete status mark */}
                    <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl" id="state-widget-servicing">
                      <p className="text-xs text-slate-300 mb-1 font-semibold">
                        Enter Repair Information (Diagnosed finding and action done):
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Diagnosed Fault Findings</label>
                          <input
                            type="text"
                            id="problem-findings-input"
                            placeholder="e.g. Broken motherboard chip..."
                            value={diagnosedProblem}
                            onChange={(e) => setDiagnosedProblem(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 py-1.5 px-3 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Resolution / Action Done</label>
                          <input
                            type="text"
                            id="resolution-findings-input"
                            placeholder="e.g. Resoldered logic module..."
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 py-1.5 px-3 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          id="btn-complete-service-task"
                          onClick={() => {
                            if (!diagnosedProblem.trim() || !resolutionNotes.trim()) {
                              alert('Please fill both findings and resolution steps!');
                              return;
                            }
                            onUpdateJobStatus(selectedJob.id, 'Completed', selectedJob.technicianName, diagnosedProblem, resolutionNotes);
                          }}
                          className="inline-flex items-center gap-1.5 py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-all text-xs shadow-xs border border-emerald-500/25"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Log Repair Completed
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* COMMUNICATORS & UNREACHABLE DISPATCH PRESET ACTIONS */}
                  <div className="border-t border-white/5 pt-3 space-y-2 hidden">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wilder block select-none">
                      Log Remarks / Customer Unreachable Actions
                    </label>
                    
                    {/* Preset responses */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                          const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                          const text = `[${datePrefix} ${timestamp}] Unreachable: Busy / No Answer`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold py-1 px-2.5 rounded-lg border border-amber-500/20 cursor-pointer transition-all"
                      >
                        📞 Busy / No Answer
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                          const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                          const text = `[${datePrefix} ${timestamp}] Unreachable: Switched Off`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold py-1 px-2.5 rounded-lg border border-amber-500/20 cursor-pointer transition-all"
                      >
                        📴 Switched Off
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                          const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                          const text = `[${datePrefix} ${timestamp}] Site Unreachable: Customer Closed / Away`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 font-semibold py-1 px-2.5 rounded-lg border border-slate-500/20 cursor-pointer transition-all"
                      >
                        🏠 Closed / Not Present
                      </button>
                    </div>

                    {/* Manual entry field */}
                    <div className="flex gap-2 pt-0.5">
                      <input
                        type="text"
                        id="input-manual-remark"
                        placeholder="Type custom action description..."
                        value={tempRemark}
                        onChange={(e) => setTempRemark(e.target.value)}
                        className="flex-1 bg-slate-900 border border-white/10 text-xs py-1.5 px-3 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempRemark.trim()) return;
                          const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
                          const datePrefix = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Yangon' });
                          const text = `[${datePrefix} ${timestamp}] ${tempRemark.trim()}`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                          setTempRemark('');
                        }}
                        className="bg-teal-600 text-white rounded-lg px-3.5 py-1 text-xs font-bold hover:bg-teal-700 cursor-pointer transition-all active:scale-95 border border-teal-500/25"
                      >
                        Save Remark
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              // Completed or Cancelled ticket: show billing/receipt or cancelled banner directly without toggles
              <div className="p-4 sm:p-5 bg-slate-955/80 border-t border-white/5 text-left shrink-0 space-y-3 sticky bottom-0 z-20 backdrop-blur-md">
                {/* Case 5: Completed with invoice wizard pending */}
                {selectedJob.status === 'Completed' && !selectedJob.invoiceId && (
                  <div className="space-y-2 bg-teal-500/10 p-3 rounded-xl border border-teal-500/20" id="state-widget-invoice-ready">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs text-teal-300 font-semibold">
                          Repair Complete! Billing Outstanding
                        </p>
                        <p className="text-[11px] text-slate-350 mt-0.5">
                          {currentUser?.role === 'admin' || currentUser?.role === 'senior_technician'
                            ? "Launch the invoice generator layout to file Myanmar Kyats billing:"
                            : "Invoicing is restricted to Administrators or Senior Technicians."}
                        </p>
                      </div>
                      {currentUser?.role === 'admin' || currentUser?.role === 'senior_technician' ? (
                        <button
                          type="button"
                          id="btn-launch-invoice-wizard"
                          onClick={() => {
                            setIsModalOpen(false);
                            onOpenInvoiceWizard(selectedJob);
                          }}
                          className="inline-flex items-center justify-center gap-1 py-1.5 px-3.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all shrink-0 active:scale-95 border border-teal-500/25"
                        >
                          <FileText className="h-3.5 w-3.5" /> File Invoice
                        </button>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1.5 rounded-lg border border-slate-700 font-semibold select-none shrink-0">
                          Billing Pending
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Case 6: Completed and invoiced */}
                {selectedJob.status === 'Completed' && selectedJob.invoiceId && (
                  <div className="space-y-2 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20" id="state-widget-invoiced">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1 leading-none">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Invoice Settled
                        </p>
                        <p className="text-[11px] text-slate-450 font-mono mt-1">
                          Settlement ID: {selectedJob.invoiceId}
                        </p>
                      </div>
                      <button
                        type="button"
                        id="btn-view-settled-invoice"
                        onClick={() => {
                          setIsModalOpen(false);
                          onViewInvoice(selectedJob.invoiceId!);
                        }}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 border border-teal-500/20 text-teal-300 text-xs font-semibold rounded-lg hover:bg-teal-500/20 cursor-pointer bg-teal-500/10 active:scale-95"
                      >
                        <FileText className="h-3.5 w-3.5" /> View Receipt
                      </button>
                    </div>
                  </div>
                )}

                {/* Case 7: Cancelled */}
                {selectedJob.status === 'Cancelled' && (
                  <div className="p-3 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-xs flex items-center gap-2" id="state-widget-cancelled">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>This service case has been cancelled and deactivated.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE PRIORITY QUEUE RANK SELECTOR OVERLAY */}
      {prioritySettingJob && (() => {
        const isCompletedJob = prioritySettingJob.status === 'Completed';
        return (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 pt-10 sm:pt-4 z-50 animate-fade-in sm:items-center overflow-y-auto"
            id="priority-selector-overlay"
            onClick={() => setPrioritySettingJob(null)}
          >
            <div
              className={`ios-glass-dark rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-white/10 p-6 space-y-4 text-left ${
                isCompletedJob ? 'border-white/5 bg-slate-900/50' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className={`font-extrabold text-sm flex items-center gap-1.5 font-sans ${isCompletedJob ? 'text-slate-500' : 'text-white'}`}>
                  ⭐ Edit Priority Index
                </h3>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  onClick={() => setPrioritySettingJob(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isCompletedJob && (
                <div className="bg-slate-800/60 border border-white/5 text-slate-400 text-[11px] p-3 rounded-xl font-medium leading-relaxed font-sans select-none">
                  🚫 Priority queue controls are locked because this ticket has already been completed.
                </div>
              )}

              <div className="space-y-1 select-none text-left">
                <p className="text-[11px] text-slate-400 font-mono">ID: {prioritySettingJob.id}</p>
                <p className={`text-xs font-bold leading-none ${isCompletedJob ? 'text-slate-500' : 'text-white'}`}>Customer: {prioritySettingJob.customerName}</p>
                <p className="text-[11px] text-slate-400">
                  {isCompletedJob 
                    ? "Completed tickets have a permanent priority level of 'None'."
                    : "Adjust this ticket's custom queue position. Priority #1 is served first. If unset, sorting falls back to appointment time."}
                </p>
              </div>

              <div className={`space-y-2 ${isCompletedJob ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <label htmlFor="priority-input-num" className="text-xs font-bold text-slate-300 block">
                  Assign Position / Level (Priority Level)
                </label>
                
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    id="priority-input-num"
                    placeholder="e.g. 1"
                    value={priorityInputValue}
                    disabled={isCompletedJob}
                    onChange={(e) => setPriorityInputValue(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 font-sans"
                  />
                </div>

                {/* Quick Choice Buttons for rapid queue setting */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isCompletedJob}
                      onClick={() => setPriorityInputValue(String(num))}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition-all ${
                        priorityInputValue === String(num)
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300'
                      }`}
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPriorityInputValue('');
                    // Instantly save
                    if (onUpdateJobPriority) {
                      onUpdateJobPriority(prioritySettingJob.id, undefined);
                    }
                    setPrioritySettingJob(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                    (!prioritySettingJob.priorityNumber && !priorityInputValue) || isCompletedJob
                      ? 'border-white/5 bg-slate-900/50 text-slate-500 cursor-not-allowed pointer-events-none'
                      : 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  }`}
                  disabled={(!prioritySettingJob.priorityNumber && !priorityInputValue) || isCompletedJob}
                >
                  Clear Priority
                </button>
                
                <button
                  type="button"
                  onClick={handleSavePriority}
                  disabled={isCompletedJob}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-bold cursor-pointer transition-all text-center ${
                    isCompletedJob 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none'
                      : 'bg-teal-600 text-white hover:bg-teal-700 border border-teal-500/20 active:scale-95'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PERSISTENT DELETE REASON CONFIRMATION MODAL OVERLAY */}
      {isDeleteConfirmOpen && selectedJob && (
        <div
          className="fixed inset-0 bg-slate-955/80 backdrop-blur-md flex items-start justify-center p-4 pt-10 sm:pt-4 z-55 animate-fade-in sm:items-center overflow-y-auto"
          id="delete-confirmation-backdrop"
          onClick={() => setIsDeleteConfirmOpen(false)}
        >
          <div
            className="bg-[#050e12]/95 backdrop-blur-xl rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-rose-500/25 p-6 space-y-4 text-left text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="font-extrabold text-sm text-rose-400 flex items-center gap-1.5 font-sans">
                ⚠️ Confirm Ticket Deletion
              </h3>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 bg-rose-950/20 p-3 rounded-xl border border-rose-500/20">
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded font-mono border border-rose-500/15">
                {selectedJob.id}
              </span>
              <p className="text-xs font-bold text-white mt-1">Customer: {selectedJob.customerName}</p>
              <p className="text-[11px] text-slate-350">
                Are you sure you want to delete this service ticket record? This will archive the ticket information and store the deletion reason in logs permanently.
              </p>
            </div>

            <div className="space-y-2.5">
              <label htmlFor="delete-reason-input" className="text-xs font-bold text-slate-300 block">
                Reason for deletion <span className="text-rose-400">*</span>
              </label>

              {/* Quick Choice Reason selection buttons */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                {[
                  'Customer cancelled request',
                  'Incorrect ticket entry / Duplicate entry',
                  'Out of service coverage / Technical limit',
                  'Hardware unfixable / Sourcing too expensive'
                ].map((reasonOption) => {
                  const isSelected = deleteReasonText === reasonOption;
                  return (
                    <button
                      key={reasonOption}
                      type="button"
                      onClick={() => setDeleteReasonText(reasonOption)}
                      className={`text-[11px] text-left px-3 py-2 rounded-xl transition-all border font-medium ${
                        isSelected
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {reasonOption}
                    </button>
                  );
                })}
              </div>

              {/* Custom manual entry text box */}
              <input
                type="text"
                id="delete-reason-input"
                placeholder="Or type another custom reason here..."
                value={deleteReasonText}
                onChange={(e) => setDeleteReasonText(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans mt-2 placeholder-slate-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-2 text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-center text-slate-300 cursor-pointer transition-all"
              >
                Back to Details
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const finalReason = deleteReasonText.trim();
                  if (!finalReason) {
                    alert('Please select or specify a delete reason first.');
                    return;
                  }
                  if (onDeleteJob) {
                    onDeleteJob(selectedJob.id, finalReason);
                  }
                  setIsDeleteConfirmOpen(false);
                  setIsModalOpen(false); // Close parent details modal too
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 text-xs font-bold cursor-pointer transition-all text-center border border-rose-500/20"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL OVERLAY PORTAL */}
      {isEditFormOpen && selectedJob && (
        <div
          className="fixed inset-0 bg-slate-955/80 backdrop-blur-md flex items-start justify-center p-4 pt-4 sm:pt-4 z-55 animate-fade-in sm:items-center overflow-y-auto"
          id="edit-details-modal-overlay"
          onClick={() => setIsEditFormOpen(false)}
        >
          <div
            className="ios-glass-dark rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-white/10 p-6 space-y-4 my-2 sm:my-8 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold px-2.5 py-0.5 rounded font-mono">
                  ✏️ EDITING
                </span>
                <h3 className="font-extrabold text-sm text-white font-sans">
                  Ticket #{selectedJob.id} Details Modification
                </h3>
              </div>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                onClick={() => setIsEditFormOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto pr-1">
              <JobForm
                initialData={selectedJob}
                isEditMode={true}
                onSubmit={(updatedFields) => {
                  if (onEditJob) {
                    onEditJob(selectedJob.id, updatedFields);
                  }
                  setIsEditFormOpen(false);
                  setIsModalOpen(false); // Close parent details modal too
                }}
                onCancel={() => setIsEditFormOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

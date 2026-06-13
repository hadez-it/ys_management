import React, { useState } from 'react';
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
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [mobileView, setMobileView] = useState<'list' | 'details'>('list');
  
  const [tempRemark, setTempRemark] = useState('');

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
    const matchesSearch =
      job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerPhone.includes(searchQuery) ||
      (job.deviceModel || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'All' || job.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const getStatusBadge = (status: JobStatus) => {
    const map = {
      Created: 'bg-blue-50 text-blue-700 border-blue-100',
      Assigned: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      Dispatched: 'bg-violet-50 text-violet-700 border-violet-100',
      ServiceInProgress: 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse',
      Repairing: 'bg-orange-50 text-orange-700 border-orange-100 animate-pulse',
      Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      Cancelled: 'bg-red-50 text-red-700 border-red-100',
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[status] || 'bg-gray-50'}`}>
        {status === 'ServiceInProgress' ? '🛠️ Servicing' : status === 'Dispatched' ? '🛵 En Route' : status === 'Repairing' ? '🔧 Repairing' : status}
      </span>
    );
  };

  const getUrgencyBadge = (urgency: UrgencyLevel) => {
    const map = {
      Low: 'bg-gray-100 text-gray-700',
      Medium: 'bg-blue-50 text-blue-700 border border-blue-100',
      High: 'bg-amber-50 text-amber-700 border border-amber-100',
      Critical: 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse',
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${map[urgency] || 'bg-gray-50'}`}>
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
      const jobDate = new Date(job.dateTime);
      
      const todayYear = now.getFullYear();
      const todayMonth = now.getMonth();
      const todayDate = now.getDate();
      
      const midnightToday = new Date(todayYear, todayMonth, todayDate);
      const midnightTomorrow = new Date(todayYear, todayMonth, todayDate + 1);
      const midnightDayAfterTomorrow = new Date(todayYear, todayMonth, todayDate + 2);
      
      if (jobDate < midnightToday) {
        return 'Overdue';
      } else if (jobDate >= midnightToday && jobDate < midnightTomorrow) {
        return 'Today';
      } else if (jobDate >= midnightTomorrow && jobDate < midnightDayAfterTomorrow) {
        return 'Tomorrow';
      } else {
        return 'Upcoming';
      }
    } catch {
      return 'Upcoming';
    }
  };

  // Pre-fill input details if the job changes
  React.useEffect(() => {
    if (selectedJob) {
      setDiagnosedProblem(selectedJob.diagnosedProblem || '');
      setResolutionNotes(selectedJob.resolutionNotes || '');
      setShowWorkflow(false);
    }
  }, [selectedJobId, selectedJob]);

  // Grouped filtered jobs
  const overdueJobs = filteredJobs.filter(j => getJobCategory(j) === 'Overdue').sort(sortJobsInQueue);
  const todayJobs = filteredJobs.filter(j => getJobCategory(j) === 'Today').sort(sortJobsInQueue);
  const tomorrowJobs = filteredJobs.filter(j => getJobCategory(j) === 'Tomorrow').sort(sortJobsInQueue);
  const upcomingJobs = filteredJobs.filter(j => getJobCategory(j) === 'Upcoming').sort(sortJobsInQueue);
  const archiveJobs = filteredJobs.filter(j => getJobCategory(j) === 'Archive').sort(sortJobsInQueue);

  const renderJobCard = (job: ServiceJob) => {
    const isSelected = job.id === selectedJobId && isModalOpen;
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
        className={`p-4 border rounded-xl cursor-pointer text-left transition-all duration-200 relative overflow-hidden group select-none ${
          isSelected
            ? 'border-blue-500 bg-blue-50/20 shadow-xs'
            : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
        }`}
      >
        {/* Active marker left border */}
        {isSelected && (
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-600" />
        )}

        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold font-mono tracking-wider text-gray-400">
              {job.id}
            </span>
            {job.status === 'Completed' ? (
              <span className="text-[10px] font-bold font-sans bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200/60 select-none">
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

        <div className="mt-1.5">
          <h4 className="text-xs font-bold text-gray-955 tracking-tight group-hover:text-blue-700 transition-colors">
            {job.customerName}
          </h4>
          <p className="text-[11px] text-gray-500 font-sans mt-0.5 flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 inline text-gray-400" /> {job.customerPhone}
          </p>
        </div>

        <div className="mt-2 text-xs bg-gray-50 p-2 rounded-lg text-gray-600 line-clamp-2 leading-relaxed flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
          <span>{job.locationText}</span>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-gray-100/50 pt-2 text-[10px] text-gray-400">
          <div className="flex items-center gap-1 font-medium text-gray-500">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" /> {formatDateTime(job.dateTime)}
          </div>
          {getStatusBadge(job.status)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6" id="job-management-viewport">
      {/* Search Header Container (Full Width) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              id="job-list-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or ticket..."
              className="w-full bg-gray-50 border border-gray-100 pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-sans"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 items-center text-[11px] shrink-0">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
              <span className="text-gray-500 font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none py-0 px-1 text-gray-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="All">All Projects</option>
                <option value="Created">Created</option>
                <option value="Dispatched">Dispatched</option>
                <option value="ServiceInProgress">Servicing</option>
                <option value="Repairing">Repairing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
              <span className="text-gray-500 font-semibold">Urgency:</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="bg-transparent border-none py-0 px-1 text-gray-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="All">All Urgencies</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Categories divided full-width list */}
      <div className="space-y-6" id="job-cards-list">
        {filteredJobs.length === 0 ? (
          <div className="bg-white border border-gray-100 p-16 text-center rounded-2xl shadow-xs" id="no-jobs-visual">
            <Clock className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-500 mt-3.5">No Service Jobs Found</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
              We couldn't find any queues matching your status or search keywords. Try adjusting your filter parameters above.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Overdue Section */}
            {overdueJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1.5 select-none bg-rose-50 border border-rose-100/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Overdue</span>
                  </div>
                  <span className="text-[10px] bg-rose-200/50 text-rose-800 font-bold px-2 py-0.5 rounded-lg">
                    {overdueJobs.length} ticket{overdueJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {overdueJobs.map((job) => renderJobCard(job))}
                </div>
              </div>
            )}

            {/* 2. Today Section */}
            {todayJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1.5 select-none bg-blue-50 border border-blue-100/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Today</span>
                  </div>
                  <span className="text-[10px] bg-blue-200/50 text-blue-800 font-bold px-2 py-0.5 rounded-lg">
                    {todayJobs.length} ticket{todayJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayJobs.map((job) => renderJobCard(job))}
                </div>
              </div>
            )}

            {/* 3. Tomorrow Section */}
            {tomorrowJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1.5 select-none bg-amber-55/10 border border-amber-100/40 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Tomorrow</span>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-850 font-bold px-2 py-0.5 rounded-lg">
                    {tomorrowJobs.length} ticket{tomorrowJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tomorrowJobs.map((job) => renderJobCard(job))}
                </div>
              </div>
            )}

            {/* 4. Upcoming / Later Section */}
            {upcomingJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1.5 select-none bg-slate-50 border border-slate-150 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Upcoming Tasks</span>
                  </div>
                  <span className="text-[10px] bg-slate-200/60 text-slate-700 font-bold px-2 py-0.5 rounded-lg">
                    {upcomingJobs.length} ticket{upcomingJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingJobs.map((job) => renderJobCard(job))}
                </div>
              </div>
            )}

            {/* 5. Closed Archive Section */}
            {archiveJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1.5 select-none bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed / Closed Archive</span>
                  </div>
                  <span className="text-[10px] bg-gray-200/60 text-gray-600 font-medium px-2 py-0.5 rounded-lg">
                    {archiveJobs.length} ticket{archiveJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                  {archiveJobs.map((job) => renderJobCard(job))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JOBS DETAILS MODAL OVERLAY (POPUP) */}
      {isModalOpen && selectedJob && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 pt-4 sm:pt-4 z-50 animate-fade-in sm:items-center overflow-y-auto"
          id="job-detail-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[96vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-gray-100"
            id="job-detail-modal-card"
            onClick={(e) => e.stopPropagation()} // Prevent closing on clicking card surface
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 sticky top-0 bg-white z-25 shadow-[0_1px_10px_rgba(0,0,0,0.01)]">
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight text-blue-600 bg-blue-50 px-2 py-0.5 sm:px-2.5 sm:rounded-md rounded">
                    {selectedJob.id}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-gray-400">Created {formatDateTime(selectedJob.createdAt)}</span>
                </div>
                <div className="mt-1.5 text-left">
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-950 font-sans tracking-tight leading-snug break-words">
                    {selectedJob.customerName} : <span className="font-mono text-gray-700 font-bold select-text">{selectedJob.customerPhone}</span>
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
                    className="p-1 sm:p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-amber-100/50"
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
                    className="p-1 sm:p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-rose-100/50"
                    title="Delete Ticket"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}

                {/* CLOSE WINDOW BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
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
                <div className="p-3 sm:p-5 bg-gradient-to-br from-blue-50/40 to-indigo-50/40 border border-blue-100/60 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3.5 text-left shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider border-b border-blue-100/50 pb-1.5 sm:pb-2 flex items-center gap-2 select-none font-sans">
                    <UserIcon className="h-4 w-4 text-blue-500" /> Customer Information
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between gap-2 bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-blue-100/30">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block uppercase tracking-wider leading-none mb-1 select-none">Phone Number</span>
                        <strong className="text-gray-950 font-mono text-xs sm:text-base tracking-tight select-text">{selectedJob.customerPhone}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(selectedJob.customerPhone);
                          alert('Copied phone number!');
                        }}
                        className="text-[9px] sm:text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-2 sm:px-2.5 py-1 rounded transition-colors cursor-pointer select-none"
                      >
                        Copy
                      </button>
                    </div>
                    
                    <div className="bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-blue-100/30">
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block uppercase tracking-wider leading-none mb-1 select-none">Service Address</span>
                      <p className="text-gray-900 font-medium text-xs sm:text-sm leading-relaxed break-words select-text">{selectedJob.locationText}</p>
                    </div>
                  </div>
                </div>

                {/* Device Hardware Info Card */}
                <div className="p-3 sm:p-5 bg-gradient-to-br from-indigo-50/40 to-purple-50/40 border border-indigo-100/60 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3.5 text-left shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider border-b border-indigo-100/50 pb-1.5 sm:pb-2 flex items-center gap-2 select-none font-sans">
                    <Cpu className="h-4 w-4 text-indigo-500" /> Service Ticket Data
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-100/30 flex justify-between items-center gap-2">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block uppercase tracking-wider leading-none mb-1 select-none">Item Type</span>
                        <strong className="text-gray-900 text-xs sm:text-sm">{selectedJob.deviceType}</strong>
                      </div>
                    </div>
                    {selectedJob.deviceModel && (
                      <div className="bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-100/30">
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block uppercase tracking-wider leading-none mb-1 select-none">Model / Hardware Ref</span>
                        <strong className="text-gray-900 text-xs sm:text-sm select-text">{selectedJob.deviceModel}</strong>
                      </div>
                    )}
                    <div className="bg-white/70 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-100/30">
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 block uppercase tracking-wider leading-none mb-1 select-none">Scheduled Appointment</span>
                      <strong className="text-indigo-900 text-xs sm:text-sm select-text">{formatDateTime(selectedJob.dateTime)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hardware Problem Diagnostic description */}
              <div className="p-4 bg-rose-50/20 border border-rose-100/50 rounded-xl text-left">
                <h4 className="text-xs font-semibold text-rose-800 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Device Problem Description
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  {selectedJob.deviceIssue}
                </p>
              </div>

              {/* Dynamic remarks tracking details */}
              <div className="p-4 bg-amber-50/20 border border-amber-100/50 rounded-xl text-left space-y-1.5">
                <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-2">
                  <AlertOctagon className="h-3.5 w-3.5 text-amber-500" /> Communication Remarks
                </h4>
                {selectedJob.remarks ? (
                  <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white p-2.5 rounded-lg border border-amber-100/40 max-h-[140px] overflow-y-auto">
                    {selectedJob.remarks}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No notes or remarks logged yet.</p>
                )}
              </div>

              {/* Audit trail / Edit Logs history */}
              {selectedJob.editHistory && selectedJob.editHistory.length > 0 && (
                <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl text-left space-y-2 animate-fade-in" id="ticket-edit-history-logs">
                  <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 select-none font-sans">
                    <Edit className="h-3.5 w-3.5 text-amber-500" /> Ticket Edit History & Audit Logs
                  </h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {selectedJob.editHistory.map((log, idx) => {
                      const logDateStr = log.editedAt ? new Date(log.editedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-';
                      return (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-100 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[10px] text-gray-400 font-mono">
                              {logDateStr}
                            </span>
                            {log.changedFields && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-100">
                                Changed: {log.changedFields}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-700 leading-relaxed font-medium">
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
                <div className="p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-xl text-left space-y-1.5">
                  <h4 className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Diagnostic Summary & Resolution Notes
                  </h4>
                  <div className="text-xs space-y-1 text-gray-700">
                    <p>
                      <strong className="text-gray-800">Diagnosed Fault finding:</strong> {selectedJob.diagnosedProblem || 'N/A'}
                    </p>
                    <p>
                      <strong className="text-gray-800">Resolution solution:</strong> {selectedJob.resolutionNotes || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* WORKFLOW CONTROLS SECTION */}
            {selectedJob.status !== 'Completed' && selectedJob.status !== 'Cancelled' ? (
              // Active ticket: toggleable workflow
              !showWorkflow ? (
                <div className="p-4 bg-slate-50 border-t border-gray-100 text-center shrink-0 sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row gap-3">
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
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95"
                    >
                      <Wrench className="h-4 w-4 shrink-0 animate-spin" />
                      Start Repairing
                    </button>
                  )}
                  <button
                    type="button"
                    id="btn-show-workflow"
                    onClick={() => setShowWorkflow(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all cursor-pointer hover:shadow-md active:scale-95"
                  >
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {selectedJob.status === 'Repairing' ? 'Complete Repair Work' : 'Mark Repair Completed'}
                  </button>
                </div>
              ) : (
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-gray-100 text-left shrink-0 space-y-3.5 animate-scale-up sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] max-h-[48vh] overflow-y-auto">
                  <div className="flex items-center justify-end border-b border-gray-200 pb-2">
                    <button
                      type="button"
                      onClick={() => setShowWorkflow(false)}
                      className="text-[10px] font-bold text-gray-500 hover:text-gray-800 bg-gray-200/60 hover:bg-gray-205 px-2.5 py-1 rounded-md transition-colors cursor-pointer select-none"
                    >
                      ▲ Hide
                    </button>
                  </div>

                  <div>
                    {/* Only 1 workflow: complete status mark */}
                    <div className="space-y-3 p-3 bg-white border border-gray-200 rounded-xl" id="state-widget-servicing">
                      <p className="text-xs text-gray-500 mb-1 font-semibold">
                        Enter Repair Information (Diagnosed finding and action done):
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Diagnosed Fault Findings</label>
                          <input
                            type="text"
                            id="problem-findings-input"
                            placeholder="e.g. Broken motherboard chip..."
                            value={diagnosedProblem}
                            onChange={(e) => setDiagnosedProblem(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 py-1.5 px-3 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-550"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Resolution / Action Done</label>
                          <input
                            type="text"
                            id="resolution-findings-input"
                            placeholder="e.g. Resoldered logic module..."
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 py-1.5 px-3 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-550"
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
                          className="inline-flex items-center gap-1.5 py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition-all text-xs shadow-xs"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Log Repair Completed
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* COMMUNICATORS & UNREACHABLE DISPATCH PRESET ACTIONS */}
                  <div className="border-t border-gray-200/60 pt-3 space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wilder block select-none">
                      Log Remarks / Customer Unreachable Actions
                    </label>
                    
                    {/* Preset responses */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const datePrefix = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
                          const text = `[${datePrefix} ${timestamp}] Unreachable: Busy / No Answer`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold py-1 px-2.5 rounded-lg border border-amber-200/20 cursor-pointer transition-all"
                      >
                        📞 Busy / No Answer
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const datePrefix = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
                          const text = `[${datePrefix} ${timestamp}] Unreachable: Switched Off`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold py-1 px-2.5 rounded-lg border border-amber-200/20 cursor-pointer transition-all"
                      >
                        📴 Switched Off
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const datePrefix = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
                          const text = `[${datePrefix} ${timestamp}] Site Unreachable: Customer Closed / Away`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                        }}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-1 px-2.5 rounded-lg border border-slate-200/40 cursor-pointer transition-all"
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
                        className="flex-1 bg-white border border-gray-250 text-xs py-1.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempRemark.trim()) return;
                          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const datePrefix = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
                          const text = `[${datePrefix} ${timestamp}] ${tempRemark.trim()}`;
                          const updatedRemarks = selectedJob.remarks ? `${selectedJob.remarks}\n${text}` : text;
                          onUpdateJobStatus(selectedJob.id, selectedJob.status, selectedJob.technicianName, selectedJob.diagnosedProblem, selectedJob.resolutionNotes, updatedRemarks);
                          setTempRemark('');
                        }}
                        className="bg-gray-800 text-white rounded-lg px-3.5 py-1 text-xs font-bold hover:bg-gray-900 cursor-pointer transition-all active:scale-95"
                      >
                        Save Remark
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              // Completed or Cancelled ticket: show billing/receipt or cancelled banner directly without toggles
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-gray-100 text-left shrink-0 space-y-3 sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                {/* Case 5: Completed with invoice wizard pending */}
                {selectedJob.status === 'Completed' && !selectedJob.invoiceId && (
                  <div className="space-y-2 bg-blue-50/40 p-3 rounded-xl border border-blue-100" id="state-widget-invoice-ready">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-800 font-semibold">
                          Repair Complete! Billing Outstanding
                        </p>
                        <p className="text-[11px] text-gray-550 mt-0.5">
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
                          className="inline-flex items-center justify-center gap-1 py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all shrink-0 active:scale-95"
                        >
                          <FileText className="h-3.5 w-3.5" /> File Invoice
                        </button>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-200/60 font-semibold select-none shrink-0">
                          Billing Pending
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Case 6: Completed and invoiced */}
                {selectedJob.status === 'Completed' && selectedJob.invoiceId && (
                  <div className="space-y-2 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100" id="state-widget-invoiced">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1 leading-none">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Invoice Settled
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono mt-1">
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
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 border border-gray-200 text-blue-600 text-xs font-semibold rounded-lg hover:bg-white cursor-pointer bg-white active:scale-95"
                      >
                        <FileText className="h-3.5 w-3.5" /> View Receipt
                      </button>
                    </div>
                  </div>
                )}

                {/* Case 7: Cancelled */}
                {selectedJob.status === 'Cancelled' && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs flex items-center gap-2" id="state-widget-cancelled">
                    <AlertCircle className="h-4 w-4 shrink-0" />
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
              className={`bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-gray-100 p-6 space-y-4 text-left ${
                isCompletedJob ? 'border-gray-200 bg-slate-50' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className={`font-extrabold text-sm flex items-center gap-1.5 font-sans ${isCompletedJob ? 'text-slate-500' : 'text-gray-900'}`}>
                  ⭐ Edit Priority Index
                </h3>
                <button
                  type="button"
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => setPrioritySettingJob(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isCompletedJob && (
                <div className="bg-slate-200/60 border border-slate-300/40 text-slate-600 text-[11px] p-3 rounded-xl font-medium leading-relaxed font-sans select-none">
                  🚫 Priority queue controls are locked because this ticket has already been completed.
                </div>
              )}

              <div className="space-y-1 select-none text-left">
                <p className="text-[11px] text-gray-400 font-mono">ID: {prioritySettingJob.id}</p>
                <p className={`text-xs font-bold leading-none ${isCompletedJob ? 'text-slate-600' : 'text-gray-800'}`}>Customer: {prioritySettingJob.customerName}</p>
                <p className="text-[11px] text-gray-500">
                  {isCompletedJob 
                    ? "Completed tickets have a permanent priority level of 'None'."
                    : "Adjust this ticket's custom queue position. Priority #1 is served first. If unset, sorting falls back to appointment time."}
                </p>
              </div>

              <div className={`space-y-2 ${isCompletedJob ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <label htmlFor="priority-input-num" className="text-xs font-bold text-gray-700 block">
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
                    className="w-full bg-gray-50 border border-gray-150 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
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
                          : 'bg-gray-50 hover:bg-gray-150 border-gray-100 text-gray-700'
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
                      ? 'border-gray-100 bg-gray-50/50 text-gray-300 cursor-not-allowed pointer-events-none'
                      : 'border-red-100 bg-red-50 text-red-700 hover:bg-red-100'
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
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none'
                      : 'bg-gray-900 text-white hover:bg-black active:scale-95'
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
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 pt-10 sm:pt-4 z-55 animate-fade-in sm:items-center overflow-y-auto"
          id="delete-confirmation-backdrop"
          onClick={() => setIsDeleteConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-rose-100 p-6 space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-rose-50 pb-2">
              <h3 className="font-extrabold text-sm text-rose-600 flex items-center gap-1.5 font-sans">
                ⚠️ Confirm Ticket Deletion
              </h3>
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 bg-rose-50/50 p-3 rounded-xl border border-rose-100/30">
              <span className="text-[10px] bg-rose-100 text-rose-805 font-bold px-2 py-0.5 rounded font-mono">
                {selectedJob.id}
              </span>
              <p className="text-xs font-bold text-gray-800 mt-1">Customer: {selectedJob.customerName}</p>
              <p className="text-[11px] text-gray-500">
                Are you sure you want to delete this service ticket record? This will archive the ticket information and store the deletion reason in logs permanently.
              </p>
            </div>

            <div className="space-y-2.5">
              <label htmlFor="delete-reason-input" className="text-xs font-bold text-gray-700 block">
                Reason for deletion <span className="text-rose-500">*</span>
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
                          ? 'bg-rose-50 border-rose-400 text-rose-800 font-semibold'
                          : 'bg-gray-50/50 border-gray-100 hover:bg-gray-50 text-gray-700'
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
                className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans mt-2"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-2 text-xs font-bold border border-gray-150 bg-white hover:bg-gray-50 rounded-xl text-center text-gray-700 cursor-pointer transition-all"
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
                className="flex-1 bg-rose-600 text-white hover:bg-rose-700 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all text-center"
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
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-start justify-center p-4 pt-4 sm:pt-4 z-55 animate-fade-in sm:items-center overflow-y-auto"
          id="edit-details-modal-overlay"
          onClick={() => setIsEditFormOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col shadow-2xl relative animate-scale-up border border-amber-100 p-6 space-y-4 my-2 sm:my-8 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-150 text-amber-900 border border-amber-200 font-bold px-2.5 py-0.5 rounded font-mono">
                  ✏️ EDITING
                </span>
                <h3 className="font-extrabold text-sm text-gray-900 font-sans">
                  Ticket #{selectedJob.id} Details Modification
                </h3>
              </div>
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
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

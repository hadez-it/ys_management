import React from 'react';
import {
  Wrench,
  TrendingUp,
  Clock,
  Inbox,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { ServiceJob, Invoice } from '../types.ts';
import { formatMMK } from '../utils.ts';

interface DashboardStatsProps {
  jobs: ServiceJob[];
  invoices: Invoice[];
  onSelectedStatusFilter: (status: string) => void;
}

export default function DashboardStats({ jobs, invoices, onSelectedStatusFilter }: DashboardStatsProps) {
  // Helper to determine job category
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

  const totalCount = jobs.length;
  const overdueCount = jobs.filter((j) => getJobCategory(j) === 'Overdue').length;
  const upcomingCount = jobs.filter((j) => j.status === 'Created' || j.status === 'Assigned' || j.status === 'Dispatched').length;
  const repairingCount = jobs.filter((j) => j.status === 'Repairing' || j.status === 'ServiceInProgress').length;
  const completedCount = jobs.filter((j) => j.status === 'Completed').length;
  
  const totalRevenue = invoices
    .filter((inv) => inv.paymentStatus === 'Paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const kpis = [
    {
      title: 'Total Tickets',
      value: totalCount,
      desc: 'All recorded tickets',
      icon: Inbox,
      filter: 'All',
      color: 'hover:border-slate-400 focus:bg-slate-50',
      badgeColor: 'bg-slate-100 text-slate-700'
    },
    {
      title: 'Overdue',
      value: overdueCount,
      desc: 'Past appointments',
      icon: Clock,
      filter: 'Overdue',
      color: 'hover:border-rose-400 focus:bg-rose-50/10',
      badgeColor: 'bg-rose-50 text-rose-900',
      isCritical: overdueCount > 0
    },
    {
      title: 'Upcoming',
      value: upcomingCount,
      desc: 'Scheduled tickets',
      icon: Calendar,
      filter: 'Upcoming',
      color: 'hover:border-blue-400 focus:bg-blue-50/10',
      badgeColor: 'bg-blue-50 text-blue-900'
    },
    {
      title: 'Repairing',
      value: repairingCount,
      desc: 'In progress / shop floor',
      icon: Wrench,
      filter: 'Repairing',
      color: 'hover:border-amber-400 focus:bg-amber-50/10',
      badgeColor: 'bg-amber-50 text-amber-900'
    },
    {
      title: 'Completed',
      value: completedCount,
      desc: 'Fully serviced',
      icon: CheckCircle,
      filter: 'Completed',
      color: 'hover:border-emerald-400 focus:bg-emerald-50/10',
      badgeColor: 'bg-emerald-50 text-emerald-900'
    },
    {
      title: 'Total Settlements',
      value: formatMMK(totalRevenue),
      desc: 'Payments received',
      icon: TrendingUp,
      filter: 'Completed',
      color: 'hover:border-teal-400 focus:bg-teal-50/10',
      badgeColor: 'bg-teal-50 text-teal-850'
    },
  ];

  return (
    <div className="space-y-4 text-left" id="dashboard-statistics">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
        {kpis.map((kpi, idx) => {
          const IconComponent = kpi.icon;
          const isSettlements = kpi.title === 'Total Settlements';
          return (
            <div
              key={idx}
              id={`kpi-card-${idx}`}
              onClick={() => onSelectedStatusFilter(kpi.filter)}
              className={`ios-glass-card ios-glass-card-hover p-4 md:p-5 rounded-3xl cursor-pointer group relative overflow-hidden select-none flex flex-col justify-between h-36 md:h-40 transition-all duration-300 ${
                kpi.isCritical ? 'border-rose-500/30 shadow-[0_0_15px_rgba(239,68,68,0.12)] bg-rose-500/5' : ''
              } ${isSettlements ? 'col-span-2 md:col-span-1' : ''}`}
            >
              {/* Top ambient color reflection */}
              <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent ${kpi.isCritical ? 'via-rose-500/20' : 'via-white/10'} to-transparent`} />
              
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    {kpi.title}
                  </p>
                  <p className={`font-black tracking-tight font-display ${isSettlements ? 'text-xl lg:text-2xl text-teal-300' : 'text-2xl lg:text-3xl text-white'}`}>
                    {kpi.value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-2xl shrink-0 bg-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300 ${kpi.isCritical ? 'text-rose-400' : 'text-teal-300'}`}>
                  <IconComponent className={`h-5 w-5 ${kpi.isCritical ? 'text-rose-400' : 'text-teal-400'}`} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                <span className={`h-2 w-2 rounded-full ${kpi.isCritical ? 'bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]' : 'bg-teal-500 animate-pulse'}`} />
                <p className="text-[11px] text-slate-400 font-semibold tracking-wide">
                  {kpi.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

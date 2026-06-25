import React from 'react';
import {
  Wrench,
  TrendingUp,
  Clock,
  Inbox
} from 'lucide-react';
import { ServiceJob, Invoice } from '../types.ts';
import { formatMMK } from '../utils.ts';

interface DashboardStatsProps {
  jobs: ServiceJob[];
  invoices: Invoice[];
  onSelectedStatusFilter: (status: string) => void;
}

export default function DashboardStats({ jobs, invoices, onSelectedStatusFilter }: DashboardStatsProps) {
  const totalJobsCount = jobs.length;
  const dispatchingCount = jobs.filter((j) => j.status === 'Dispatched').length;
  const activeRepairCount = jobs.filter((j) => j.status === 'ServiceInProgress' || j.status === 'Repairing').length;
  const completedJobsCount = jobs.filter((j) => j.status === 'Completed').length;
  
  const totalRevenue = invoices
    .filter((inv) => inv.paymentStatus === 'Paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const kpis = [
    {
      title: 'Active Cases',
      value: totalJobsCount,
      desc: `${completedJobsCount} completed`,
      icon: Inbox,
      filter: 'All',
      color: 'hover:border-slate-400 focus:bg-slate-50',
      badgeColor: 'bg-slate-100 text-slate-700'
    },
    {
      title: 'Active Servicing',
      value: activeRepairCount,
      desc: 'Repairs in progress',
      icon: Wrench,
      filter: 'ServiceInProgress',
      color: 'hover:border-amber-400 focus:bg-amber-50/10',
      badgeColor: 'bg-amber-50 text-amber-900'
    },
    {
      title: 'Total Settlements',
      value: formatMMK(totalRevenue),
      desc: 'Payments received',
      icon: TrendingUp,
      filter: 'Completed',
      color: 'hover:border-emerald-400 focus:bg-emerald-50/10',
      badgeColor: 'bg-emerald-50 text-emerald-800'
    },
  ];

  return (
    <div className="space-y-4 text-left" id="dashboard-statistics">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {kpis.map((kpi, idx) => {
          const IconComponent = kpi.icon;
          return (
            <div
              key={idx}
              id={`kpi-card-${idx}`}
              onClick={() => onSelectedStatusFilter(kpi.filter)}
              className="ios-glass-card ios-glass-card-hover p-6 rounded-3xl cursor-pointer group relative overflow-hidden select-none flex flex-col justify-between h-40"
            >
              {/* Top ambient color reflection */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    {kpi.title}
                  </p>
                  <p className="text-2xl lg:text-3xl font-black text-white tracking-tight font-display">
                    {kpi.value}
                  </p>
                </div>
                <div className="p-3 rounded-2xl shrink-0 bg-white/5 border border-white/10 text-teal-300 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <IconComponent className="h-5 w-5 text-teal-400" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
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

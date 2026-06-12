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
      title: 'Dispatch Status',
      value: dispatchingCount,
      desc: 'Technicians en route',
      icon: Clock,
      filter: 'Dispatched',
      color: 'hover:border-blue-400 focus:bg-blue-50/10',
      badgeColor: 'bg-blue-50 text-blue-700'
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const IconComponent = kpi.icon;
          return (
            <div
              key={idx}
              id={`kpi-card-${idx}`}
              onClick={() => onSelectedStatusFilter(kpi.filter)}
              className={`bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between cursor-pointer group relative overflow-hidden select-none ${kpi.color}`}
            >
              <div className="flex justify-between items-start gap-2.5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450">
                    {kpi.title}
                  </p>
                  <p className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight font-display">
                    {kpi.value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl shrink-0 ${kpi.badgeColor} transition-transform group-hover:scale-105`}>
                  <IconComponent className="h-4.5 w-4.5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 font-semibold tracking-wide flex items-center gap-1">
                <span>•</span> {kpi.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

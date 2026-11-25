import React from 'react';
import { ProjectSummary } from '../../types';
import { formatCurrency } from '../../shared/calculations';

interface ProjectSummaryCardProps {
  summary: ProjectSummary;
}

export function ProjectSummaryCard({ summary }: ProjectSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          {/* Total Project Cost */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Total Project Cost
            </span>
            <span className="text-base sm:text-xl font-bold text-slate-900 tabular-nums block">
              {formatCurrency(summary.totalProjectCost)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {summary.materialReturns && summary.materialReturns > 0
                ? `Net after ${formatCurrency(summary.materialReturns)} returns`
                : 'Materials + Other + Contractor Paid'}
            </span>
          </div>

          {/* Outstanding Amount */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
              Outstanding Amount
            </span>
            <span
              className={`text-base sm:text-xl font-bold tabular-nums block ${
                summary.outstanding > 0 ? 'text-amber-900' : 'text-slate-700'
              }`}
            >
              {formatCurrency(summary.outstanding)}
            </span>
            <span className="text-[10px] text-amber-700 block mt-0.5">
              Unpaid contractor contracts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Contractor } from '../../types';
import { formatCurrency } from '../../shared/calculations';
import { Users, Phone, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ContractorCardProps {
  key?: React.Key;
  contractor: Contractor;
  onClick: () => void;
}

export function ContractorCard({ contractor, onClick }: ContractorCardProps) {
  const totalAmt = Number(contractor.total_contracts_amount || 0);
  const paidAmt = Number(contractor.total_paid || 0);
  const outstanding = Number(contractor.outstanding || 0);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all p-4 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base truncate">{contractor.name}</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              {contractor.type_name}
            </span>
          </div>

          {contractor.phone && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{contractor.phone}</span>
            </p>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
        <div className="p-2 bg-slate-50 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
            Total Theka
          </span>
          <span className="text-xs font-bold text-slate-900">{formatCurrency(totalAmt)}</span>
        </div>

        <div className="p-2 bg-emerald-50 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-emerald-700 block">
            Paid
          </span>
          <span className="text-xs font-bold text-emerald-800">{formatCurrency(paidAmt)}</span>
        </div>

        <div className="p-2 bg-amber-50 rounded-lg">
          <span className="text-[10px] uppercase font-semibold text-amber-700 block">
            Still Owe
          </span>
          <span
            className={`text-xs font-bold ${
              outstanding > 0 ? 'text-amber-800' : 'text-slate-600'
            }`}
          >
            {formatCurrency(outstanding)}
          </span>
        </div>
      </div>
    </div>
  );
}

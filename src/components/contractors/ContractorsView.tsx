import React, { useState } from 'react';
import { Contractor } from '../../types';
import { ContractorCard } from './ContractorCard';
import { Plus, Search, Users, AlertCircle } from 'lucide-react';

interface ContractorsViewProps {
  contractors: Contractor[];
  onSelectContractor: (contractorId: number) => void;
  onOpenNewContractor: () => void;
}

export function ContractorsView({
  contractors,
  onSelectContractor,
  onOpenNewContractor,
}: ContractorsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState<string>('All');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);

  // Extract unique trade types
  const trades = Array.from(new Set(contractors.map((c) => c.type_name).filter(Boolean)));

  const filtered = contractors.filter((c) => {
    if (tradeFilter !== 'All' && c.type_name !== tradeFilter) return false;
    if (onlyOutstanding && (c.outstanding || 0) <= 0) return false;
    if (searchTerm.trim()) {
      const matchName = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPhone = c.phone && c.phone.includes(searchTerm);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Contractors & Thekadars</h2>
          <p className="text-xs text-slate-500">
            Track agreements, payments, and global outstanding debt
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewContractor}
          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Contractor</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search contractor name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 font-medium"
          >
            <option value="All">All Trades / Specialties</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Quick toggle for Unpaid Outstanding Balance */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOutstanding}
              onChange={(e) => setOnlyOutstanding(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
            />
            <span>Show Only Contractors with Unpaid Outstanding Balance</span>
          </label>
        </div>
      </div>

      {/* Contractors List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            {contractors.length === 0
              ? 'No contractors added yet.'
              : 'No contractors match the current filter.'}
          </div>
        ) : (
          filtered.map((c) => (
            <ContractorCard key={c.id} contractor={c} onClick={() => onSelectContractor(c.id)} />
          ))
        )}
      </div>
    </div>
  );
}

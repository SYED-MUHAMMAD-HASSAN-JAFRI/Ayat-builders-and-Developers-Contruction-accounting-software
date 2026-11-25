import React, { useState, useMemo } from 'react';
import { Income } from '../../types';
import { formatCurrency } from '../../shared/calculations';
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  getTodayISO,
} from '../../shared/dates';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import {
  ArrowDownLeft,
  Calendar,
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  UserCheck,
  FileText,
  RotateCcw,
} from 'lucide-react';

interface IncomeHistorySectionProps {
  projectId: number;
  projectName: string;
  incomes: Income[];
  onOpenAddIncome: () => void;
  onEditIncome: (income: Income) => void;
  onDeleteIncome: (id: number) => Promise<void> | void;
}

export function formatDisplayDate(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

export function IncomeHistorySection({
  projectName,
  incomes,
  onOpenAddIncome,
  onEditIncome,
  onDeleteIncome,
}: IncomeHistorySectionProps) {
  const [filterType, setFilterType] = useState<'all' | 'today' | 'this_month' | 'specific'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalRecovered = useMemo(() => {
    return incomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  }, [incomes]);

  const sortedIncomes = useMemo(() => {
    return [...incomes].sort((a, b) => {
      const dateCmp = (b.income_date || '').localeCompare(a.income_date || '');
      if (dateCmp !== 0) {
        return dateCmp;
      }
      return (b.id || 0) - (a.id || 0);
    });
  }, [incomes]);

  const filteredIncomes = useMemo(() => {
    const todayStr = getTodayISO();
    const thisMonthPrefix = todayStr.slice(0, 7);

    return sortedIncomes.filter((inc) => {
      if (filterType === 'today') {
        if (inc.income_date !== todayStr) return false;
      } else if (filterType === 'this_month') {
        if (!inc.income_date.startsWith(thisMonthPrefix)) return false;
      } else if (filterType === 'specific' && filterDate) {
        if (inc.income_date !== filterDate) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSource = (inc.source_customer || '').toLowerCase().includes(q);
        const matchNotes = (inc.notes || '').toLowerCase().includes(q);
        const matchPlot = (inc.plot_name || '').toLowerCase().includes(q);
        const matchAmount = String(inc.amount).includes(q);
        if (!matchSource && !matchNotes && !matchPlot && !matchAmount) return false;
      }

      return true;
    });
  }, [sortedIncomes, filterType, filterDate, searchQuery]);

  const filteredTotal = useMemo(() => {
    return filteredIncomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
  }, [filteredIncomes]);

  const hasActiveFilters =
    filterType !== 'all' || filterDate !== '' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilterType('all');
    setFilterDate('');
    setSearchQuery('');
  };

  const handleConfirmDelete = async () => {
    if (!incomeToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteIncome(incomeToDelete.id);
      setIncomeToDelete(null);
    } catch (err) {
      console.error('Failed to delete recovery record:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Total Recovered Summary Card */}
      <div className="bg-emerald-50/60 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <ArrowDownLeft className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Recovery History — {projectName}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Date-wise ledger of all recovered amounts &amp; client receipts
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenAddIncome}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recovery</span>
          </button>
        </div>

        {/* Total Recovered KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-emerald-200/60">
          <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
              Total Recovered for Project
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-950 block mt-0.5 tabular-nums">
              {formatCurrency(totalRecovered)}
            </span>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              {incomes.length} recovery record{incomes.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
              Latest Recovery
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 block mt-0.5">
              {sortedIncomes[0] ? formatDisplayDate(sortedIncomes[0].income_date) : '—'}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block tabular-nums">
              {sortedIncomes[0] ? `+${formatCurrency(sortedIncomes[0].amount)}` : 'No transactions'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
              Filtered View Total
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums block mt-0.5">
              {formatCurrency(filteredTotal)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Showing {filteredIncomes.length} of {incomes.length}
            </span>
          </div>
        </div>
      </div>

      {/* Date & Search Filter Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Quick Date Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                setFilterDate('');
              }}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('today');
                setFilterDate('');
              }}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'today'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('this_month');
                setFilterDate('');
              }}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'this_month'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              This Month
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Specific Date & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Filter by Specific Date{filterDate ? ` (${formatDateDDMMYYYY(filterDate)})` : ''}
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                if (e.target.value) {
                  setFilterType('specific');
                } else {
                  setFilterType('all');
                }
              }}
              className="w-full py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Search Client / Notes
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search source or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-1.5 pl-8 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Records List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Recovery Records ({filteredIncomes.length})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Newest First • Total: <strong className="text-slate-900">{formatCurrency(filteredTotal)}</strong>
          </span>
        </div>

        {filteredIncomes.length === 0 ? (
          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
            <p>
              {hasActiveFilters
                ? 'No recovery records match the selected filter.'
                : 'No recovery records found for this project.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-sky-600 font-semibold hover:underline"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAddIncome}
                className="text-emerald-600 font-semibold hover:underline block mx-auto mt-2"
              >
                + Add First Recovery Record
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredIncomes.map((inc) => {
              const displayDate = formatDisplayDate(inc.income_date);

              return (
                <div
                  key={inc.id}
                  className="p-3.5 sm:p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {displayDate}
                        </span>
                        <span className="text-slate-400 text-xs font-semibold">—</span>
                        <span className="text-base sm:text-lg font-black text-emerald-700 tabular-nums">
                          +{formatCurrency(inc.amount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inc.source_customer || 'Client Recovery'}</span>
                        </span>

                        {inc.plot_name && (
                          <span className="text-[10px] font-bold text-[#082F60] bg-[#EAF2FC] border border-sky-200 px-1.5 py-0.5 rounded">
                            {inc.plot_name}
                          </span>
                        )}
                      </div>

                      {inc.notes && (
                        <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="italic">{inc.notes}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          Created:{' '}
                          {inc.created_at
                            ? formatDateTimeDDMMYYYY(inc.created_at)
                            : 'Recorded in ledger'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onEditIncome(inc)}
                        className="py-1 px-2.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Edit Recovery Record"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIncomeToDelete(inc)}
                        className="py-1 px-2.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Delete Recovery Record"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(incomeToDelete)}
        title="Delete Recovery Record?"
        message={
          incomeToDelete
            ? `Are you sure you want to delete this recovery record of ${formatCurrency(
                incomeToDelete.amount
              )} received on ${formatDisplayDate(
                incomeToDelete.income_date
              )}? Project recovery totals will update automatically.`
            : ''
        }
        confirmLabel="Yes, Delete Recovery"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setIncomeToDelete(null)}
      />
    </div>
  );
}

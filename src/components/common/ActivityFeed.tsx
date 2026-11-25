import React from 'react';
import { ActivityItem } from '../../types';
import { formatCurrency } from '../../shared/calculations';
import {
  formatDateDDMMYYYY,
  getTodayISO,
  getYesterdayISO,
} from '../../shared/dates';
import { Receipt, CreditCard, ArrowDownLeft, Calendar, RotateCcw } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityItem[];
  emptyMessage?: string;
  onEditExpense?: (id: number) => void;
  onDeleteExpense?: (id: number) => void;
  onDeletePayment?: (id: number) => void;
  onDeleteIncome?: (id: number) => void;
  onEditMaterialReturn?: (id: number) => void;
  onDeleteMaterialReturn?: (id: number) => void;
}

export function ActivityFeed({
  activities,
  emptyMessage = 'No transactions recorded yet.',
  onEditExpense,
  onDeleteExpense,
  onDeletePayment,
  onDeleteIncome,
  onEditMaterialReturn,
  onDeleteMaterialReturn,
}: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-white rounded-xl border border-slate-200">
        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  // Group activities by date
  const todayStr = getTodayISO();
  const yesterdayStr = getYesterdayISO();

  const grouped: { [key: string]: ActivityItem[] } = {};

  activities.forEach((item) => {
    let key = formatDateDDMMYYYY(item.date);
    if (item.date === todayStr) {
      key = 'TODAY';
    } else if (item.date === yesterdayStr) {
      key = 'YESTERDAY';
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateLabel, items]) => (
        <div key={dateLabel} className="space-y-2">
          {/* Section Date Header */}
          <div className="flex items-center gap-2 px-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {dateLabel}
            </span>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400 font-medium">
              {items.length} {items.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {items.map((item) => {
              const isExpense = item.type === 'expense';
              const isPayment = item.type === 'payment';
              const isIncome = item.type === 'income';
              const isReturn = item.type === 'material_return';

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors flex items-start justify-between gap-3"
                >
                  {/* Left Icon & Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isExpense
                          ? 'bg-sky-100 text-sky-700'
                          : isPayment
                          ? 'bg-emerald-100 text-emerald-700'
                          : isReturn
                          ? 'bg-[#EAF2FC] text-[#082F60]'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isExpense && <Receipt className="w-4 h-4" />}
                      {isPayment && <CreditCard className="w-4 h-4" />}
                      {isIncome && <ArrowDownLeft className="w-4 h-4" />}
                      {isReturn && <RotateCcw className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isExpense
                              ? item.category === 'Other'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                              : isPayment
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isReturn
                              ? 'bg-[#EAF2FC] text-[#082F60] border border-sky-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.subtitle}
                        </span>
                        {item.plot_name && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.plot_name}
                          </span>
                        )}
                      </div>

                      {/* Quantity & Rate info if available */}
                      {isExpense && item.quantity && item.rate && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          {item.quantity} {item.unit || 'units'} @ Rs.{' '}
                          {Number(item.rate).toLocaleString()}
                        </p>
                      )}
                      {isReturn && item.quantity != null && Number(item.quantity) > 0 && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Returned Qty: {item.quantity} {item.unit || 'units'}
                        </p>
                      )}

                      {/* Notes / Memos */}
                      {item.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 italic truncate max-w-xs sm:max-w-md">
                          "{item.notes}"
                        </p>
                      )}

                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {formatDateDDMMYYYY(item.date)}
                      </span>
                    </div>
                  </div>

                  {/* Right Amount Badge */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        isIncome
                          ? 'text-emerald-700'
                          : isReturn
                          ? 'text-[#164B8A]'
                          : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : isReturn ? '- Return ' : '- '}
                      {formatCurrency(item.calculated_amount || item.amount)}
                    </div>

                    {/* Quick delete / edit action buttons */}
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      {isExpense && onEditExpense && (
                        <button
                          type="button"
                          onClick={() => onEditExpense(item.id)}
                          className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {isExpense && onDeleteExpense && (
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(item.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                      {isReturn && onEditMaterialReturn && (
                        <button
                          type="button"
                          onClick={() => onEditMaterialReturn(item.id)}
                          className="text-[11px] text-sky-600 hover:text-sky-800 font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {isReturn && onDeleteMaterialReturn && (
                        <button
                          type="button"
                          onClick={() => onDeleteMaterialReturn(item.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                      {isPayment && onDeletePayment && (
                        <button
                          type="button"
                          onClick={() => onDeletePayment(item.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                      {isIncome && onDeleteIncome && (
                        <button
                          type="button"
                          onClick={() => onDeleteIncome(item.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

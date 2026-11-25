import React, { useState, useEffect } from 'react';
import { Project, Income } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../shared/calculations';
import { formatDateDDMMYYYY, getTodayISO } from '../../shared/dates';
import { X, ArrowDownLeft } from 'lucide-react';

const PRESET_AMOUNTS = [
  { label: '5 Lac', value: 500000 },
  { label: '10 Lac', value: 1000000 },
  { label: '20 Lac', value: 2000000 },
  { label: '30 Lac', value: 3000000 },
  { label: '40 Lac', value: 4000000 },
  { label: '50 Lac', value: 5000000 },
];

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  projects: Project[];
  defaultProjectId?: number;
  incomeToEdit?: Income | null;
}

export function AddIncomeModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultProjectId,
  incomeToEdit,
}: AddIncomeModalProps) {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayISO);
  const [sourceCustomer, setSourceCustomer] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (incomeToEdit) {
      setProjectId(incomeToEdit.project_id);
      setAmount(String(incomeToEdit.amount));
      setDate(incomeToEdit.income_date);
      setSourceCustomer(incomeToEdit.source_customer || '');
      setNotes(incomeToEdit.notes || '');
    } else {
      setProjectId(defaultProjectId || projects[0]?.id || 0);
      setAmount('');
      setDate(getTodayISO());
      setSourceCustomer('');
      setNotes('');
    }
    setError('');
  }, [isOpen, incomeToEdit, defaultProjectId, projects]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (numAmount <= 0) {
      setError('Please enter a valid positive recovery amount.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (incomeToEdit) {
        const preservedPlotId =
          incomeToEdit.project_id === projectId ? incomeToEdit.plot_id ?? null : null;
        await api.updateIncome(incomeToEdit.id, {
          project_id: projectId,
          plot_id: preservedPlotId,
          amount: numAmount,
          income_date: date,
          source_customer: sourceCustomer.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await api.createIncome({
          project_id: projectId,
          plot_id: null,
          amount: numAmount,
          income_date: date,
          source_customer: sourceCustomer.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save recovery.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-amber-600" />
              <span>{incomeToEdit ? 'Edit Recovery' : 'Add Recovery'}</span>
            </h2>
            <p className="text-xs text-slate-500">Record recovered amount or client receipt</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Project */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Project *
            </label>
            <select
              id="income-project-select"
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              required
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Amount Recovered (Rs.) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                Rs.
              </span>
              <input
                id="income-amount-input"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 500000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full py-2.5 pl-10 pr-3 border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 rounded-lg text-base font-bold"
              />
            </div>

            {/* Quick Amount Selection Preset Buttons */}
            <div className="mt-2.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Quick Amount Selection
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {PRESET_AMOUNTS.map((preset) => {
                  const isSelected = numAmount === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setAmount(String(preset.value))}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300 active:scale-95'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Source / Customer */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Received From / Client Name
            </label>
            <input
              id="income-source-input"
              type="text"
              placeholder="e.g. Mr. Tariq"
              value={sourceCustomer}
              onChange={(e) => setSourceCustomer(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Date *
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                {formatDateDDMMYYYY(date)}
              </span>
            </div>
            <input
              id="income-date-input"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Notes / Memo (Optional)
            </label>
            <input
              id="income-notes-input"
              type="text"
              placeholder="e.g. Cheque #8912 banked into site account"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="income-save-btn"
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting ? 'Saving Recovery...' : `Save Recovery (${formatCurrency(numAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Project, Contract } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, validatePaymentAmount } from '../../shared/calculations';
import { formatDateDDMMYYYY, getTodayISO } from '../../shared/dates';
import { X, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  projects: Project[];
  defaultProjectId?: number;
  defaultContractId?: number;
}

export function AddPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultProjectId,
  defaultContractId,
}: AddPaymentModalProps) {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number>(defaultContractId || 0);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState('');

  // Load contracts when projectId changes
  useEffect(() => {
    if (!isOpen) return;

    if (projectId) {
      setIsLoadingContracts(true);
      api
        .getContracts(projectId)
        .then((data) => {
          setContracts(data);
          if (defaultContractId && data.some((c) => c.id === defaultContractId)) {
            setSelectedContractId(defaultContractId);
          } else if (data.length > 0) {
            setSelectedContractId(data[0].id);
          } else {
            setSelectedContractId(0);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingContracts(false));
    } else {
      setContracts([]);
      setSelectedContractId(0);
    }
  }, [isOpen, projectId, defaultContractId]);

  useEffect(() => {
    if (isOpen) {
      if (defaultProjectId) setProjectId(defaultProjectId);
      if (defaultContractId) setSelectedContractId(defaultContractId);
      setAmount('');
      setPaymentDate(getTodayISO());
      setPaymentMethod('Cash');
      setNotes('');
      setError('');
      setRequestId(
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `pay_${crypto.randomUUID()}`
          : `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      );
    }
  }, [isOpen, defaultProjectId, defaultContractId]);

  if (!isOpen) return null;

  const currentContract = contracts.find((c) => c.id === selectedContractId);
  const contractAmount = currentContract ? Number(currentContract.contract_amount) : 0;
  const alreadyPaid = currentContract ? Number(currentContract.paid_amount || 0) : 0;
  const remainingBalance = Math.max(0, contractAmount - alreadyPaid);

  const numAmount = parseFloat(amount) || 0;
  const validation = currentContract
    ? validatePaymentAmount(contractAmount, alreadyPaid, numAmount)
    : { valid: false, remainingBalance: 0 };

  const isOverpayment = numAmount > remainingBalance;
  const isFullyPaid = remainingBalance <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedContractId || !currentContract) {
      setError('Please select a contract.');
      return;
    }
    if (numAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (isOverpayment) {
      setError('Payment exceeds remaining contract balance.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await api.createPayment({
        project_id: projectId,
        contractor_id: currentContract.contractor_id,
        contract_id: selectedContractId,
        amount: numAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        request_id: requestId,
      });

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment exceeds remaining contract balance.');
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
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Record Contractor Expense</span>
            </h2>
            <p className="text-xs text-slate-500">Fast partial or full payment for contractor contract</p>
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Project *
            </label>
            <select
              id="payment-project-select"
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

          {/* Contract Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Select Contractor Contract *
            </label>
            {isLoadingContracts ? (
              <div className="py-2.5 px-3 bg-slate-50 rounded-lg text-xs text-slate-500">
                Loading contracts...
              </div>
            ) : contracts.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                No contracts found in this project. Please create a contract first.
              </div>
            ) : (
              <select
                id="payment-contract-select"
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(Number(e.target.value))}
                required
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractor_name} — {c.work_title} (Remaining:{' '}
                    {formatCurrency(c.outstanding_amount)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Contract Live Ledger Card */}
          {currentContract && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Contractor & Work</span>
                <span className="font-bold text-slate-900">
                  {currentContract.contractor_name} ({currentContract.work_title})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                    Contract Amount
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(contractAmount)}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                    Already Paid
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {formatCurrency(alreadyPaid)}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                    Remaining
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      remainingBalance > 0 ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    {formatCurrency(remainingBalance)}
                  </span>
                </div>
              </div>

              {/* Quick shortcut to pay full balance */}
              {remainingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(remainingBalance))}
                  className="w-full mt-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fill Full Remaining Balance ({formatCurrency(remainingBalance)})</span>
                </button>
              )}

              {isFullyPaid && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 text-center">
                  This contract is fully paid. If you need to pay more, increase the contract amount
                  first.
                </div>
              )}
            </div>
          )}

          {/* Payment Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Payment Amount (Rs.) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                Rs.
              </span>
              <input
                id="payment-amount-input"
                type="number"
                inputMode="decimal"
                disabled={isFullyPaid}
                placeholder={remainingBalance > 0 ? `Max: ${remainingBalance}` : '0'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className={`w-full py-2.5 pl-10 pr-3 border rounded-lg text-base font-bold ${
                  isOverpayment
                    ? 'border-red-400 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-500'
                    : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500'
                }`}
              />
            </div>

            {/* Overpayment Warning Message (Strict Requirement #15) */}
            {isOverpayment && (
              <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Payment exceeds remaining contract balance (Remaining:{' '}
                {formatCurrency(remainingBalance)}).
              </p>
            )}
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Date *
                </label>
                <span className="text-[11px] font-medium text-slate-500">
                  {formatDateDDMMYYYY(paymentDate)}
                </span>
              </div>
              <input
                id="payment-date-input"
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                id="payment-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Online / Raast">Online / Raast</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Payment Notes / Receipt (Optional)
            </label>
            <input
              id="payment-notes-input"
              type="text"
              placeholder="e.g. Received by Ali personally on site"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="payment-save-btn"
              type="submit"
              disabled={isSubmitting || isOverpayment || isFullyPaid || numAmount <= 0}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting ? (
                'Saving Payment...'
              ) : isOverpayment ? (
                'Cannot Exceed Remaining Balance'
              ) : isFullyPaid ? (
                'Contract Already Fully Paid'
              ) : (
                <>
                  <span>Save Payment ({formatCurrency(numAmount)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

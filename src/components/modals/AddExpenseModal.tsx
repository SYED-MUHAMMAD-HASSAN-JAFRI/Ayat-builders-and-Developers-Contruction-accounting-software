import React, { useState, useEffect, useMemo } from 'react';
import { Project, Material, Expense, Contract } from '../../types';
import { api } from '../../services/api';
import { calculateExpenseAmount, formatCurrency, validatePaymentAmount } from '../../shared/calculations';
import { getTodayISO, formatDateDDMMYYYY } from '../../shared/dates';
import { X, Plus, Check, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  projects: Project[];
  defaultProjectId?: number;
  defaultCategory?: 'Material' | 'Other' | 'Contractor';
  defaultContractorId?: number;
  defaultContractId?: number;
  expenseToEdit?: Expense | null;
}

function createPaymentRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultProjectId,
  defaultCategory,
  defaultContractorId,
  defaultContractId,
  expenseToEdit,
}: AddExpenseModalProps) {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0);
  const [category, setCategory] = useState<'Material' | 'Other' | 'Contractor'>('Material');

  // Material / Other Expense state
  const [materialName, setMaterialName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');

  // Dynamic materials catalog
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAddingNewMaterial, setIsAddingNewMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');

  // Contractor Expense state
  const [projectContracts, setProjectContracts] = useState<Contract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [contractorId, setContractorId] = useState<number>(0);
  const [contractId, setContractId] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentRequestId, setPaymentRequestId] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load materials catalog on open
  useEffect(() => {
    if (isOpen) {
      api.getMaterials().then(setMaterials).catch(console.error);
    }
  }, [isOpen]);

  // Reset or populate on open / edit
  useEffect(() => {
    if (!isOpen) return;

    if (expenseToEdit) {
      setProjectId(expenseToEdit.project_id);
      setMaterialName(expenseToEdit.material_name);
      setCategory(expenseToEdit.category);
      setAmount(expenseToEdit.amount ? String(expenseToEdit.amount) : '');
      setQuantity(expenseToEdit.quantity ? String(expenseToEdit.quantity) : '');
      setUnit(expenseToEdit.unit || '');
      setRate(expenseToEdit.rate ? String(expenseToEdit.rate) : '');
      setDate(expenseToEdit.expense_date);
      setNotes(expenseToEdit.notes || '');
      setContractorId(0);
      setContractId(0);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentRequestId('');
    } else {
      setProjectId(defaultProjectId || projects[0]?.id || 0);
      setCategory(defaultCategory || 'Material');
      setMaterialName('');
      setAmount('');
      setQuantity('');
      setUnit('');
      setRate('');
      setDate(getTodayISO());
      setNotes('');
      setContractorId(defaultContractorId || 0);
      setContractId(defaultContractId || 0);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentRequestId(createPaymentRequestId());
    }
    setError('');
    setIsAddingNewMaterial(false);
  }, [isOpen, expenseToEdit, defaultProjectId, defaultCategory, defaultContractorId, defaultContractId, projects]);

  // Load contracts belonging to selected project whenever projectId changes (for Contractor Expense)
  useEffect(() => {
    if (!isOpen || expenseToEdit || !projectId) {
      setProjectContracts([]);
      return;
    }

    let cancelled = false;
    setIsLoadingContracts(true);
    api
      .getContracts(projectId)
      .then((data) => {
        if (cancelled) return;
        setProjectContracts(data);

        // Build unique contractor IDs for this project
        const contractorIds = Array.from(new Set(data.map((c) => c.contractor_id)));

        // Resolve initial contractor & contract
        let nextContractorId = 0;
        let nextContractId = 0;

        if (defaultContractId) {
          const matchedContract = data.find((c) => c.id === defaultContractId);
          if (matchedContract) {
            nextContractorId = matchedContract.contractor_id;
            nextContractId = matchedContract.id;
          }
        }

        if (!nextContractorId) {
          if (defaultContractorId && contractorIds.includes(defaultContractorId)) {
            nextContractorId = defaultContractorId;
          } else if (contractorId && contractorIds.includes(contractorId)) {
            nextContractorId = contractorId;
          } else if (contractorIds.length > 0) {
            nextContractorId = contractorIds[0];
          }
        }

        if (nextContractorId && !nextContractId) {
          const matchingContracts = data.filter((c) => c.contractor_id === nextContractorId);
          const openContract = matchingContracts.find((c) => Number(c.outstanding_amount || 0) > 0);
          nextContractId = openContract?.id || matchingContracts[0]?.id || 0;
        }

        setContractorId(nextContractorId);
        setContractId(nextContractId);
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load project contracts:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContracts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, expenseToEdit, projectId, defaultContractorId, defaultContractId]);

  // Unique contractors that have contracts on the selected project
  const projectContractors = useMemo(() => {
    const map = new Map<number, { id: number; name: string; type?: string }>();
    for (const c of projectContracts) {
      if (!map.has(c.contractor_id)) {
        map.set(c.contractor_id, {
          id: c.contractor_id,
          name: c.contractor_name || `Contractor #${c.contractor_id}`,
          type: c.contractor_type || undefined,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectContracts]);

  // Contracts belonging to the selected contractor within the selected project
  const contractorContracts = useMemo(() => {
    if (!contractorId) return [];
    return projectContracts.filter(
      (c) => c.project_id === projectId && c.contractor_id === contractorId
    );
  }, [projectContracts, projectId, contractorId]);

  const currentContract = useMemo(
    () => contractorContracts.find((c) => c.id === contractId) || null,
    [contractorContracts, contractId]
  );

  if (!isOpen) return null;

  // Material / Other real-time calculation
  const numQty = parseFloat(quantity);
  const numRate = parseFloat(rate);
  const isQuantityMode = !isNaN(numQty) && numQty > 0 && !isNaN(numRate) && numRate > 0;
  const calculatedTotal = isQuantityMode
    ? calculateExpenseAmount(0, numQty, numRate)
    : calculateExpenseAmount(parseFloat(amount) || 0, null, null);

  // Contractor payment real-time validation
  const contractAmount = currentContract ? Number(currentContract.contract_amount) : 0;
  const alreadyPaid = currentContract ? Number(currentContract.paid_amount || 0) : 0;
  const remainingBalance = Math.max(0, Math.round((contractAmount - alreadyPaid) * 100) / 100);
  const numPaymentAmount = parseFloat(paymentAmount) || 0;
  const paymentValidation = currentContract
    ? validatePaymentAmount(contractAmount, alreadyPaid, numPaymentAmount)
    : { valid: false, remainingBalance: 0 };
  const isOverpayment = Boolean(currentContract) && numPaymentAmount > remainingBalance + 0.001;
  const isFullyPaid = Boolean(currentContract) && remainingBalance <= 0;

  const handleSelectMaterial = (mat: Material) => {
    setMaterialName(mat.name);
    if (mat.default_unit) {
      setUnit(mat.default_unit);
    }
  };

  const handleCreateNewMaterial = async () => {
    if (!newMaterialName.trim()) return;
    try {
      const created = await api.createMaterial({
        name: newMaterialName.trim(),
        default_unit: newMaterialUnit.trim() || undefined,
      });
      setMaterials((prev) => [...prev, created]);
      setMaterialName(created.name);
      if (created.default_unit) setUnit(created.default_unit);
      setIsAddingNewMaterial(false);
      setNewMaterialName('');
      setNewMaterialUnit('');
    } catch (err: any) {
      setError(err.message || 'Failed to create material.');
    }
  };

  const handleProjectChange = (nextProjectId: number) => {
    setProjectId(nextProjectId);
    setContractorId(0);
    setContractId(0);
    setPaymentRequestId(createPaymentRequestId());
    setError('');
  };

  const handleContractorChange = (nextContractorId: number) => {
    setContractorId(nextContractorId);
    const matching = projectContracts.filter(
      (c) => c.project_id === projectId && c.contractor_id === nextContractorId
    );
    const open = matching.find((c) => Number(c.outstanding_amount || 0) > 0);
    setContractId(open?.id || matching[0]?.id || 0);
    setPaymentRequestId(createPaymentRequestId());
    setError('');
  };

  const handleContractChange = (nextContractId: number) => {
    setContractId(nextContractId);
    setPaymentRequestId(createPaymentRequestId());
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    if (category === 'Contractor') {
      if (!contractorId) {
        setError('Please select a contractor.');
        return;
      }
      if (!currentContract) {
        setError('Please select a contract belonging to this contractor and project.');
        return;
      }
      if (currentContract.project_id !== projectId || currentContract.contractor_id !== contractorId) {
        setError('Contractor and contract must belong to the selected project.');
        return;
      }
      if (numPaymentAmount <= 0) {
        setError('Payment amount must be greater than zero.');
        return;
      }
      if (!paymentValidation.valid) {
        setError(paymentValidation.error || 'Payment exceeds remaining contract balance.');
        return;
      }

      setError('');
      setIsSubmitting(true);
      try {
        await api.createPayment({
          project_id: projectId,
          contractor_id: contractorId,
          contract_id: currentContract.id,
          amount: numPaymentAmount,
          payment_date: date,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          request_id: paymentRequestId || undefined,
        });
        await onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save contractor expense payment.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Material or Other Expense
    if (!materialName.trim()) {
      setError(
        category === 'Material'
          ? 'Please select or enter a material name.'
          : 'Please enter an expense description or item.'
      );
      return;
    }
    if (calculatedTotal <= 0) {
      setError('Please enter a valid amount or quantity × rate.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const payload: Partial<Expense> = {
        project_id: projectId,
        material_name: materialName.trim(),
        category,
        amount: calculatedTotal,
        quantity: !isNaN(numQty) && numQty > 0 ? numQty : null,
        unit: unit.trim() || null,
        rate: !isNaN(numRate) && numRate > 0 ? numRate : null,
        expense_date: date,
        notes: notes.trim() || null,
        ...(expenseToEdit
          ? {
              plot_id: expenseToEdit.plot_id ?? null,
              khata_id: expenseToEdit.khata_id ?? null,
            }
          : {}),
      };

      if (expenseToEdit) {
        await api.updateExpense(expenseToEdit.id, payload);
      } else {
        await api.createExpense(payload);
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {expenseToEdit ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <p className="text-xs text-slate-500">
              {category === 'Contractor'
                ? 'Record contractor payment against a project contract'
                : 'Record construction material or general site expense'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 flex items-center gap-2">
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
              id="expense-project-select"
              value={projectId}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
              required
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.location ? `(${p.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Toggle: Material vs Other / General vs Contractor */}
          <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 border border-slate-200 gap-1">
            <button
              id="expense-category-material"
              type="button"
              onClick={() => {
                setCategory('Material');
                setError('');
              }}
              className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                category === 'Material'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Material
            </button>
            <button
              id="expense-category-other"
              type="button"
              onClick={() => {
                setCategory('Other');
                setError('');
              }}
              className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                category === 'Other'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Other / General
            </button>
            {!expenseToEdit && (
              <button
                id="expense-category-contractor"
                type="button"
                onClick={() => {
                  setCategory('Contractor');
                  setPaymentRequestId(createPaymentRequestId());
                  setError('');
                }}
                className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                  category === 'Contractor'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Contractor
              </button>
            )}
          </div>

          {/* ================= CONTRACTOR EXPENSE FORM ================= */}
          {category === 'Contractor' ? (
            <div className="space-y-4">
              {isLoadingContracts ? (
                <div className="py-3 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  Loading project contractors &amp; contracts...
                </div>
              ) : projectContracts.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold">No contracts found for this project.</p>
                  <p className="text-amber-800">
                    Use <strong>Add Contract</strong> on the Project Detail page to assign a contractor contract first.
                  </p>
                </div>
              ) : (
                <>
                  {/* Select Contractor */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Select Contractor *
                    </label>
                    <select
                      id="expense-contractor-select"
                      value={contractorId}
                      onChange={(e) => handleContractorChange(Number(e.target.value))}
                      required
                      className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {projectContractors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.type ? `(${c.type})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Contract */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Select Contract *
                    </label>
                    <select
                      id="expense-contract-select"
                      value={contractId}
                      onChange={(e) => handleContractChange(Number(e.target.value))}
                      required
                      className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    >
                      {contractorContracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.work_title}
                          {c.contract_type ? ` (${c.contract_type})` : ''} — Remaining:{' '}
                          {formatCurrency(c.outstanding_amount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Live Contract Balance Summary */}
                  {currentContract && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                            Contract
                          </span>
                          <span className="text-xs font-bold text-slate-900 tabular-nums">
                            {formatCurrency(contractAmount)}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                            Paid
                          </span>
                          <span className="text-xs font-bold text-emerald-700 tabular-nums">
                            {formatCurrency(alreadyPaid)}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">
                            Remaining
                          </span>
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              remainingBalance > 0 ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {formatCurrency(remainingBalance)}
                          </span>
                        </div>
                      </div>

                      {remainingBalance > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(String(remainingBalance))}
                          className="w-full py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Fill Remaining Balance ({formatCurrency(remainingBalance)})</span>
                        </button>
                      ) : (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 text-center">
                          This contract is already fully paid.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Amount */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Payment Amount (Rs.) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                        Rs.
                      </span>
                      <input
                        id="expense-contractor-amount"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        disabled={isFullyPaid || !currentContract}
                        placeholder={remainingBalance > 0 ? `Max: ${remainingBalance}` : '0'}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        required
                        className={`w-full py-2.5 pl-10 pr-3 border rounded-lg text-base font-bold ${
                          isOverpayment
                            ? 'border-red-400 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-500'
                            : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500'
                        }`}
                      />
                    </div>
                    {isOverpayment && (
                      <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Payment exceeds remaining contract balance ({formatCurrency(remainingBalance)}).
                      </p>
                    )}
                  </div>

                  {/* Payment Date & Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Payment Date *
                        </label>
                        {date && (
                          <span className="text-[11px] font-semibold text-sky-700 tabular-nums">
                            {formatDateDDMMYYYY(date)}
                          </span>
                        )}
                      </div>
                      <input
                        id="expense-date"
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        id="expense-payment-method"
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
                      Notes (Optional)
                    </label>
                    <input
                      id="expense-notes"
                      type="text"
                      placeholder="e.g. Paid for ground floor plaster milestone"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Submit Contractor Expense */}
              <div className="pt-2">
                <button
                  id="expense-save-btn"
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !currentContract ||
                    isFullyPaid ||
                    isOverpayment ||
                    numPaymentAmount <= 0
                  }
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {isSubmitting
                    ? 'Saving Payment...'
                    : isOverpayment
                    ? 'Cannot Exceed Remaining Balance'
                    : isFullyPaid && currentContract
                    ? 'Contract Already Fully Paid'
                    : `Save Contractor Expense (${formatCurrency(numPaymentAmount)})`}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ================= MATERIAL & OTHER EXPENSE FORM ================= */}
              {category === 'Material' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Select or Enter Material *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewMaterial(!isAddingNewMaterial)}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingNewMaterial ? 'Cancel' : 'New Item'}</span>
                    </button>
                  </div>

                  {/* Add New Custom Material Box */}
                  {isAddingNewMaterial && (
                    <div className="p-3 mb-2 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Material Name (e.g. Marble)"
                          value={newMaterialName}
                          onChange={(e) => setNewMaterialName(e.target.value)}
                          className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Default Unit (e.g. Sq.Ft)"
                          value={newMaterialUnit}
                          onChange={(e) => setNewMaterialUnit(e.target.value)}
                          className="py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateNewMaterial}
                        className="w-full py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium rounded-lg"
                      >
                        Save &amp; Use Material
                      </button>
                    </div>
                  )}

                  {/* Quick Select Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-lg">
                    {materials.map((m) => {
                      const isSelected = materialName.toLowerCase() === m.name.toLowerCase();
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMaterial(m)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium flex items-center gap-1 ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{m.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Material Name Input */}
                  <input
                    id="expense-material-name"
                    type="text"
                    placeholder="Or type material name..."
                    required
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              )}

              {category === 'Other' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Expense Description / Item *
                  </label>
                  <input
                    id="expense-item-description"
                    type="text"
                    placeholder="e.g. Fuel for generator, Municipal fee, Tea/Food"
                    required
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Amount / Quantity / Rate Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Expense Amount Calculation
                </div>

                {/* Quantity + Unit + Rate */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Qty (Optional)
                    </label>
                    <input
                      id="expense-qty"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="e.g. 50"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unit (Optional)
                    </label>
                    <input
                      id="expense-unit"
                      type="text"
                      placeholder="e.g. Bori, KG"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Rate (Optional)
                    </label>
                    <input
                      id="expense-rate"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="Rs. 1,400"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Direct Total Amount */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isQuantityMode ? 'Calculated Total Amount' : 'Total Amount (Rs.) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                      Rs.
                    </span>
                    <input
                      id="expense-amount"
                      type="number"
                      inputMode="decimal"
                      placeholder={isQuantityMode ? String(calculatedTotal) : 'e.g. 20000'}
                      value={isQuantityMode ? calculatedTotal : amount}
                      onChange={(e) => {
                        if (!isQuantityMode) {
                          setAmount(e.target.value);
                        }
                      }}
                      readOnly={isQuantityMode}
                      required={!isQuantityMode}
                      className={`w-full py-2.5 pl-10 pr-3 border rounded-lg text-base font-bold ${
                        isQuantityMode
                          ? 'bg-sky-50/50 border-sky-200 text-sky-900'
                          : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-500'
                      }`}
                    />
                  </div>
                </div>

                {isQuantityMode && (
                  <div className="p-2 rounded-lg bg-white border border-sky-100 flex items-center justify-between text-xs text-sky-800 font-medium">
                    <span>Formula:</span>
                    <span>
                      {quantity} {unit || 'units'} × Rs. {Number(rate).toLocaleString()} ={' '}
                      <strong className="font-bold text-sky-900">
                        {formatCurrency(calculatedTotal)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Date *
                    </label>
                    {date && (
                      <span className="text-[11px] font-semibold text-sky-700 tabular-nums">
                        {formatDateDDMMYYYY(date)}
                      </span>
                    )}
                  </div>
                  <input
                    id="expense-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Notes / Memo (Optional)
                  </label>
                  <input
                    id="expense-notes"
                    type="text"
                    placeholder="e.g. For lintel beam, supplier cash memo #402"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="expense-save-btn"
                  type="submit"
                  disabled={isSubmitting || calculatedTotal <= 0}
                  className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {isSubmitting ? 'Saving...' : `Save Expense (${formatCurrency(calculatedTotal)})`}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

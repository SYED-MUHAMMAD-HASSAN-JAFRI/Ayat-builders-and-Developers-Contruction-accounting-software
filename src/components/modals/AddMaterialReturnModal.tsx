import React, { useState, useEffect } from 'react';
import { Project, Material, MaterialReturn } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../shared/calculations';
import { formatDateDDMMYYYY, getTodayISO } from '../../shared/dates';
import { X, RotateCcw, Check } from 'lucide-react';

interface AddMaterialReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  projects: Project[];
  defaultProjectId?: number;
  returnToEdit?: MaterialReturn | null;
}

export function AddMaterialReturnModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultProjectId,
  returnToEdit,
}: AddMaterialReturnModalProps) {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [materialName, setMaterialName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayISO);
  const [returnedTo, setReturnedTo] = useState<'Client' | 'Contractor' | 'Other'>('Contractor');
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getMaterials().then(setMaterials).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (returnToEdit) {
      setProjectId(returnToEdit.project_id);
      setSelectedMaterialId(returnToEdit.material_id || '');
      setMaterialName(returnToEdit.material_name);
      setQuantity(returnToEdit.quantity != null ? String(returnToEdit.quantity) : '');
      setUnit(returnToEdit.unit || '');
      setReturnAmount(String(returnToEdit.return_amount));
      setReturnDate(returnToEdit.return_date);
      setReturnedTo(returnToEdit.returned_to);
      setRecipientName(returnToEdit.recipient_name || '');
      setNotes(returnToEdit.notes || '');
    } else {
      setProjectId(defaultProjectId || projects[0]?.id || 0);
      setSelectedMaterialId('');
      setMaterialName('');
      setQuantity('');
      setUnit('');
      setReturnAmount('');
      setReturnDate(getTodayISO());
      setReturnedTo('Contractor');
      setRecipientName('');
      setNotes('');
    }
    setError('');
  }, [isOpen, returnToEdit, defaultProjectId, projects]);

  if (!isOpen) return null;

  const handleProjectChange = (nextId: number) => {
    setProjectId(nextId);
  };

  const handleSelectMaterialChip = (mat: Material) => {
    setSelectedMaterialId(mat.id);
    setMaterialName(mat.name);
    if (mat.default_unit && !unit) {
      setUnit(mat.default_unit);
    } else if (mat.default_unit) {
      setUnit(mat.default_unit);
    }
  };

  const handleMaterialDropdownChange = (val: string) => {
    if (!val) {
      setSelectedMaterialId('');
      setMaterialName('');
      return;
    }
    const idNum = Number(val);
    const mat = materials.find((m) => m.id === idNum);
    if (mat) {
      handleSelectMaterialChip(mat);
    }
  };

  const numReturnAmount = parseFloat(returnAmount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!materialName.trim() && !selectedMaterialId) {
      setError('Please select the material being returned.');
      return;
    }
    if (numReturnAmount <= 0) {
      setError('Return amount must be greater than zero.');
      return;
    }
    const qtyNum = quantity.trim() !== '' ? parseFloat(quantity) : null;
    if (qtyNum !== null && (isNaN(qtyNum) || qtyNum < 0)) {
      setError('Return quantity cannot be negative.');
      return;
    }

    const preservedPlotId =
      returnToEdit && returnToEdit.project_id === projectId ? returnToEdit.plot_id ?? null : null;

    setError('');
    setIsSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        plot_id: preservedPlotId,
        material_id: selectedMaterialId ? Number(selectedMaterialId) : null,
        material_name: materialName.trim(),
        quantity: qtyNum,
        unit: unit.trim() || null,
        return_amount: numReturnAmount,
        return_date: returnDate,
        returned_to: returnedTo,
        recipient_name: recipientName.trim() || null,
        notes: notes.trim() || null,
      };

      if (returnToEdit) {
        await api.updateMaterialReturn(returnToEdit.id, payload);
      } else {
        await api.createMaterialReturn(payload);
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save material return.');
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
              <RotateCcw className="w-5 h-5 text-[#164B8A]" />
              <span>{returnToEdit ? 'Edit Material Return' : 'Record Material Return'}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Deducts returned material cost from Net Material Expense without altering purchases
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
              id="return-project-select"
              value={projectId}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
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

          {/* Material Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Material Returned *
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-lg">
              {materials.map((m) => {
                const isSelected =
                  selectedMaterialId === m.id ||
                  materialName.toLowerCase() === m.name.toLowerCase();
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMaterialChip(m)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all font-medium flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#082F60] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>

            <select
              id="return-material-select"
              value={selectedMaterialId}
              onChange={(e) => handleMaterialDropdownChange(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">-- Select Material --</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.default_unit ? `(${m.default_unit})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity, Unit & Return Amount */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Qty (Optional)
              </label>
              <input
                id="return-qty-input"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="e.g. 10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Unit
              </label>
              <input
                id="return-unit-input"
                type="text"
                placeholder="e.g. Bori"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Return Date *
                </label>
                <span className="text-[10px] font-medium text-slate-500">
                  {formatDateDDMMYYYY(returnDate)}
                </span>
              </div>
              <input
                id="return-date-input"
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Return Amount (Rs.) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                Rs.
              </span>
              <input
                id="return-amount-input"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="e.g. 14000"
                required
                value={returnAmount}
                onChange={(e) => setReturnAmount(e.target.value)}
                className="w-full py-2.5 pl-10 pr-3 border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 rounded-lg text-base font-bold"
              />
            </div>
          </div>

          {/* Returned To & Recipient Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Returned To *
              </label>
              <select
                id="return-to-select"
                value={returnedTo}
                onChange={(e) => setReturnedTo(e.target.value as 'Client' | 'Contractor' | 'Other')}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="Contractor">Contractor</option>
                <option value="Client">Client</option>
                <option value="Other">Other / Supplier</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Recipient Name (Optional)
              </label>
              <input
                id="return-recipient-input"
                type="text"
                placeholder="e.g. ABC Hardware / Mr. Tariq"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Notes / Reason (Optional)
            </label>
            <input
              id="return-notes-input"
              type="text"
              placeholder="e.g. Unused cement bags returned after lintel"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="return-save-btn"
              type="submit"
              disabled={isSubmitting || numReturnAmount <= 0 || !materialName}
              className="w-full py-3 px-4 bg-[#082F60] hover:bg-[#164B8A] disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting
                ? 'Saving Return...'
                : `Save Material Return (${formatCurrency(numReturnAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Project, Contractor, ContractorType, Contract } from '../../types';
import { api } from '../../services/api';
import { formatDateDDMMYYYY, getTodayISO } from '../../shared/dates';
import { X, FileSignature, Plus, Settings2, Check, Edit2, Power } from 'lucide-react';

interface AddThekaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  projects: Project[];
  defaultProjectId?: number;
  contractToEdit?: Contract | null;
}

export function AddThekaModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  defaultProjectId,
  contractToEdit,
}: AddThekaModalProps) {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 0);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [activeTypes, setActiveTypes] = useState<ContractorType[]>([]);
  const [allTypes, setAllTypes] = useState<ContractorType[]>([]);

  const [contractorId, setContractorId] = useState<number>(0);
  const [selectedTypeId, setSelectedTypeId] = useState<number | ''>('');
  const [workTitle, setWorkTitle] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractDate, setContractDate] = useState(getTodayISO);
  const [notes, setNotes] = useState('');

  // Quick add new contract type inline
  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isManagingTypes, setIsManagingTypes] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');

  // Quick contractor creation
  const [isQuickContractor, setIsQuickContractor] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickType, setQuickType] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadContractTypes = async () => {
    const [activeList, fullList] = await Promise.all([
      api.getContractorTypes(true),
      api.getContractorTypes(false),
    ]);
    setActiveTypes(activeList);
    setAllTypes(fullList);
    if (activeList.length > 0 && !quickType) {
      setQuickType(activeList[0].name);
    }
    return { activeList, fullList };
  };

  useEffect(() => {
    if (isOpen) {
      api.getContractors().then((data) => {
        setContractors(data);
        if (data.length > 0 && !contractToEdit) {
          setContractorId(data[0].id);
        }
      });
      loadContractTypes().catch(console.error);
    }
  }, [isOpen, contractToEdit]);

  useEffect(() => {
    if (!isOpen) return;

    if (contractToEdit) {
      setProjectId(contractToEdit.project_id);
      setContractorId(contractToEdit.contractor_id);
      setSelectedTypeId(contractToEdit.contract_type_id || '');
      setWorkTitle(contractToEdit.work_title);
      setContractAmount(String(contractToEdit.contract_amount));
      setContractDate(
        contractToEdit.contract_date ||
          (contractToEdit.created_at ? contractToEdit.created_at.slice(0, 10) : getTodayISO())
      );
      setNotes(contractToEdit.notes || '');
    } else {
      setProjectId(defaultProjectId || projects[0]?.id || 0);
      setSelectedTypeId('');
      setWorkTitle('');
      setContractAmount('');
      setContractDate(getTodayISO());
      setNotes('');
      setIsQuickContractor(false);
    }
    setIsAddingType(false);
    setNewTypeName('');
    setIsManagingTypes(false);
    setEditingTypeId(null);
    setError('');
  }, [isOpen, contractToEdit, defaultProjectId, projects]);

  if (!isOpen) return null;

  const handleSelectContractType = (typeIdValue: string) => {
    if (!typeIdValue) {
      setSelectedTypeId('');
      return;
    }
    const idNum = Number(typeIdValue);
    setSelectedTypeId(idNum);
    const chosen = allTypes.find((t) => t.id === idNum);
    // Populate work title only if empty or if user hasn't customized it away from a previous type name
    if (chosen && (!workTitle.trim() || allTypes.some((t) => t.name === workTitle.trim()))) {
      setWorkTitle(chosen.name);
    }
    // IMPORTANT: Never auto-fill contractAmount from predefined values
  };

  const handleCreateContractType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      setError('Please enter a contract type name.');
      return;
    }
    setError('');
    try {
      const created = await api.createContractorType({ name: trimmed });
      await loadContractTypes();
      setSelectedTypeId(created.id);
      if (!workTitle.trim()) {
        setWorkTitle(created.name);
      }
      setNewTypeName('');
      setIsAddingType(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add contract type.');
    }
  };

  const handleSaveTypeEdit = async (typeId: number) => {
    const trimmed = editingTypeName.trim();
    if (!trimmed) {
      setError('Contract type name cannot be empty.');
      return;
    }
    setError('');
    try {
      await api.updateContractorType(typeId, { name: trimmed });
      await loadContractTypes();
      setEditingTypeId(null);
      setEditingTypeName('');
    } catch (err: any) {
      setError(err.message || 'Failed to update contract type.');
    }
  };

  const handleToggleTypeActive = async (ct: ContractorType) => {
    setError('');
    try {
      const nextActive = ct.is_active === 0 ? 1 : 0;
      await api.updateContractorType(ct.id, { is_active: nextActive });
      await loadContractTypes();
      if (nextActive === 0 && Number(selectedTypeId) === ct.id) {
        setSelectedTypeId('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update contract type status.');
    }
  };

  const handleCreateQuickContractor = async () => {
    if (!quickName.trim()) return;
    try {
      const created = await api.createContractor({
        name: quickName.trim(),
        phone: quickPhone.trim() || undefined,
        type_name: quickType || activeTypes[0]?.name || 'Other',
      });
      setContractors((prev) => [...prev, created]);
      setContractorId(created.id);
      if (!workTitle) setWorkTitle(created.type_name);
      setIsQuickContractor(false);
      setQuickName('');
      setQuickPhone('');
    } catch (err: any) {
      setError(err.message || 'Failed to create contractor');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!contractorId) {
      setError('Please select a contractor.');
      return;
    }
    if (!workTitle.trim()) {
      setError('Please enter work description.');
      return;
    }
    const amt = parseFloat(contractAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a positive contract amount.');
      return;
    }

    const selectedTypeObj = selectedTypeId
      ? allTypes.find((t) => t.id === Number(selectedTypeId))
      : null;

    setError('');
    setIsSubmitting(true);
    try {
      if (contractToEdit) {
        await api.updateContract(contractToEdit.id, {
          contract_type_id: selectedTypeId ? Number(selectedTypeId) : null,
          contract_type: selectedTypeObj?.name || contractToEdit.contract_type || null,
          work_title: workTitle.trim(),
          contract_amount: amt,
          contract_date: contractDate,
          notes: notes.trim() || null,
        });
      } else {
        await api.createContract({
          project_id: projectId,
          contractor_id: contractorId,
          contract_type_id: selectedTypeId ? Number(selectedTypeId) : null,
          contract_type: selectedTypeObj?.name || null,
          work_title: workTitle.trim(),
          contract_amount: amt,
          contract_date: contractDate,
          notes: notes.trim() || null,
        });
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save theka contract.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If editing an existing contract whose type was deactivated, include it in dropdown options cleanly
  const dropdownTypes = [...activeTypes];
  if (
    contractToEdit?.contract_type_id &&
    !dropdownTypes.some((t) => t.id === contractToEdit.contract_type_id)
  ) {
    const historical = allTypes.find((t) => t.id === contractToEdit.contract_type_id);
    if (historical) {
      dropdownTypes.push(historical);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-indigo-600" />
              <span>{contractToEdit ? 'Edit Contract' : 'Add Contract'}</span>
            </h2>
            <p className="text-xs text-slate-500">Contractor agreement &amp; commitment for this project</p>
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
              id="theka-project-select"
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              disabled={Boolean(contractToEdit)}
              required
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-75"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contractor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Contractor (Thekadar) *
              </label>
              {!contractToEdit && (
                <button
                  type="button"
                  onClick={() => setIsQuickContractor(!isQuickContractor)}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isQuickContractor ? 'Cancel' : 'New Contractor'}</span>
                </button>
              )}
            </div>

            {isQuickContractor && (
              <div className="p-3 mb-2 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contractor Name (e.g. Tariq)"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value)}
                    className="flex-1 py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {activeTypes.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateQuickContractor}
                    className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg"
                  >
                    Add & Select
                  </button>
                </div>
              </div>
            )}

            <select
              id="theka-contractor-select"
              value={contractorId}
              onChange={(e) => setContractorId(Number(e.target.value))}
              disabled={Boolean(contractToEdit)}
              required
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:opacity-75"
            >
              {contractors.length === 0 && <option value="0">No contractors found</option>}
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type_name}) {c.phone ? `• ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Contract Type Selection + Inline Add / Manage */}
          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Contract Type
              </label>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingType(!isAddingType);
                    setIsManagingTypes(false);
                  }}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingType ? 'Cancel' : 'Add New Contract Type'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsManagingTypes(!isManagingTypes);
                    setIsAddingType(false);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>{isManagingTypes ? 'Close' : 'Manage'}</span>
                </button>
              </div>
            </div>

            {isAddingType && (
              <div className="p-2.5 mb-2 bg-sky-50/70 border border-sky-200 rounded-xl flex gap-2">
                <input
                  id="new-contract-type-input"
                  type="text"
                  placeholder="Enter contract type name (e.g. Tile Labour)"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="flex-1 py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                />
                <button
                  id="save-new-contract-type-btn"
                  type="button"
                  onClick={handleCreateContractType}
                  className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg"
                >
                  Add
                </button>
              </div>
            )}

            {isManagingTypes && (
              <div className="p-3 mb-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Manage Contract Types (Edit / Deactivate)
                </div>
                {allTypes.map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    {editingTypeId === ct.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingTypeName}
                          onChange={(e) => setEditingTypeName(e.target.value)}
                          className="flex-1 py-1 px-2 border border-slate-300 rounded text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTypeEdit(ct.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTypeId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-semibold truncate ${
                              ct.is_active === 0 ? 'text-slate-400 line-through' : 'text-slate-800'
                            }`}
                          >
                            {ct.name}
                          </span>
                          {ct.is_active === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTypeId(ct.id);
                              setEditingTypeName(ct.name);
                            }}
                            className="p-1 text-slate-500 hover:text-sky-700"
                            title="Rename type"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTypeActive(ct)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                              ct.is_active === 0
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{ct.is_active === 0 ? 'Activate' : 'Deactivate'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <select
              id="theka-contract-type-select"
              value={selectedTypeId}
              onChange={(e) => handleSelectContractType(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">-- Select Contract Type --</option>
              {dropdownTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_active === 0 ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Work Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Work Description *
            </label>
            <input
              id="theka-work-title"
              type="text"
              placeholder="e.g. Ground Floor Shattering or Main Electrical Wiring"
              required
              value={workTitle}
              onChange={(e) => setWorkTitle(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Contract Amount (Manual Entry Only) & Contract Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Contract Amount (Rs.) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm font-semibold">
                  Rs.
                </span>
                <input
                  id="theka-amount-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="Enter contract amount"
                  required
                  value={contractAmount}
                  onChange={(e) => setContractAmount(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-3 border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 rounded-lg text-base font-bold"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Contract Date *
                </label>
                <span className="text-[11px] font-medium text-slate-500">
                  {formatDateDDMMYYYY(contractDate)}
                </span>
              </div>
              <input
                id="theka-date-input"
                type="date"
                required
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 -mt-2">
            Contract amount records the contractor commitment. Total Project Cost increases only when payments are recorded.
          </p>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Contract Terms / Notes (Optional)
            </label>
            <textarea
              id="theka-notes-input"
              rows={2}
              placeholder="e.g. Scope covers plumbing lines, geyser fitting, sanitary fixtures"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              id="theka-save-btn"
              type="submit"
              disabled={isSubmitting || !contractAmount || parseFloat(contractAmount) <= 0}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isSubmitting ? 'Saving Contract...' : contractToEdit ? 'Update Contract' : 'Save Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

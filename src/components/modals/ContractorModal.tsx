import React, { useState, useEffect } from 'react';
import { Contractor, ContractorType } from '../../types';
import { api } from '../../services/api';
import { X, Users } from 'lucide-react';

interface ContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractorToEdit?: Contractor | null;
}

export function ContractorModal({
  isOpen,
  onClose,
  onSuccess,
  contractorToEdit,
}: ContractorModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [typeName, setTypeName] = useState('Plumber');
  const [notes, setNotes] = useState('');
  const [types, setTypes] = useState<ContractorType[]>([]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getContractorTypes(true).then(setTypes).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (contractorToEdit) {
      setName(contractorToEdit.name);
      setPhone(contractorToEdit.phone || '');
      setTypeName(contractorToEdit.type_name);
      setNotes(contractorToEdit.notes || '');
    } else {
      setName('');
      setPhone('');
      setTypeName('Plumber');
      setNotes('');
    }
    setError('');
  }, [contractorToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Contractor name is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (contractorToEdit) {
        await api.updateContractor(contractorToEdit.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          type_name: typeName,
          notes: notes.trim() || undefined,
        });
      } else {
        await api.createContractor({
          name: name.trim(),
          phone: phone.trim() || undefined,
          type_name: typeName,
          notes: notes.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save contractor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              {contractorToEdit ? 'Edit Contractor' : 'New Contractor / Thekadar'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Contractor Name *
            </label>
            <input
              id="contractor-name-input"
              type="text"
              required
              placeholder="e.g. Ali Hassan or Ustad Rasheed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Trade / Specialty *
            </label>
            <select
              id="contractor-type-select"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {types.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
              {!types.some((t) => t.name === typeName) && (
                <option value={typeName}>{typeName}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Mobile Phone
            </label>
            <input
              id="contractor-phone-input"
              type="tel"
              placeholder="e.g. 0300-1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              id="contractor-notes-input"
              rows={2}
              placeholder="e.g. Recommended by civil engineer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              id="contractor-save-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
            >
              {isSubmitting ? 'Saving...' : contractorToEdit ? 'Update Contractor' : 'Save Contractor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

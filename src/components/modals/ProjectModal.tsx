import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { api } from '../../services/api';
import { formatDateDDMMYYYY } from '../../shared/dates';
import { X, Building2 } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  projectToEdit?: Project | null;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ProjectModal({ isOpen, onClose, onSuccess, projectToEdit }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'Active' | 'Completed' | 'Archived'>('Active');
  const [requestId, setRequestId] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description || '');
      setLocation(projectToEdit.location || '');
      setStatus(projectToEdit.status);
      setRequestId('');
    } else {
      setName('');
      setDescription('');
      setLocation('');
      setStatus('Active');
      setRequestId(createRequestId());
    }
    setError('');
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (projectToEdit) {
        const updated = await api.updateProject(projectToEdit.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          status,
        });
        if (!updated || !updated.id) {
          throw new Error('Server did not confirm project update.');
        }
      } else {
        const created = await api.createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          status,
          request_id: requestId || undefined,
        });
        if (!created || !created.id) {
          throw new Error('Server did not confirm project creation.');
        }
      }
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                {projectToEdit ? 'Edit Project' : 'New Construction Project'}
              </h3>
              {projectToEdit?.created_at && (
                <p className="text-[11px] text-slate-500">
                  Created: {formatDateDDMMYYYY(projectToEdit.created_at)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"
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
              Project Name *
            </label>
            <input
              id="project-name-input"
              type="text"
              required
              placeholder="e.g. House #124 or Plaza Block A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Location / Plot Address
            </label>
            <input
              id="project-location-input"
              type="text"
              placeholder="e.g. Sector G-13/2, Plot 124"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Description / Notes
            </label>
            <textarea
              id="project-description-input"
              rows={2}
              placeholder="e.g. Double story luxury villa (30x60)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Status
            </label>
            <select
              id="project-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="Active">Active (Ongoing Construction)</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              id="project-save-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
            >
              {isSubmitting ? 'Saving...' : projectToEdit ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

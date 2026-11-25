import React, { useState, useEffect } from 'react';
import { Plot, Khata } from '../../types';
import { api } from '../../services/api';
import { X, Plus, Trash2, Layers } from 'lucide-react';

interface PlotKhataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  projectId: number;
  projectName: string;
}

export function PlotKhataModal({
  isOpen,
  onClose,
  onChanged,
  projectId,
  projectName,
}: PlotKhataModalProps) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [khatas, setKhatas] = useState<Khata[]>([]);
  const [newPlotName, setNewPlotName] = useState('');
  const [newKhataName, setNewKhataName] = useState('');
  const [selectedPlotForKhata, setSelectedPlotForKhata] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [isSubmittingPlot, setIsSubmittingPlot] = useState(false);
  const [isSubmittingKhata, setIsSubmittingKhata] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'plots' | 'khatas'>('plots');

  const loadData = async () => {
    try {
      const [p, k] = await Promise.all([api.getPlots(projectId), api.getKhatas(projectId)]);
      setPlots(p);
      setKhatas(k);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setNewPlotName('');
      setNewKhataName('');
      loadData();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleAddPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlotName.trim();
    if (!trimmed) {
      setError('Please enter a plot name.');
      return;
    }
    setIsSubmittingPlot(true);
    setError('');
    try {
      await api.createPlot({ project_id: projectId, name: trimmed });
      setNewPlotName('');
      await loadData();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to add plot');
    } finally {
      setIsSubmittingPlot(false);
    }
  };

  const handleDeletePlot = async (id: number) => {
    try {
      setError('');
      await api.deletePlot(id);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete plot');
    }
  };

  const handleAddKhata = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKhataName.trim();
    if (!trimmed) {
      setError('Please enter a khata name.');
      return;
    }
    setIsSubmittingKhata(true);
    setError('');
    try {
      await api.createKhata({
        project_id: projectId,
        plot_id: selectedPlotForKhata ? Number(selectedPlotForKhata) : undefined,
        name: trimmed,
      });
      setNewKhataName('');
      await loadData();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to add khata');
    } finally {
      setIsSubmittingKhata(false);
    }
  };

  const handleDeleteKhata = async (id: number) => {
    try {
      setError('');
      await api.deleteKhata(id);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete khata');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 z-10 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Plots & Khatas</h3>
              <p className="text-xs text-slate-500 truncate">{projectName}</p>
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

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Tab switch */}
        <div className="mt-4 flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('plots');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeSubTab === 'plots' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Plots ({plots.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('khatas');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeSubTab === 'khatas' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Khatas ({khatas.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {activeSubTab === 'plots' ? (
            <div>
              <form onSubmit={handleAddPlot} className="flex items-center gap-2 mb-3">
                <input
                  id="new-plot-name-input"
                  type="text"
                  placeholder="New Plot name (e.g. Plot #124)"
                  value={newPlotName}
                  onChange={(e) => setNewPlotName(e.target.value)}
                  className="flex-1 min-w-0 py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
                <button
                  id="add-plot-submit-btn"
                  type="submit"
                  disabled={isSubmittingPlot}
                  className="shrink-0 py-2 px-3.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingPlot ? 'Adding...' : 'Add'}</span>
                </button>
              </form>

              <div className="space-y-1.5">
                {plots.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No plots configured.</p>
                ) : (
                  plots.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeletePlot(p.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete plot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <form onSubmit={handleAddKhata} className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    id="new-khata-name-input"
                    type="text"
                    placeholder="Khata name (e.g. Ground Floor)"
                    value={newKhataName}
                    onChange={(e) => setNewKhataName(e.target.value)}
                    className="flex-1 min-w-0 py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    id="add-khata-submit-btn"
                    type="submit"
                    disabled={isSubmittingKhata}
                    className="shrink-0 py-2 px-3.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSubmittingKhata ? 'Adding...' : 'Add'}</span>
                  </button>
                </div>
                {plots.length > 0 && (
                  <select
                    value={selectedPlotForKhata}
                    onChange={(e) =>
                      setSelectedPlotForKhata(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
                  >
                    <option value="">Optional: Link to Plot</option>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </form>

              <div className="space-y-1.5">
                {khatas.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No khatas configured.</p>
                ) : (
                  khatas.map((k) => {
                    const linkedPlot = k.plot_id ? plots.find((p) => p.id === k.plot_id) : null;
                    return (
                      <div
                        key={k.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{k.name}</span>
                          {k.plot_id && (
                            <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                              {linkedPlot ? linkedPlot.name : `Plot #${k.plot_id}`}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteKhata(k.id)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Delete khata"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


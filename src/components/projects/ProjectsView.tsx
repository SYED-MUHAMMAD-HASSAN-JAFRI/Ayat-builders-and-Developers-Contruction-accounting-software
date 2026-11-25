import React, { useState } from 'react';
import { Project } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Plus, Search, Filter, Building2 } from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  onSelectProject: (projectId: number) => void;
  onOpenNewProject: () => void;
}

export function ProjectsView({
  projects,
  onSelectProject,
  onOpenNewProject,
}: ProjectsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Archived'>('All');

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLoc = p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName && !matchLoc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Projects Directory</h2>
          <p className="text-xs text-slate-500">Manage sites, costs, thekas and client receivables</p>
        </div>
        <button
          type="button"
          onClick={onOpenNewProject}
          className="py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by project name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {(['All', 'Active', 'Completed', 'Archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            {projects.length === 0
              ? 'No projects found. Create your first project.'
              : 'No projects match the current filter.'}
          </div>
        ) : (
          filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => onSelectProject(p.id)} />
          ))
        )}
      </div>
    </div>
  );
}

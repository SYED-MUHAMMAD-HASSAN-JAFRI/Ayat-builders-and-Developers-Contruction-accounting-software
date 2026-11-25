import React from 'react';
import { Project } from '../../types';
import { formatDateDDMMYYYY } from '../../shared/dates';
import { Building2, MapPin, ChevronRight, Calendar } from 'lucide-react';

interface ProjectCardProps {
  key?: React.Key;
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const isCompleted = project.status === 'Completed';
  const isArchived = project.status === 'Archived';

  const statusStyles = isCompleted
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
    : isArchived
    ? 'bg-slate-100 text-[#64748B] border border-slate-200'
    : 'bg-[#EAF2FC] text-[#082F60] border border-[#164B8A]/15';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-[#164B8A]/40 hover:shadow-sm transition-all px-3.5 py-3.5 sm:px-4 sm:py-4 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#164B8A] active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Thumbnail + Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-[#EAF2FC] text-[#082F60] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[#172B4D] text-sm sm:text-base truncate">
                {project.name}
              </h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${statusStyles}`}
              >
                {project.status}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {project.location && project.location.trim().length > 0 && (
                <p className="text-xs text-[#64748B] flex items-center gap-1 truncate min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span className="truncate">{project.location}</span>
                </p>
              )}
              {project.created_at && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{formatDateDDMMYYYY(project.created_at)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Arrow */}
        <div className="w-8 h-8 rounded-full bg-[#F7F9FC] text-[#082F60] flex items-center justify-center shrink-0">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

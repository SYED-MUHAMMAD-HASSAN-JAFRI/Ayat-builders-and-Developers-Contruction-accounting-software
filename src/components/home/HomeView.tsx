import React from 'react';
import { Project } from '../../types';
import { ProjectCard } from '../projects/ProjectCard';
import { AYAT_LOGO_PATH } from '../common/Header';
import bannerBgImg from '../../assets/images/construction_banner_bg_1794731271078.jpg';
import { Building2, ChevronRight, Plus } from 'lucide-react';

interface HomeViewProps {
  projects: Project[];
  onSelectProject: (projectId: number) => void;
  onOpenNewProject: () => void;
  onNavigateToProjects: () => void;
}

export function HomeView({
  projects,
  onSelectProject,
  onOpenNewProject,
  onNavigateToProjects,
}: HomeViewProps) {
  return (
    <div className="space-y-5 pb-20">
      {/* Section 2: AYAT Builders Branding Banner (Separate section below header) */}
      <section
        aria-label="AYAT Builders & Developers Branding Banner"
        className="relative rounded-2xl overflow-hidden shadow-sm border border-[#164B8A]/20 bg-[#082F60]"
      >
        {/* Background Construction Photograph */}
        <img
          src={bannerBgImg}
          alt="Modern construction site with tower crane"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Navy-blue Contrast Overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#082F60]/92 via-[#082F60]/82 to-[#164B8A]/65"
        />

        {/* Banner Foreground Content */}
        <div className="relative z-10 px-4 py-5 sm:px-7 sm:py-7 flex items-center gap-4 sm:gap-6">
          {/* Official Uploaded Company Logo */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white p-2 shadow-md flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={AYAT_LOGO_PATH}
              alt="AYAT Builders & Developers Official Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Company Branding Text */}
          <div className="min-w-0 flex-1 text-white">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-tight text-white">
              AYAT BUILDERS
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#EAF2FC] mt-0.5">
              Builders &amp; Developers
            </p>
            <p className="text-[11px] sm:text-xs text-slate-200/90 mt-1.5 leading-snug">
              Building Dreams. Managing Progress.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Construction Projects List */}
      <section aria-label="Your Projects" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#EAF2FC] text-[#082F60] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-[#172B4D] text-sm sm:text-base tracking-tight">
              Your Projects
            </h2>
          </div>

          <button
            type="button"
            onClick={onNavigateToProjects}
            className="min-h-[40px] px-2 text-xs font-semibold text-[#164B8A] hover:text-[#082F60] flex items-center gap-0.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {projects.length === 0 ? (
            <div className="md:col-span-2 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
              <p className="text-sm font-semibold text-[#172B4D]">No projects yet</p>
              <p className="text-xs text-[#64748B]">
                Tap "+ Add New Project" below to create your first construction site.
              </p>
            </div>
          ) : (
            projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => onSelectProject(p.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Section 4: Prominent Add New Project Button */}
      <div className="pt-1">
        <button
          id="home-add-project-btn"
          type="button"
          onClick={onOpenNewProject}
          className="w-full min-h-[48px] py-3.5 px-5 bg-[#082F60] hover:bg-[#164B8A] text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Add New Project</span>
        </button>
      </div>
    </div>
  );
}

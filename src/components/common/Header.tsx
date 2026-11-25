import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Users, ChevronDown } from 'lucide-react';
import { NavTab } from './BottomNav';

export const AYAT_LOGO_PATH = '/assets/aistudio/WhatsApp_Image_2026-11-08_at_13.08.22__1__da5ad8c6.jpeg';

interface HeaderProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  onOpenUserManagement?: () => void;
}

export function Header({ activeTab, onTabChange, onOpenUserManagement }: HeaderProps) {
  const { user, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: { id: NavTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'projects', label: 'Projects' },
    { id: 'contractors', label: 'Contractors' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#082F60] text-white border-b border-[#164B8A]/60 shadow-xs">
      <div className="max-w-5xl mx-auto px-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-4 sm:gap-8 h-14">
          {/* Zone 1: Brand Wordmark & Actual Logo */}
          <button
            type="button"
            onClick={() => onTabChange?.('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EAF2FC] rounded-lg py-1"
          >
            <div className="w-9 h-9 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              <img
                src={AYAT_LOGO_PATH}
                alt="AYAT Builders & Developers"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-white text-sm sm:text-base tracking-tight whitespace-nowrap shrink-0">
              AYAT BUILDERS
            </span>
          </button>

          {/* Zone 2: Desktop Single-Line Nav Links */}
          {onTabChange && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                      isActive
                        ? 'text-white border-[#EAF2FC] font-semibold'
                        : 'text-slate-300 border-transparent hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: User Profile / Admin Access */}
          <div className="relative shrink-0">
            <button
              id="user-menu-btn"
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 min-h-[40px] py-1.5 px-2.5 rounded-lg bg-[#164B8A]/80 hover:bg-[#164B8A] border border-white/15 text-white text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0"
            >
              <div className="w-6 h-6 rounded-full bg-[#EAF2FC] text-[#082F60] flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="font-semibold text-xs max-w-[100px] truncate">
                {user?.name || (isAdmin ? 'Admin' : 'User')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-200 shrink-0" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-sm text-[#172B4D]">
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#172B4D] text-xs truncate">{user?.name}</p>
                      <span className="text-[11px] font-semibold text-[#164B8A]">
                        {isAdmin ? 'Admin' : 'User'}
                      </span>
                    </div>
                    <p className="text-[#64748B] text-[11px] truncate mt-0.5">@{user?.username}</p>
                  </div>

                  {isAdmin && onOpenUserManagement && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenUserManagement();
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#F7F9FC] flex items-center gap-2 text-[#172B4D] text-xs font-medium transition-colors"
                    >
                      <Users className="w-4 h-4 text-[#164B8A]" />
                      <span>Manage Users</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-red-50 flex items-center gap-2 text-red-600 text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

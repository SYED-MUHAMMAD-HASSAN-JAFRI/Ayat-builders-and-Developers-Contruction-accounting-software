import React, { useState } from 'react';
import {
  Home as HomeIcon,
  FolderKanban,
  Users,
  BarChart3,
  Plus,
  Receipt,
  CreditCard,
  FileSignature,
  ArrowDownLeft,
  RotateCcw,
  X,
} from 'lucide-react';

export type NavTab = 'home' | 'projects' | 'contractors' | 'reports';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenAddExpense: () => void;
  onOpenAddPayment: () => void;
  onOpenAddTheka: () => void;
  onOpenAddIncome: () => void;
  onOpenAddMaterialReturn: () => void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  onOpenAddExpense,
  onOpenAddPayment,
  onOpenAddTheka,
  onOpenAddIncome,
  onOpenAddMaterialReturn,
}: BottomNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="max-w-md mx-auto px-3 flex items-center justify-around h-14">
          {/* Home */}
          <button
            id="nav-home"
            type="button"
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              activeTab === 'home' ? 'text-[#082F60] font-bold' : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <HomeIcon className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Home</span>
          </button>

          {/* Projects */}
          <button
            id="nav-projects"
            type="button"
            onClick={() => onTabChange('projects')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              activeTab === 'projects' ? 'text-[#082F60] font-bold' : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <FolderKanban className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Projects</span>
          </button>

          {/* Prominent + Add Action */}
          <div className="flex items-center justify-center w-16">
            <button
              id="nav-add-btn"
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Add Transaction"
              className="w-11 h-11 rounded-full bg-[#082F60] hover:bg-[#164B8A] text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Contractors */}
          <button
            id="nav-contractors"
            type="button"
            onClick={() => onTabChange('contractors')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              activeTab === 'contractors' ? 'text-[#082F60] font-bold' : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Contractors</span>
          </button>

          {/* Reports */}
          <button
            id="nav-reports"
            type="button"
            onClick={() => onTabChange('reports')}
            className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${
              activeTab === 'reports' ? 'text-[#082F60] font-bold' : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span className="text-[11px]">Reports</span>
          </button>
        </div>
      </nav>

      {/* Quick Add Action Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet Container */}
          <div className="relative bg-white rounded-t-2xl border-t border-slate-200 p-5 max-w-md w-full mx-auto shadow-xl z-10 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Entry</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Add Expense */}
              <button
                id="quick-add-expense-btn"
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAddExpense();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-2">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Add Expense</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Material, Contractor, or General
                </span>
              </button>

              {/* Add Payment */}
              <button
                id="quick-add-payment-btn"
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAddPayment();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Contractor Expense</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Pay contractor contract balance
                </span>
              </button>

              {/* Add Contract */}
              <button
                id="quick-add-theka-btn"
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAddTheka();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                  <FileSignature className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Add Contract</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Contract commitment with contractor
                </span>
              </button>

              {/* Add Recovery */}
              <button
                id="quick-add-income-btn"
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAddIncome();
                }}
                className="flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-left transition-all active:scale-[0.98]"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Add Recovery</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Client advance or installment
                </span>
              </button>

              {/* Return Material */}
              <button
                id="quick-add-return-btn"
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onOpenAddMaterialReturn();
                }}
                className="col-span-2 flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EAF2FC] hover:border-sky-300 text-left transition-all active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#EAF2FC] text-[#082F60] flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm block">Return Material</span>
                  <span className="text-[11px] text-slate-500 block">
                    Record returned materials to deduct from net cost
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

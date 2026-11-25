import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  ProjectSummary,
  Expense,
  Contract,
  ContractPayment,
  Income,
  ActivityItem,
  Material,
  MaterialReturn,
} from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectSummaryCard } from './ProjectSummaryCard';
import { IncomeHistorySection } from './IncomeHistorySection';
import { ActivityFeed } from '../common/ActivityFeed';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { formatCurrency } from '../../shared/calculations';
import { formatDateDDMMYYYY } from '../../shared/dates';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  MapPin,
  Receipt,
  CreditCard,
  FileSignature,
  ArrowDownLeft,
  Search,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface ProjectDashboardProps {
  projectId: number;
  refreshKey?: number;
  onIncomeChanged?: () => void;
  onBack: () => void;
  onOpenAddExpense: (
    projectId: number,
    defaultCategory?: 'Material' | 'Other' | 'Contractor',
    defaultContractorId?: number,
    defaultContractId?: number
  ) => void;
  onOpenAddTheka: (projectId: number) => void;
  onOpenAddIncome: (projectId: number) => void;
  onOpenAddMaterialReturn: (projectId: number) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: number) => void;
  onEditExpense: (expense: Expense) => void;
  onEditContract: (contract: Contract) => void;
  onEditIncome: (income: Income) => void;
  onEditMaterialReturn: (ret: MaterialReturn) => void;
}

export function ProjectDashboard({
  projectId,
  refreshKey,
  onIncomeChanged,
  onBack,
  onOpenAddExpense,
  onOpenAddTheka,
  onOpenAddIncome,
  onOpenAddMaterialReturn,
  onEditProject,
  onDeleteProject,
  onEditExpense,
  onEditContract,
  onEditIncome,
  onEditMaterialReturn,
}: ProjectDashboardProps) {
  const { isAdmin } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [materialReturns, setMaterialReturns] = useState<MaterialReturn[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  const [activeTab, setActiveTab] = useState<'activity' | 'expenses' | 'contracts' | 'income'>('activity');
  const [isLoading, setIsLoading] = useState(true);

  // Confirm delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'expense' | 'material_return' | 'contract' | 'payment';
    id: number;
    title: string;
    message: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters for expenses tab
  const [searchMaterial, setSearchMaterial] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Material' | 'Other' | 'Contractor'>('All');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [
        projData,
        actData,
        expData,
        payData,
        returnData,
        materialData,
        conData,
        incData,
      ] = await Promise.all([
        api.getProject(projectId),
        api.getProjectActivity(projectId),
        api.getExpenses({ projectId }),
        api.getPayments({ projectId }),
        api.getMaterialReturns({ projectId }),
        api.getMaterials(),
        api.getContracts(projectId),
        api.getIncomes(projectId),
      ]);

      setProject(projData.project);
      setSummary(projData.summary);
      setActivity(actData);
      setExpenses(expData);
      setPayments(payData);
      setMaterialReturns(returnData);
      setMaterials(materialData);
      setContracts(conData);
      setIncomes(incData);
    } catch (err) {
      console.error('Error loading project dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId, refreshKey]);

  const requestDeleteExpense = (id: number) => {
    setDeleteTarget({
      type: 'expense',
      id,
      title: 'Delete Expense?',
      message: 'This will permanently delete this expense record and update project totals.',
    });
  };

  const requestDeleteMaterialReturn = (id: number) => {
    setDeleteTarget({
      type: 'material_return',
      id,
      title: 'Delete Material Return?',
      message:
        'Removing this material return will restore the deducted amount back into Net Material Expense.',
    });
  };

  const requestDeleteContract = (id: number) => {
    setDeleteTarget({
      type: 'contract',
      id,
      title: 'Delete Contract?',
      message: 'This will delete this contract and all payments associated with it.',
    });
  };

  const requestDeletePayment = (id: number) => {
    setDeleteTarget({
      type: 'payment',
      id,
      title: 'Delete Contractor Expense?',
      message: 'Removing this contractor payment will reduce Total Project Cost and restore the contractor outstanding balance.',
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'expense') {
        await api.deleteExpense(deleteTarget.id);
      } else if (deleteTarget.type === 'material_return') {
        await api.deleteMaterialReturn(deleteTarget.id);
      } else if (deleteTarget.type === 'contract') {
        await api.deleteContract(deleteTarget.id);
      } else if (deleteTarget.type === 'payment') {
        await api.deletePayment(deleteTarget.id);
      }
      setDeleteTarget(null);
      await loadAll();
      if (onIncomeChanged) {
        onIncomeChanged();
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteIncome = async (id: number) => {
    await api.deleteIncome(id);
    await loadAll();
    if (onIncomeChanged) {
      onIncomeChanged();
    }
  };

  // Unique material names across catalog, expenses, and material returns
  const materialFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach((m) => {
      const trimmed = m.name.trim();
      if (trimmed) map.set(trimmed.toLowerCase(), trimmed);
    });
    expenses
      .filter((e) => e.category === 'Material')
      .forEach((e) => {
        const trimmed = (e.material_name || '').trim();
        if (trimmed && !map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      });
    materialReturns.forEach((r) => {
      const trimmed = (r.material_name || '').trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), trimmed);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [materials, expenses, materialReturns]);

  // Filtered expenses (Material + Other/General)
  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'Contractor') return [];
    return expenses.filter((e) => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
      if (materialFilter !== 'All') {
        if ((e.material_name || '').trim().toLowerCase() !== materialFilter.toLowerCase()) {
          return false;
        }
      }
      if (fromDate && e.expense_date < fromDate) return false;
      if (toDate && e.expense_date > toDate) return false;
      if (searchMaterial.trim()) {
        const q = searchMaterial.toLowerCase();
        const match =
          e.material_name.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, materialFilter, fromDate, toDate, searchMaterial]);

  // Filtered contractor payments (Contractor Expense)
  const filteredPayments = useMemo(() => {
    if (categoryFilter !== 'All' && categoryFilter !== 'Contractor') return [];
    if (materialFilter !== 'All') return [];
    return payments.filter((p) => {
      if (fromDate && p.payment_date < fromDate) return false;
      if (toDate && p.payment_date > toDate) return false;
      if (searchMaterial.trim()) {
        const q = searchMaterial.toLowerCase();
        const match =
          (p.contractor_name && p.contractor_name.toLowerCase().includes(q)) ||
          (p.work_title && p.work_title.toLowerCase().includes(q)) ||
          (p.payment_method && p.payment_method.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [payments, categoryFilter, materialFilter, fromDate, toDate, searchMaterial]);

  // Filtered material returns
  const filteredReturns = useMemo(() => {
    if (categoryFilter === 'Other' || categoryFilter === 'Contractor') return [];
    return materialReturns.filter((r) => {
      if (materialFilter !== 'All') {
        if ((r.material_name || '').trim().toLowerCase() !== materialFilter.toLowerCase()) {
          return false;
        }
      }
      if (fromDate && r.return_date < fromDate) return false;
      if (toDate && r.return_date > toDate) return false;
      if (searchMaterial.trim()) {
        const q = searchMaterial.toLowerCase();
        const match =
          r.material_name.toLowerCase().includes(q) ||
          (r.recipient_name && r.recipient_name.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [materialReturns, categoryFilter, materialFilter, fromDate, toDate, searchMaterial]);

  const totalGrossFiltered = useMemo(() => {
    const expTotal = filteredExpenses.reduce(
      (sum, e) => sum + Number(e.calculated_amount ?? e.amount ?? 0),
      0
    );
    const payTotal = filteredPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return expTotal + payTotal;
  }, [filteredExpenses, filteredPayments]);

  const totalReturnedFiltered = useMemo(
    () => filteredReturns.reduce((sum, r) => sum + Number(r.return_amount || 0), 0),
    [filteredReturns]
  );

  const netExpenseFiltered = Math.max(0, totalGrossFiltered - totalReturnedFiltered);

  const combinedExpenseFeed = useMemo(() => {
    const expItems = filteredExpenses.map((e) => ({
      kind: 'expense' as const,
      date: e.expense_date,
      id: e.id,
      item: e,
    }));
    const payItems = filteredPayments.map((p) => ({
      kind: 'payment' as const,
      date: p.payment_date,
      id: p.id,
      item: p,
    }));
    const retItems = filteredReturns.map((r) => ({
      kind: 'material_return' as const,
      date: r.return_date,
      id: r.id,
      item: r,
    }));
    return [...expItems, ...payItems, ...retItems].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.id - a.id;
    });
  }, [filteredExpenses, filteredPayments, filteredReturns]);

  const hasActiveFilters =
    searchMaterial.trim() !== '' ||
    materialFilter !== 'All' ||
    categoryFilter !== 'All' ||
    fromDate !== '' ||
    toDate !== '';

  const resetFilters = () => {
    setSearchMaterial('');
    setMaterialFilter('All');
    setCategoryFilter('All');
    setFromDate('');
    setToDate('');
  };

  if (isLoading || !project || !summary) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        <div className="animate-spin w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full mx-auto mb-2" />
        Loading project details...
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shrink-0"
            aria-label="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {project.name}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 shrink-0">
                {project.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {project.location && (
                <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{project.location}</span>
                </p>
              )}
              {project.created_at && (
                <span className="text-[11px] text-slate-400">
                  Created: {formatDateDDMMYYYY(project.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons: Edit & Delete only (Plots/Khatas removed) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEditProject(project)}
            title="Edit Project"
            className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onDeleteProject(project.id)}
              title="Delete Project"
              className="px-2.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Action Buttons (Above Summary Cards): Add Contract | Add Recovery | Return Material */}
      <div className="grid grid-cols-3 gap-2">
        <button
          id="project-add-contract-btn"
          type="button"
          onClick={() => onOpenAddTheka(project.id)}
          className="py-2.5 px-2 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-colors text-center"
        >
          <FileSignature className="w-4 h-4 shrink-0" />
          <span>Add Contract</span>
        </button>

        <button
          id="project-add-recovery-btn"
          type="button"
          onClick={() => onOpenAddIncome(project.id)}
          className="py-2.5 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-colors text-center"
        >
          <ArrowDownLeft className="w-4 h-4 shrink-0" />
          <span>Add Recovery</span>
        </button>

        <button
          id="project-return-material-btn"
          type="button"
          onClick={() => onOpenAddMaterialReturn(project.id)}
          className="py-2.5 px-2 sm:px-3 bg-[#082F60] hover:bg-[#164B8A] text-white rounded-xl text-[11px] sm:text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-colors text-center"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>Return Material</span>
        </button>
      </div>

      {/* Project Financial Summary Cards (Total Project Cost & Outstanding Amount) */}
      <ProjectSummaryCard summary={summary} />

      {/* Prominent Add Expense Action Below Summary Cards */}
      <button
        id="project-add-expense-btn"
        type="button"
        onClick={() => onOpenAddExpense(project.id)}
        className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
      >
        <Receipt className="w-4 h-4 shrink-0" />
        <span>Add Expense</span>
      </button>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Activity Feed ({activity.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`py-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'expenses'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Expenses & Returns ({expenses.length + payments.length + materialReturns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`py-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'contracts'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Contracts ({contracts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`py-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'income'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Recovery History ({incomes.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {/* TAB 1: Activity Feed */}
          {activeTab === 'activity' && (
            <ActivityFeed
              activities={activity}
              emptyMessage="No activity yet. Tap Add Expense or Add Contract to record the first entry."
              onEditExpense={(id) => {
                const exp = expenses.find((e) => e.id === id);
                if (exp) onEditExpense(exp);
              }}
              onDeleteExpense={requestDeleteExpense}
              onEditMaterialReturn={(id) => {
                const ret = materialReturns.find((r) => r.id === id);
                if (ret) onEditMaterialReturn(ret);
              }}
              onDeleteMaterialReturn={requestDeleteMaterialReturn}
              onDeletePayment={requestDeletePayment}
              onDeleteIncome={handleDeleteIncome}
            />
          )}

          {/* TAB 2: Expenses & Material Returns with Material-Wise Filtering */}
          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {/* Filter controls */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search material, contractor or notes..."
                      value={searchMaterial}
                      onChange={(e) => setSearchMaterial(e.target.value)}
                      className="w-full py-2 pl-8 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <select
                    id="expense-material-filter"
                    value={materialFilter}
                    onChange={(e) => setMaterialFilter(e.target.value)}
                    className="py-2 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
                  >
                    <option value="All">All Materials</option>
                    {materialFilterOptions.map((mName) => (
                      <option key={mName} value={mName}>
                        {mName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as 'All' | 'Material' | 'Other' | 'Contractor')
                    }
                    className="py-2 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                  >
                    <option value="All">All Categories</option>
                    <option value="Material">Material Only</option>
                    <option value="Other">Other / General</option>
                    <option value="Contractor">Contractor Expense</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                      From Date{fromDate ? ` (${formatDateDDMMYYYY(fromDate)})` : ''}
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                      To Date{toDate ? ` (${formatDateDDMMYYYY(toDate)})` : ''}
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full py-1.5 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-[11px] font-semibold text-[#164B8A] hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Gross Expenses / Returns / Net Expense Summary Strip */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#F7F9FC] border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Outflow ({filteredExpenses.length + filteredPayments.length})
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(totalGrossFiltered)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#164B8A] block">
                    Returned ({filteredReturns.length})
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#164B8A] tabular-nums">
                    - {formatCurrency(totalReturnedFiltered)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                    Net Cost
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#082F60] tabular-nums">
                    {formatCurrency(netExpenseFiltered)}
                  </span>
                </div>
              </div>

              {/* Combined Expenses, Contractor Payments & Returns Items */}
              {combinedExpenseFeed.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No matching expenses, contractor payments, or material returns found.
                </div>
              ) : (
                <div className="space-y-2">
                  {combinedExpenseFeed.map((entry) => {
                    if (entry.kind === 'payment') {
                      const pay = entry.item;
                      return (
                        <div
                          key={`payment-${pay.id}`}
                          className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">
                                {pay.contractor_name || 'Contractor'}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Contractor Expense
                              </span>
                              {pay.work_title && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                                  {pay.work_title}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                              <span>{formatDateDDMMYYYY(pay.payment_date)}</span>
                              {pay.payment_method && (
                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium">
                                  {pay.payment_method}
                                </span>
                              )}
                              {pay.notes && <span className="italic">"{pay.notes}"</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-emerald-900 tabular-nums">
                              {formatCurrency(pay.amount)}
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => requestDeletePayment(pay.id)}
                                className="text-[11px] font-medium text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (entry.kind === 'material_return') {
                      const ret = entry.item;
                      return (
                        <div
                          key={`return-${ret.id}`}
                          className="p-3 bg-[#EAF2FC]/50 border border-sky-200 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#082F60] text-sm">
                                {ret.material_name}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAF2FC] text-[#082F60] border border-sky-300">
                                Material Return
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                                To: {ret.returned_to}
                                {ret.recipient_name ? ` (${ret.recipient_name})` : ''}
                              </span>
                            </div>

                            {ret.quantity != null && Number(ret.quantity) > 0 && (
                              <p className="text-xs text-slate-600 mt-0.5">
                                Returned Qty: {ret.quantity} {ret.unit || 'units'}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                              <span>{formatDateDDMMYYYY(ret.return_date)}</span>
                              {ret.plot_name && (
                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium">
                                  {ret.plot_name}
                                </span>
                              )}
                              {ret.notes && <span className="italic">"{ret.notes}"</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-[#164B8A] tabular-nums">
                              - {formatCurrency(ret.return_amount)}
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => onEditMaterialReturn(ret)}
                                className="text-[11px] font-medium text-sky-600 hover:text-sky-800"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteMaterialReturn(ret.id)}
                                className="text-[11px] font-medium text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const exp = entry.item;
                    return (
                      <div
                        key={`expense-${exp.id}`}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {exp.material_name}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                exp.category === 'Material'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {exp.category}
                            </span>
                          </div>

                          {exp.quantity && exp.rate && (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {exp.quantity} {exp.unit || 'units'} @ Rs.{' '}
                              {Number(exp.rate).toLocaleString()}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span>{formatDateDDMMYYYY(exp.expense_date)}</span>
                            {exp.plot_name && (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                {exp.plot_name}
                              </span>
                            )}
                            {exp.khata_name && (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                {exp.khata_name}
                              </span>
                            )}
                            {exp.notes && <span className="italic">"{exp.notes}"</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatCurrency(exp.calculated_amount || exp.amount)}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => onEditExpense(exp)}
                              className="text-[11px] font-medium text-sky-600 hover:text-sky-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteExpense(exp.id)}
                              className="text-[11px] font-medium text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Contracts */}
          {activeTab === 'contracts' && (
            <div className="space-y-3">
              {contracts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No contracts yet. Click "Add Contract" above to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {contracts.map((c) => {
                    const amt = Number(c.contract_amount);
                    const paid = Number(c.paid_amount || 0);
                    const outstanding = Number(c.outstanding_amount || 0);
                    const percentPaid = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0;
                    const isFullyPaid = outstanding <= 0;

                    return (
                      <div
                        key={c.id}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                                {c.contractor_name}
                              </h4>
                              {c.contract_type && (
                                <span className="text-[11px] bg-[#EAF2FC] text-[#082F60] border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                                  {c.contract_type}
                                </span>
                              )}
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                                {c.work_title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                              {(c.contract_date || c.created_at) && (
                                <span>Date: {formatDateDDMMYYYY(c.contract_date || c.created_at)}</span>
                              )}
                              {c.contractor_phone && <span>Phone: {c.contractor_phone}</span>}
                            </div>
                            {c.notes && (
                              <p className="text-xs text-slate-500 italic mt-0.5">
                                "{c.notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditContract(c)}
                              className="p-1.5 text-slate-400 hover:text-slate-700"
                              title="Edit contract"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteContract(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600"
                              title="Delete contract"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Financial Ledger Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Paid: {percentPaid}%</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              Total: {formatCurrency(amt)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${percentPaid}%` }}
                            />
                          </div>
                        </div>

                        {/* Numbers breakdown */}
                        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100 text-xs">
                          <div className="p-1.5 bg-slate-50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Contract Amount</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {formatCurrency(amt)}
                            </span>
                          </div>
                          <div className="p-1.5 bg-emerald-50 rounded-lg">
                            <span className="text-[10px] text-emerald-700 block">Paid</span>
                            <span className="font-bold text-emerald-800 tabular-nums">
                              {formatCurrency(paid)}
                            </span>
                          </div>
                          <div className="p-1.5 bg-amber-50 rounded-lg">
                            <span className="text-[10px] text-amber-700 block">Outstanding</span>
                            <span
                              className={`font-bold tabular-nums ${
                                outstanding > 0 ? 'text-amber-800' : 'text-slate-600'
                              }`}
                            >
                              {formatCurrency(outstanding)}
                            </span>
                          </div>
                        </div>

                        {/* Pay Button Action — opens Add Expense preselected on Contractor */}
                        {!isFullyPaid ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenAddExpense(project.id, 'Contractor', c.contractor_id, c.id)
                            }
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Record Contractor Expense (Due: {formatCurrency(outstanding)})</span>
                          </button>
                        ) : (
                          <div className="py-1.5 px-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Fully Paid (Outstanding: Rs. 0)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Recovery History */}
          {activeTab === 'income' && (
            <IncomeHistorySection
              projectId={projectId}
              projectName={project.name}
              incomes={incomes}
              onOpenAddIncome={() => onOpenAddIncome(project.id)}
              onEditIncome={onEditIncome}
              onDeleteIncome={handleDeleteIncome}
            />
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Expense / Material Return / Contract / Payment */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={deleteTarget?.title || ''}
        message={deleteTarget?.message || ''}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onClose={() => !isDeleting && setDeleteTarget(null)}
      />
    </div>
  );
}


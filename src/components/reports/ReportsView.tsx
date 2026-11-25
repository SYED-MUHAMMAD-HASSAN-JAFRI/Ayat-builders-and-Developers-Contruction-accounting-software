import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../shared/calculations';
import { addDaysISO, formatDateDDMMYYYY, getTodayISO } from '../../shared/dates';
import {
  FileText,
  Calendar,
  Layers,
  Users,
  AlertTriangle,
  TrendingUp,
  Printer,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface ReportsViewProps {
  projects: Project[];
  refreshKey?: number;
}

type ReportType =
  | 'project_expense'
  | 'daily_expense'
  | 'materials'
  | 'contractors'
  | 'outstanding'
  | 'income_vs_expense';

export function ReportsView({ projects, refreshKey }: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>('project_expense');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayISO());
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectReportType = (type: ReportType) => {
    setReportType(type);
    setReportData(null);
  };

  const changeDateByDays = (days: number) => {
    setSelectedDate((prev) => addDaysISO(prev || getTodayISO(), days));
  };

  const setTodayDate = () => {
    setSelectedDate(getTodayISO());
  };

  const fetchReport = async () => {
    setIsLoading(true);
    setReportData(null);
    const pId = selectedProjectId !== 'all' ? Number(selectedProjectId) : undefined;
    try {
      if (reportType === 'project_expense') {
        const data = await api.getProjectExpenseReport(pId);
        setReportData(data);
      } else if (reportType === 'daily_expense') {
        const data = await api.getDailyExpenseReport(selectedDate, pId);
        setReportData(data);
      } else if (reportType === 'materials') {
        const data = await api.getMaterialsReport(pId);
        setReportData(data);
      } else if (reportType === 'contractors') {
        const data = await api.getContractorsReport(pId);
        setReportData(data);
      } else if (reportType === 'outstanding') {
        const data = await api.getOutstandingReport();
        setReportData(data);
      } else if (reportType === 'income_vs_expense') {
        const data = await api.getIncomeVsExpenseReport(pId);
        setReportData(data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedProjectId, selectedDate, refreshKey]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Title & Print Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Financial Reports</h2>
          <p className="text-xs text-slate-500">Accounting breakdowns and site supervisor audits</p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Print / Export</span>
        </button>
      </div>

      {/* Report Selection Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'project_expense', label: '1. Project Cost', icon: FileText },
          { id: 'daily_expense', label: '2. Daily Expense', icon: Calendar },
          { id: 'materials', label: '3. Materials', icon: Layers },
          { id: 'contractors', label: '4. Contractors', icon: Users },
          { id: 'outstanding', label: '5. Unpaid Due', icon: AlertTriangle },
          { id: 'income_vs_expense', label: '6. Profit / Margin', icon: TrendingUp },
        ].map((tab) => {
          const isSelected = reportType === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectReportType(tab.id as ReportType)}
              className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Filter Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {reportType === 'daily_expense' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Select Date ({formatDateDDMMYYYY(selectedDate)})
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => changeDateByDays(-1)}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                  title="Previous Day"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={setTodayDate}
                  className="px-1.5 py-0.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded font-medium"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => changeDateByDays(1)}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                  title="Next Day"
                >
                  Next →
                </button>
              </div>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
            />
          </div>
        )}
      </div>

      {/* Report Data Render */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs print:border-none print:shadow-none">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="animate-spin w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full mx-auto mb-2" />
            Generating report...
          </div>
        ) : !reportData ? (
          <p className="text-xs text-slate-400 text-center py-6">No data available.</p>
        ) : (
          <div>
            {/* REPORT 1: Project Expense Report */}
            {reportType === 'project_expense' && Array.isArray(reportData) && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-2">
                  Project Expense & Cost Breakdown
                </h3>
                {reportData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No projects found. Create your first project to view cost breakdowns.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2 font-bold">Project</th>
                          <th className="py-2.5 px-2 font-bold text-right">Material Exp</th>
                          <th className="py-2.5 px-2 font-bold text-right">Other Exp</th>
                          <th className="py-2.5 px-2 font-bold text-right">Contractor Paid</th>
                          <th className="py-2.5 px-2 font-bold text-right">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.map((row: any) => (
                          <tr key={row.project_id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-2 font-bold text-slate-900">{row.project_name}</td>
                            <td className="py-2.5 px-2 text-right text-slate-700">
                              {formatCurrency(row.material_expenses || 0)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-700">
                              {formatCurrency(row.other_expenses || 0)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-emerald-700 font-semibold">
                              {formatCurrency(row.theka_paid ?? row.contractor_paid ?? 0)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-900 font-bold">
                              {formatCurrency(row.total_project_cost || row.total_cost || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REPORT 2: Daily Expense Report */}
            {reportType === 'daily_expense' && !Array.isArray(reportData) && reportData && (() => {
              const expenses = Array.isArray(reportData.expenses) ? reportData.expenses : [];
              const materialReturns = Array.isArray(reportData.materialReturns) ? reportData.materialReturns : [];
              const payments = Array.isArray(reportData.payments) ? reportData.payments : [];
              const totalExpense = reportData.totalExpense ?? expenses.reduce((s: number, e: any) => s + Number(e.calculated_amount || e.amount || 0), 0);
              const totalReturns = reportData.totalReturns ?? materialReturns.reduce((s: number, r: any) => s + Number(r.return_amount || 0), 0);
              const totalPayments = reportData.totalPayments ?? payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
              const grandTotal = reportData.grandTotal ?? reportData.totalOutflow ?? Math.max(0, totalExpense - totalReturns + totalPayments);

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Daily Expense Audit — {formatDateDDMMYYYY(reportData.date || selectedDate)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Site cash outflow (Expenses − Material Returns + Contractor Payments)
                      </p>
                    </div>
                    <div className="self-start sm:self-auto bg-sky-50 text-sky-900 border border-sky-200 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums">
                      Net Outflow: {formatCurrency(grandTotal)}
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Gross Expenses
                      </span>
                      <span className="text-base font-extrabold text-slate-900 block mt-0.5 tabular-nums">
                        {formatCurrency(totalExpense)}
                      </span>
                      <span className="text-[11px] text-slate-500">{expenses.length} record(s)</span>
                    </div>

                    <div className="p-3 bg-[#EAF2FC]/70 border border-sky-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-[#164B8A] tracking-wider block">
                        Material Returns
                      </span>
                      <span className="text-base font-extrabold text-[#082F60] block mt-0.5 tabular-nums">
                        - {formatCurrency(totalReturns)}
                      </span>
                      <span className="text-[11px] text-[#164B8A]">{materialReturns.length} return(s)</span>
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                        Contractor Payouts
                      </span>
                      <span className="text-base font-extrabold text-emerald-900 block mt-0.5 tabular-nums">
                        {formatCurrency(totalPayments)}
                      </span>
                      <span className="text-[11px] text-emerald-700">{payments.length} payout(s)</span>
                    </div>

                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider block">
                        Net Outflow
                      </span>
                      <span className="text-base font-extrabold text-indigo-900 block mt-0.5 tabular-nums">
                        {formatCurrency(grandTotal)}
                      </span>
                      <span className="text-[11px] text-indigo-700">
                        For {formatDateDDMMYYYY(reportData.date || selectedDate)}
                      </span>
                    </div>
                  </div>

                  {/* Material / General Expenses Breakdown */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        1. Material & General Expenses ({expenses.length})
                      </h4>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">{formatCurrency(totalExpense)}</span>
                    </div>

                    {expenses.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2.5 px-3 bg-slate-50 rounded-lg italic">
                        No material or general site expenses recorded on this date.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {expenses.map((e: any) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg text-xs transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900">
                                  {e.material_name || e.notes || 'Expense'}
                                </span>
                                <span className="text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {e.project_name || 'Project'}
                                </span>
                                {e.category && e.category !== 'Material' && (
                                  <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    {e.category}
                                  </span>
                                )}
                              </div>
                              {(e.quantity || e.notes) && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {e.quantity ? `${e.quantity} ${e.unit || ''} ${e.rate ? `@ Rs. ${e.rate}` : ''}` : ''}
                                  {e.quantity && e.notes ? ' • ' : ''}
                                  {e.notes || ''}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 whitespace-nowrap text-right tabular-nums">
                              {formatCurrency(e.calculated_amount ?? e.amount ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Material Returns Breakdown */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        2. Material Returns ({materialReturns.length})
                      </h4>
                      <span className="text-xs font-bold text-[#164B8A] tabular-nums">
                        - {formatCurrency(totalReturns)}
                      </span>
                    </div>

                    {materialReturns.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2.5 px-3 bg-slate-50 rounded-lg italic">
                        No material returns recorded on this date.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {materialReturns.map((r: any) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-2.5 bg-[#EAF2FC]/60 rounded-lg text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#082F60]">{r.material_name}</span>
                                <span className="text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-medium">
                                  {r.project_name || 'Project'}
                                </span>
                                <span className="text-[#164B8A] bg-white px-1.5 py-0.5 rounded border border-sky-200 text-[10px] font-medium">
                                  To: {r.returned_to}{r.recipient_name ? ` (${r.recipient_name})` : ''}
                                </span>
                              </div>
                              {(r.quantity || r.notes) && (
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                  {r.quantity ? `Qty: ${r.quantity} ${r.unit || ''}` : ''}
                                  {r.quantity && r.notes ? ' • ' : ''}
                                  {r.notes || ''}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-[#164B8A] whitespace-nowrap text-right tabular-nums">
                              - {formatCurrency(r.return_amount || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contractor Payments Breakdown */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        3. Contractor Payments ({payments.length})
                      </h4>
                      <span className="text-xs font-bold text-emerald-800 tabular-nums">{formatCurrency(totalPayments)}</span>
                    </div>

                    {payments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2.5 px-3 bg-slate-50 rounded-lg italic">
                        No contractor payments recorded on this date.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {payments.map((p: any) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 bg-emerald-50/60 hover:bg-emerald-50 rounded-lg text-xs transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-emerald-950">
                                  {p.contractor_name || 'Contractor'}
                                </span>
                                <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {p.work_title || 'Contract'}
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  ({p.project_name || 'Project'})
                                </span>
                              </div>
                              {(p.payment_method || p.notes) && (
                                <div className="text-[11px] text-emerald-800/80 mt-0.5">
                                  {p.payment_method ? `Method: ${p.payment_method}` : ''}
                                  {p.payment_method && p.notes ? ' • ' : ''}
                                  {p.notes || ''}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-emerald-900 whitespace-nowrap text-right tabular-nums">
                              {formatCurrency(p.amount || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* REPORT 3: Material Report */}
            {reportType === 'materials' && Array.isArray(reportData) && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-2">
                  Material Consumption, Returns & Net Cost Report
                </h3>
                {reportData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No material expenses recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2 font-bold">Material</th>
                          <th className="py-2.5 px-2 font-bold text-right">Purchased</th>
                          <th className="py-2.5 px-2 font-bold text-right">Returned</th>
                          <th className="py-2.5 px-2 font-bold text-center">Net Qty</th>
                          <th className="py-2.5 px-2 font-bold text-right">Net Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.map((m: any, idx: number) => {
                          const purchasedCost = m.purchased_cost ?? m.total_cost ?? 0;
                          const returnedCost = m.returned_cost ?? 0;
                          const netCost = m.net_cost ?? m.total_cost ?? 0;
                          const netQty = m.total_quantity ?? m.quantity ?? 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-2 font-bold text-slate-900">
                                {m.material_name || m.material || 'Material'}
                                <span className="block text-[10px] font-normal text-slate-400">
                                  {m.entries_count || 0} purchase(s)
                                  {(m.returns_count || 0) > 0 ? `, ${m.returns_count} return(s)` : ''}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-700 tabular-nums">
                                {formatCurrency(purchasedCost)}
                              </td>
                              <td className="py-2.5 px-2 text-right text-[#164B8A] tabular-nums">
                                {returnedCost > 0 ? `- ${formatCurrency(returnedCost)}` : '—'}
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-700 font-medium">
                                {netQty ? `${netQty} ${m.unit || ''}` : '—'}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-slate-900 tabular-nums">
                                {formatCurrency(netCost)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REPORT 4: Contractor Report */}
            {reportType === 'contractors' && Array.isArray(reportData) && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-2">
                  Contractor Financial Overview
                </h3>
                {reportData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No contractors or contracts recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2 font-bold">Contractor</th>
                          <th className="py-2.5 px-2 font-bold">Specialty</th>
                          <th className="py-2.5 px-2 font-bold text-right">Contract Total</th>
                          <th className="py-2.5 px-2 font-bold text-right">Total Paid</th>
                          <th className="py-2.5 px-2 font-bold text-right">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.map((c: any) => (
                          <tr key={c.contract_id || c.id || Math.random()} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-2 font-bold text-slate-900">
                              {c.contractor_name || c.name}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600">
                              {c.type_name || c.contractor_type || 'Contractor'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-slate-800">
                              {formatCurrency(c.total_contracts_amount || c.contract_amount || 0)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-emerald-700 font-semibold">
                              {formatCurrency(c.total_paid || 0)}
                            </td>
                            <td
                              className={`py-2.5 px-2 text-right font-bold ${
                                (c.outstanding || 0) > 0 ? 'text-amber-700' : 'text-slate-600'
                              }`}
                            >
                              {formatCurrency(c.outstanding || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REPORT 5: Outstanding Balance Report */}
            {reportType === 'outstanding' && Array.isArray(reportData) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Contractors With Unpaid Balances</span>
                  </h3>
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">
                    {reportData.length} pending
                  </span>
                </div>

                {reportData.length === 0 ? (
                  <div className="text-center py-6 text-emerald-700 font-semibold text-xs bg-emerald-50 rounded-xl">
                    No unpaid contractor balances! Outstanding balance is Rs. 0.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reportData.map((c: any) => {
                      const name = c.name || c.contractor?.name || 'Contractor';
                      const typeName = c.type_name || c.contractor?.type_name;
                      const phone = c.phone || c.contractor?.phone;
                      const due = c.outstanding || 0;
                      return (
                        <div
                          key={c.id || c.contractor?.id}
                          className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{name}</span>
                            {typeName && <span className="text-indigo-700 ml-2 font-medium">({typeName})</span>}
                            {phone && <span className="text-slate-500 ml-2">Phone: {phone}</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-amber-800 block">
                              Unpaid Due
                            </span>
                            <span className="text-sm font-extrabold text-amber-900">
                              {formatCurrency(due)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* REPORT 6: Income vs Expense Report */}
            {reportType === 'income_vs_expense' && Array.isArray(reportData) && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-2">
                  Project Recovery vs Expense &amp; Net Margin
                </h3>
                {reportData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No projects or financial transactions recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2 font-bold">Project</th>
                          <th className="py-2.5 px-2 font-bold text-right">Recovery</th>
                          <th className="py-2.5 px-2 font-bold text-right">Total Cost</th>
                          <th className="py-2.5 px-2 font-bold text-right">Net Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.map((row: any) => {
                          const incomeVal = row.total_income ?? row.income ?? 0;
                          const costVal = row.total_project_cost ?? row.project_cost ?? 0;
                          const netVal = row.net ?? (incomeVal - costVal);
                          return (
                            <tr key={row.project_id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-2 font-bold text-slate-900">{row.project_name}</td>
                              <td className="py-2.5 px-2 text-right text-emerald-700 font-bold">
                                {formatCurrency(incomeVal)}
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-800 font-semibold">
                                {formatCurrency(costVal)}
                              </td>
                              <td
                                className={`py-2.5 px-2 text-right font-extrabold ${
                                  netVal >= 0 ? 'text-emerald-700' : 'text-red-600'
                                }`}
                              >
                                {formatCurrency(netVal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

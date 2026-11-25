import React, { useState, useEffect } from 'react';
import { Contractor, Contract, ContractPayment } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../shared/calculations';
import { formatDateDDMMYYYY } from '../../shared/dates';
import {
  X,
  Phone,
  Edit2,
  Trash2,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSignature,
} from 'lucide-react';

interface ContractorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractorId: number;
  refreshKey?: number;
  onEditContractor: (contractor: Contractor) => void;
  onDeleteContractor: (contractorId: number) => void;
  onOpenAddPayment: (projectId: number, contractId: number) => void;
}

export function ContractorProfileModal({
  isOpen,
  onClose,
  contractorId,
  refreshKey,
  onEditContractor,
  onDeleteContractor,
  onOpenAddPayment,
}: ContractorProfileModalProps) {
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [globalSummary, setGlobalSummary] = useState<{
    totalContracts: number;
    totalContractsAmount: number;
    totalPaid: number;
    outstanding: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'thekas' | 'payments'>('thekas');

  const loadData = async () => {
    if (!contractorId) return;
    try {
      setIsLoading(true);
      const data = await api.getContractorProfile(contractorId);
      setContractor(data.contractor);
      setContracts(data.contracts);
      setPayments(data.payments);
      setGlobalSummary(data.globalSummary);
    } catch (err) {
      console.error('Failed to load contractor profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && contractorId) {
      loadData();
    }
  }, [isOpen, contractorId, refreshKey]);

  if (!isOpen || !contractorId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[92vh] flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {contractor?.name || 'Contractor Profile'}
              </h2>
              {contractor?.type_name && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {contractor.type_name}
                </span>
              )}
            </div>
            {contractor?.phone && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{contractor.phone}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {contractor && (
              <>
                <button
                  type="button"
                  onClick={() => onEditContractor(contractor)}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs"
                  title="Edit Contractor"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteContractor(contractor.id)}
                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs"
                  title="Delete Contractor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <div className="animate-spin w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full mx-auto mb-2" />
            Loading profile...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Direct Answers to User Questions: "How much have I paid?" & "How much do I owe?" */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Global Contractor Balance (All Projects)
              </span>

              <div className="grid grid-cols-2 gap-3 text-center">
                {/* Total Paid */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-xs text-slate-500 font-medium block mb-1">
                    How much have I paid this person?
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-emerald-700 block">
                    {formatCurrency(globalSummary?.totalPaid || 0)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Out of {formatCurrency(globalSummary?.totalContractsAmount || 0)} total contracts
                  </span>
                </div>

                {/* Total Owed */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-xs text-slate-500 font-medium block mb-1">
                    How much do I still owe this person?
                  </span>
                  <span
                    className={`text-lg sm:text-xl font-extrabold block ${
                      (globalSummary?.outstanding || 0) > 0 ? 'text-amber-700' : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(globalSummary?.outstanding || 0)}
                  </span>
                  <span className="text-[10px] text-slate-400">Current unpaid balance</span>
                </div>
              </div>
            </div>

            {/* Notes if any */}
            {contractor?.notes && (
              <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 italic">
                "{contractor.notes}"
              </div>
            )}

            {/* Tabs for Thekas vs Payments */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setActiveTab('thekas')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'thekas'
                      ? 'bg-white text-indigo-700 border-b-2 border-indigo-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Contracts ({contracts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    activeTab === 'payments'
                      ? 'bg-white text-indigo-700 border-b-2 border-indigo-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Payment History ({payments.length})
                </button>
              </div>

              <div className="p-3.5">
                {activeTab === 'thekas' ? (
                  <div className="space-y-3">
                    {contracts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No active contracts for this contractor.
                      </p>
                    ) : (
                      contracts.map((c) => {
                        const amt = Number(c.contract_amount);
                        const paid = Number(c.paid_amount || 0);
                        const outstanding = Number(c.outstanding_amount || 0);

                        return (
                          <div
                            key={c.id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-sky-600" />
                                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                    {c.project_name}
                                  </span>
                                </div>
                                <span className="text-xs text-indigo-700 font-semibold mt-0.5 block">
                                  {c.work_title}
                                </span>
                                {(c.contract_date || c.created_at) && (
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>{formatDateDDMMYYYY(c.contract_date || c.created_at)}</span>
                                  </span>
                                )}
                              </div>

                              {outstanding > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenAddPayment(c.project_id, c.id);
                                  }}
                                  className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span>Pay Due</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Fully Paid
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Contract Amount</span>
                                <span className="font-bold text-slate-800">
                                  {formatCurrency(amt)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-emerald-700 block">Paid</span>
                                <span className="font-bold text-emerald-800">
                                  {formatCurrency(paid)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-amber-700 block">
                                  Outstanding
                                </span>
                                <span
                                  className={`font-bold ${
                                    outstanding > 0 ? 'text-amber-800' : 'text-slate-600'
                                  }`}
                                >
                                  {formatCurrency(outstanding)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No payments recorded yet.
                      </p>
                    ) : (
                      payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{p.project_name}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              {formatDateDDMMYYYY(p.payment_date)} • {p.work_title} • Method: {p.payment_method || 'Cash'}
                            </div>
                            {p.notes && (
                              <p className="text-slate-500 italic mt-0.5">"{p.notes}"</p>
                            )}
                          </div>
                          <div className="text-right font-bold text-emerald-700 text-sm">
                            {formatCurrency(p.amount)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

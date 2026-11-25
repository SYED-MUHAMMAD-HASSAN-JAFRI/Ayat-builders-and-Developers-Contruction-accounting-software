import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Header } from './components/common/Header';
import { BottomNav, NavTab } from './components/common/BottomNav';
import { HomeView } from './components/home/HomeView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
import { ContractorsView } from './components/contractors/ContractorsView';
import { ReportsView } from './components/reports/ReportsView';

// Modals
import { AddExpenseModal } from './components/modals/AddExpenseModal';
import { AddPaymentModal } from './components/modals/AddPaymentModal';
import { AddThekaModal } from './components/modals/AddThekaModal';
import { AddIncomeModal } from './components/modals/AddIncomeModal';
import { AddMaterialReturnModal } from './components/modals/AddMaterialReturnModal';
import { ProjectModal } from './components/modals/ProjectModal';
import { ContractorModal } from './components/modals/ContractorModal';
import { ContractorProfileModal } from './components/contractors/ContractorProfileModal';
import { UserManagementModal } from './components/users/UserManagementModal';
import { ConfirmDialog } from './components/modals/ConfirmDialog';

import {
  Project,
  Contractor,
  Expense,
  Contract,
  Income,
  MaterialReturn,
  HomeOverviewData,
} from './types';
import { api } from './services/api';

function MainApp() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Core Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [homeOverview, setHomeOverview] = useState<HomeOverviewData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Modals Open State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [expenseDefaultProjectId, setExpenseDefaultProjectId] = useState<number | undefined>(undefined);
  const [expenseDefaultCategory, setExpenseDefaultCategory] = useState<'Material' | 'Other' | 'Contractor' | undefined>(undefined);
  const [expenseDefaultContractorId, setExpenseDefaultContractorId] = useState<number | undefined>(undefined);
  const [expenseDefaultContractId, setExpenseDefaultContractId] = useState<number | undefined>(undefined);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDefaultProjectId, setPaymentDefaultProjectId] = useState<number | undefined>(undefined);
  const [paymentDefaultContractId, setPaymentDefaultContractId] = useState<number | undefined>(undefined);

  const [isThekaModalOpen, setIsThekaModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [thekaDefaultProjectId, setThekaDefaultProjectId] = useState<number | undefined>(undefined);

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | null>(null);
  const [incomeDefaultProjectId, setIncomeDefaultProjectId] = useState<number | undefined>(undefined);

  const [isMaterialReturnModalOpen, setIsMaterialReturnModalOpen] = useState(false);
  const [materialReturnToEdit, setMaterialReturnToEdit] = useState<MaterialReturn | null>(null);
  const [materialReturnDefaultProjectId, setMaterialReturnDefaultProjectId] = useState<number | undefined>(undefined);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [contractorToEdit, setContractorToEdit] = useState<Contractor | null>(null);

  const [isContractorProfileOpen, setIsContractorProfileOpen] = useState(false);
  const [profileContractorId, setProfileContractorId] = useState<number | null>(null);

  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isLoading?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isLoading: false,
    onConfirm: () => {},
  });

  // Refresh key to force reload ProjectDashboard
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  // Load global data independently so partial failures never discard projects
  const loadGlobalData = useCallback(async () => {
    if (!user) return;
    setLoadError('');
    try {
      const [projsRes, contsRes, overviewRes] = await Promise.allSettled([
        api.getProjects(),
        api.getContractors(),
        api.getHomeOverview(),
      ]);
      if (projsRes.status === 'fulfilled') {
        setProjects(projsRes.value);
      } else {
        console.error('Failed to load projects:', projsRes.reason);
        setLoadError(projsRes.reason?.message || 'Failed to load projects from database.');
      }
      if (contsRes.status === 'fulfilled') {
        setContractors(contsRes.value);
      } else {
        console.error('Failed to load contractors:', contsRes.reason);
      }
      if (overviewRes.status === 'fulfilled') {
        setHomeOverview(overviewRes.value);
      } else {
        console.error('Failed to load overview:', overviewRes.reason);
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [user]);

  const refreshAllData = useCallback(async () => {
    await loadGlobalData();
    setDashboardRefreshKey((k) => k + 1);
  }, [loadGlobalData]);

  useEffect(() => {
    if (user) {
      loadGlobalData();
    } else {
      setProjects([]);
      setContractors([]);
      setHomeOverview(null);
      setSelectedProjectId(null);
      setLoadError('');
    }
  }, [user, loadGlobalData]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading Construction Accounting...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Quick Action Handlers
  const handleOpenAddExpense = (
    pId?: number,
    defaultCategory?: 'Material' | 'Other' | 'Contractor',
    defaultContractorId?: number,
    defaultContractId?: number
  ) => {
    setExpenseToEdit(null);
    setExpenseDefaultProjectId(pId || selectedProjectId || (projects[0]?.id ?? undefined));
    setExpenseDefaultCategory(defaultCategory || 'Material');
    setExpenseDefaultContractorId(defaultContractorId);
    setExpenseDefaultContractId(defaultContractId);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setExpenseDefaultProjectId(expense.project_id);
    setExpenseDefaultCategory(expense.category);
    setExpenseDefaultContractorId(undefined);
    setExpenseDefaultContractId(undefined);
    setIsExpenseModalOpen(true);
  };

  const handleOpenAddPayment = (pId?: number, contractId?: number) => {
    setPaymentDefaultProjectId(pId || selectedProjectId || (projects[0]?.id ?? undefined));
    setPaymentDefaultContractId(contractId);
    setIsPaymentModalOpen(true);
  };

  const handleOpenAddTheka = (pId?: number) => {
    setContractToEdit(null);
    setThekaDefaultProjectId(pId || selectedProjectId || (projects[0]?.id ?? undefined));
    setIsThekaModalOpen(true);
  };

  const handleEditContract = (contract: Contract) => {
    setContractToEdit(contract);
    setThekaDefaultProjectId(contract.project_id);
    setIsThekaModalOpen(true);
  };

  const handleOpenAddIncome = (pId?: number) => {
    setIncomeToEdit(null);
    setIncomeDefaultProjectId(pId || selectedProjectId || (projects[0]?.id ?? undefined));
    setIsIncomeModalOpen(true);
  };

  const handleEditIncome = (income: Income) => {
    setIncomeToEdit(income);
    setIncomeDefaultProjectId(income.project_id);
    setIsIncomeModalOpen(true);
  };

  const handleOpenAddMaterialReturn = (pId?: number) => {
    setMaterialReturnToEdit(null);
    setMaterialReturnDefaultProjectId(pId || selectedProjectId || (projects[0]?.id ?? undefined));
    setIsMaterialReturnModalOpen(true);
  };

  const handleEditMaterialReturn = (ret: MaterialReturn) => {
    setMaterialReturnToEdit(ret);
    setMaterialReturnDefaultProjectId(ret.project_id);
    setIsMaterialReturnModalOpen(true);
  };

  const handleOpenNewProject = () => {
    setProjectToEdit(null);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteProject = (projectId: number) => {
    const projectName = projects.find((p) => p.id === projectId)?.name;
    setConfirmDialog({
      isOpen: true,
      title: projectName ? `Delete "${projectName}"?` : 'Delete Project?',
      message:
        'This will permanently delete this project and all its associated expenses, contracts, payments, material returns, and income transactions. This action cannot be undone.',
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteProject(projectId);
          setSelectedProjectId(null);
          await refreshAllData();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({
            ...prev,
            isLoading: false,
            message: err.message || 'Failed to delete project. Please try again.',
          }));
        }
      },
    });
  };

  const handleOpenNewContractor = () => {
    setContractorToEdit(null);
    setIsContractorModalOpen(true);
  };

  const handleEditContractor = (contractor: Contractor) => {
    setContractorToEdit(contractor);
    setIsContractorModalOpen(true);
  };

  const handleDeleteContractor = (contractorId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Contractor?',
      message:
        'This will remove this contractor. Note that contracts already assigned to projects may still be archived or deleted.',
      onConfirm: async () => {
        try {
          await api.deleteContractor(contractorId);
          setIsContractorProfileOpen(false);
          refreshAllData();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({
            ...prev,
            message: err.message || 'Failed to delete contractor. Please try again.',
          }));
        }
      },
    });
  };

  const handleSelectContractor = (id: number) => {
    setProfileContractorId(id);
    setIsContractorProfileOpen(true);
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedProjectId(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col font-sans text-[#172B4D]">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 pt-4 pb-20">
        {loadError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold text-red-700">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={loadGlobalData}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shrink-0"
            >
              Retry
            </button>
          </div>
        )}
        {selectedProjectId ? (
          <ProjectDashboard
            projectId={selectedProjectId}
            refreshKey={dashboardRefreshKey}
            onIncomeChanged={refreshAllData}
            onBack={() => setSelectedProjectId(null)}
            onOpenAddExpense={handleOpenAddExpense}
            onOpenAddTheka={handleOpenAddTheka}
            onOpenAddIncome={handleOpenAddIncome}
            onOpenAddMaterialReturn={handleOpenAddMaterialReturn}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            onEditExpense={handleEditExpense}
            onEditContract={handleEditContract}
            onEditIncome={handleEditIncome}
            onEditMaterialReturn={handleEditMaterialReturn}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeView
                projects={projects}
                onSelectProject={(id) => setSelectedProjectId(id)}
                onOpenNewProject={handleOpenNewProject}
                onNavigateToProjects={() => setActiveTab('projects')}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView
                projects={projects}
                onSelectProject={(id) => setSelectedProjectId(id)}
                onOpenNewProject={handleOpenNewProject}
              />
            )}

            {activeTab === 'contractors' && (
              <ContractorsView
                contractors={contractors}
                onSelectContractor={handleSelectContractor}
                onOpenNewContractor={handleOpenNewContractor}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView projects={projects} refreshKey={dashboardRefreshKey} />
            )}
          </>
        )}
      </main>

      {/* Bottom Mobile-First Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenAddExpense={() => handleOpenAddExpense()}
        onOpenAddPayment={() => handleOpenAddPayment()}
        onOpenAddTheka={() => handleOpenAddTheka()}
        onOpenAddIncome={() => handleOpenAddIncome()}
        onOpenAddMaterialReturn={() => handleOpenAddMaterialReturn()}
      />

      {/* MODALS */}
      {/* 1. Add Expense Modal */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={refreshAllData}
        projects={projects}
        defaultProjectId={expenseDefaultProjectId}
        defaultCategory={expenseDefaultCategory}
        defaultContractorId={expenseDefaultContractorId}
        defaultContractId={expenseDefaultContractId}
        expenseToEdit={expenseToEdit}
      />

      {/* 2. Add Payment Modal */}
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={refreshAllData}
        projects={projects}
        defaultProjectId={paymentDefaultProjectId}
        defaultContractId={paymentDefaultContractId}
      />

      {/* 3. Add Theka Modal */}
      <AddThekaModal
        isOpen={isThekaModalOpen}
        onClose={() => setIsThekaModalOpen(false)}
        onSuccess={refreshAllData}
        projects={projects}
        defaultProjectId={thekaDefaultProjectId}
        contractToEdit={contractToEdit}
      />

      {/* 4. Add Income Modal */}
      <AddIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        onSuccess={refreshAllData}
        projects={projects}
        defaultProjectId={incomeDefaultProjectId}
        incomeToEdit={incomeToEdit}
      />

      {/* 4b. Add / Edit Material Return Modal */}
      <AddMaterialReturnModal
        isOpen={isMaterialReturnModalOpen}
        onClose={() => setIsMaterialReturnModalOpen(false)}
        onSuccess={refreshAllData}
        projects={projects}
        defaultProjectId={materialReturnDefaultProjectId}
        returnToEdit={materialReturnToEdit}
      />

      {/* 5. Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={refreshAllData}
        projectToEdit={projectToEdit}
      />

      {/* 6. Contractor Modal */}
      <ContractorModal
        isOpen={isContractorModalOpen}
        onClose={() => setIsContractorModalOpen(false)}
        onSuccess={refreshAllData}
        contractorToEdit={contractorToEdit}
      />

      {/* 7. Contractor Profile Modal */}
      {profileContractorId && (
        <ContractorProfileModal
          isOpen={isContractorProfileOpen}
          onClose={() => {
            setIsContractorProfileOpen(false);
            setProfileContractorId(null);
          }}
          contractorId={profileContractorId}
          refreshKey={dashboardRefreshKey}
          onEditContractor={handleEditContractor}
          onDeleteContractor={handleDeleteContractor}
          onOpenAddPayment={(pId, cId) => handleOpenAddPayment(pId, cId)}
        />
      )}

      {/* 9. User Management Modal (Admin) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
      />

      {/* 10. Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isLoading={Boolean(confirmDialog.isLoading)}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => !confirmDialog.isLoading && setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

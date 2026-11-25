import {
  User,
  Project,
  ProjectSummary,
  Plot,
  Khata,
  Material,
  ContractorType,
  Contractor,
  Contract,
  ContractPayment,
  Expense,
  MaterialReturn,
  Income,
  ActivityItem,
  HomeOverviewData,
} from '../types';

const TOKEN_KEY = 'construction_app_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token
    setStoredToken(null);
    window.dispatchEvent(new Event('auth_unauthorized'));
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: async (credentials: { username: string; password: string }) => {
    const data = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setStoredToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  getCurrentUser: async () => {
    return request<{ user: User }>('/auth/me');
  },

  // Users
  getUsers: async () => {
    return request<User[]>('/users');
  },

  createUser: async (userData: { username: string; password: string; role: 'admin' | 'user'; name: string }) => {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (id: number) => {
    return request<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' });
  },

  // Home
  getHomeOverview: async () => {
    return request<HomeOverviewData>('/home/overview');
  },

  // Projects
  getProjects: async () => {
    return request<Project[]>('/projects');
  },

  getProject: async (id: number) => {
    return request<{ project: Project; summary: ProjectSummary }>(`/projects/${id}`);
  },

  createProject: async (data: {
    name: string;
    description?: string;
    location?: string;
    status?: string;
    request_id?: string;
  }) => {
    const headers: Record<string, string> = {};
    if (data.request_id) {
      headers['X-Request-Id'] = data.request_id;
    }
    return request<Project>('/projects', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  updateProject: async (id: number, data: { name: string; description?: string; location?: string; status?: string }) => {
    return request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteProject: async (id: number) => {
    return request<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
      headers: { 'X-Confirm-Delete': 'true' },
      body: JSON.stringify({ confirmDelete: true }),
    });
  },

  getProjectActivity: async (id: number) => {
    return request<ActivityItem[]>(`/projects/${id}/activity`);
  },

  // Expenses
  getExpenses: async (params: {
    projectId?: number;
    date?: string;
    startDate?: string;
    endDate?: string;
    material?: string;
    category?: string;
    plotId?: number;
    khataId?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.date) query.set('date', params.date);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.material) query.set('material', params.material);
    if (params.category) query.set('category', params.category);
    if (params.plotId) query.set('plotId', String(params.plotId));
    if (params.khataId) query.set('khataId', String(params.khataId));
    return request<Expense[]>(`/expenses?${query.toString()}`);
  },

  createExpense: async (data: Partial<Expense>) => {
    return request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateExpense: async (id: number, data: Partial<Expense>) => {
    return request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteExpense: async (id: number) => {
    return request<{ success: boolean }>(`/expenses/${id}`, { method: 'DELETE' });
  },

  // Material Returns
  getMaterialReturns: async (params: {
    projectId?: number;
    plotId?: number;
    material?: string;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.plotId) query.set('plotId', String(params.plotId));
    if (params.material) query.set('material', params.material);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return request<MaterialReturn[]>(`/material-returns?${query.toString()}`);
  },

  createMaterialReturn: async (data: {
    project_id: number;
    plot_id?: number | null;
    material_id?: number | null;
    material_name: string;
    quantity?: number | null;
    unit?: string | null;
    return_amount: number;
    return_date: string;
    returned_to: 'Client' | 'Contractor' | 'Other';
    recipient_name?: string | null;
    notes?: string | null;
  }) => {
    return request<MaterialReturn>('/material-returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateMaterialReturn: async (
    id: number,
    data: {
      project_id?: number;
      plot_id?: number | null;
      material_id?: number | null;
      material_name?: string;
      quantity?: number | null;
      unit?: string | null;
      return_amount?: number;
      return_date?: string;
      returned_to?: 'Client' | 'Contractor' | 'Other';
      recipient_name?: string | null;
      notes?: string | null;
    }
  ) => {
    return request<MaterialReturn>(`/material-returns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteMaterialReturn: async (id: number) => {
    return request<{ success: boolean }>(`/material-returns/${id}`, { method: 'DELETE' });
  },

  // Materials
  getMaterials: async () => {
    return request<Material[]>('/materials');
  },

  createMaterial: async (data: { name: string; default_unit?: string }) => {
    return request<Material>('/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Contractor Types / Contract Types
  getContractorTypes: async (activeOnly = false) => {
    const qs = activeOnly ? '?activeOnly=true' : '';
    return request<ContractorType[]>(`/contractor-types${qs}`);
  },

  createContractorType: async (data: { name: string }) => {
    return request<ContractorType>('/contractor-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContractorType: async (id: number, data: { name?: string; is_active?: boolean | number }) => {
    return request<ContractorType>(`/contractor-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Contractors
  getContractors: async () => {
    return request<Contractor[]>('/contractors');
  },

  getContractorProfile: async (id: number) => {
    return request<{
      contractor: Contractor;
      contracts: Contract[];
      payments: ContractPayment[];
      globalSummary: {
        totalContracts: number;
        totalContractsAmount: number;
        totalPaid: number;
        outstanding: number;
      };
    }>(`/contractors/${id}`);
  },

  createContractor: async (data: { name: string; phone?: string; type_name: string; notes?: string }) => {
    return request<Contractor>('/contractors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContractor: async (id: number, data: { name: string; phone?: string; type_name: string; notes?: string }) => {
    return request<Contractor>(`/contractors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteContractor: async (id: number) => {
    return request<{ success: boolean }>(`/contractors/${id}`, { method: 'DELETE' });
  },

  // Contracts
  getContracts: async (projectId?: number) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request<Contract[]>(`/contracts${query}`);
  },

  createContract: async (data: {
    project_id: number;
    contractor_id: number;
    contract_type_id?: number | null;
    contract_type?: string | null;
    work_title: string;
    contract_amount: number;
    contract_date?: string;
    notes?: string | null;
  }) => {
    return request<Contract>('/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContract: async (
    id: number,
    data: {
      contract_type_id?: number | null;
      contract_type?: string | null;
      work_title?: string;
      contract_amount?: number;
      contract_date?: string;
      notes?: string | null;
    }
  ) => {
    return request<Contract>(`/contracts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteContract: async (id: number) => {
    return request<{ success: boolean }>(`/contracts/${id}`, { method: 'DELETE' });
  },

  // Payments (Contractor Expenses)
  getPayments: async (params: { projectId?: number; contractorId?: number; contractId?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', String(params.projectId));
    if (params.contractorId) query.set('contractorId', String(params.contractorId));
    if (params.contractId) query.set('contractId', String(params.contractId));
    const qs = query.toString();
    return request<ContractPayment[]>(`/contract-payments${qs ? `?${qs}` : ''}`);
  },

  createPayment: async (data: {
    project_id?: number;
    contractor_id?: number;
    contract_id: number;
    amount: number;
    payment_date?: string;
    payment_method?: string;
    notes?: string | null;
    request_id?: string;
  }) => {
    const headers: Record<string, string> = {};
    if (data.request_id) {
      headers['X-Request-Id'] = data.request_id;
    }
    return request<ContractPayment>('/contract-payments', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  },

  updatePayment: async (id: number, data: {
    amount: number;
    payment_date?: string;
    payment_method?: string;
    notes?: string;
  }) => {
    return request<ContractPayment>(`/contract-payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deletePayment: async (id: number) => {
    return request<{ success: boolean }>(`/contract-payments/${id}`, { method: 'DELETE' });
  },

  // Incomes
  getIncomes: async (projectId?: number, plotId?: number | 'unallocated') => {
    const query = new URLSearchParams();
    if (projectId) query.set('projectId', String(projectId));
    if (plotId) query.set('plotId', String(plotId));
    const qs = query.toString();
    return request<Income[]>(`/incomes${qs ? `?${qs}` : ''}`);
  },

  createIncome: async (data: {
    project_id: number;
    plot_id?: number | null;
    amount: number;
    income_date?: string;
    source_customer?: string;
    notes?: string;
  }) => {
    return request<Income>('/incomes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateIncome: async (id: number, data: {
    project_id: number;
    plot_id?: number | null;
    amount: number;
    income_date?: string;
    source_customer?: string;
    notes?: string;
  }) => {
    return request<Income>(`/incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteIncome: async (id: number) => {
    return request<{ success: boolean }>(`/incomes/${id}`, { method: 'DELETE' });
  },

  // Plots & Khatas
  getPlots: async (projectId: number) => {
    return request<Plot[]>(`/plots?projectId=${projectId}`);
  },

  createPlot: async (data: { project_id: number; name: string }) => {
    return request<Plot>('/plots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deletePlot: async (id: number) => {
    return request<{ success: boolean }>(`/plots/${id}`, { method: 'DELETE' });
  },

  getKhatas: async (projectId: number, plotId?: number) => {
    let url = `/khatas?projectId=${projectId}`;
    if (plotId) url += `&plotId=${plotId}`;
    return request<Khata[]>(url);
  },

  createKhata: async (data: { project_id: number; plot_id?: number; name: string }) => {
    return request<Khata>('/khatas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteKhata: async (id: number) => {
    return request<{ success: boolean }>(`/khatas/${id}`, { method: 'DELETE' });
  },

  // Reports
  getProjectExpenseReport: async (projectId?: number) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request<any[]>(`/reports/project-expense${query}`);
  },

  getDailyExpenseReport: async (date?: string, projectId?: number) => {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (projectId) query.set('projectId', String(projectId));
    return request<any>(`/reports/daily-expense?${query.toString()}`);
  },

  getMaterialsReport: async (projectId?: number) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request<any[]>(`/reports/materials${query}`);
  },

  getContractorsReport: async (projectId?: number) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request<any[]>(`/reports/contractors${query}`);
  },

  getOutstandingReport: async () => {
    return request<any[]>('/reports/outstanding');
  },

  getIncomeVsExpenseReport: async (projectId?: number) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request<any[]>(`/reports/income-vs-expense${query}`);
  },
};

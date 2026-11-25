export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  name: string;
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  location?: string;
  status: 'Active' | 'Completed' | 'Archived';
  created_at: string;
  total_cost?: number;
  total_income?: number;
  total_paid?: number;
  outstanding?: number;
  net?: number;
  material_expenses?: number;
  gross_material_expenses?: number;
  material_returns?: number;
  other_expenses?: number;
  theka_cost?: number;
  theka_paid?: number;
}

export interface ProjectSummary {
  materialExpenses: number;
  grossMaterialExpenses?: number;
  materialReturns?: number;
  otherExpenses: number;
  thekaCost: number;
  thekaPaid: number;
  totalProjectCost: number;
  totalPaid: number;
  outstanding: number;
  totalIncome: number;
  net: number;
}

export interface Plot {
  id: number;
  project_id: number;
  name: string;
  created_at?: string;
}

export interface Khata {
  id: number;
  project_id: number;
  plot_id?: number | null;
  name: string;
  created_at?: string;
}

export interface Material {
  id: number;
  name: string;
  default_unit?: string | null;
  created_at?: string;
}

export interface ContractorType {
  id: number;
  name: string;
  default_rate?: number | null;
  is_active?: number;
  created_at?: string;
}

export interface Contractor {
  id: number;
  name: string;
  phone?: string | null;
  type_name: string;
  notes?: string | null;
  created_at?: string;
  contracts_count?: number;
  total_contracts_amount?: number;
  total_paid?: number;
  outstanding?: number;
}

export interface Contract {
  id: number;
  project_id: number;
  contractor_id: number;
  contract_type_id?: number | null;
  contract_type?: string | null;
  work_title: string;
  contract_amount: number;
  contract_date?: string | null;
  notes?: string | null;
  created_at: string;
  project_name?: string;
  contractor_name?: string;
  contractor_phone?: string;
  contractor_type?: string;
  paid_amount?: number;
  outstanding_amount?: number;
}

export interface ContractPayment {
  id: number;
  contract_id: number;
  project_id?: number;
  contractor_id?: number;
  amount: number;
  payment_date: string;
  payment_method?: string;
  notes?: string | null;
  created_at?: string;
  work_title?: string;
  contract_type?: string | null;
  contract_amount?: number;
  contractor_name?: string;
  project_name?: string;
}

export interface Expense {
  id: number;
  project_id: number;
  plot_id?: number | null;
  khata_id?: number | null;
  material_id?: number | null;
  material_name: string;
  category: 'Material' | 'Other';
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  expense_date: string;
  notes?: string | null;
  created_at?: string;
  project_name?: string;
  plot_name?: string;
  khata_name?: string;
  calculated_amount?: number;
}

export interface MaterialReturn {
  id: number;
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
  created_at?: string;
  project_name?: string;
  plot_name?: string | null;
}

export interface Income {
  id: number;
  project_id: number;
  plot_id?: number | null;
  amount: number;
  income_date: string;
  source_customer?: string | null;
  notes?: string | null;
  created_at?: string;
  project_name?: string;
  plot_name?: string | null;
}

export interface ActivityItem {
  id: number;
  title: string;
  subtitle: string;
  amount: number;
  calculated_amount: number;
  date: string;
  type: 'expense' | 'payment' | 'income' | 'material_return';
  notes?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  category?: string;
  contract_id?: number;
  contract_amount?: number;
  plot_id?: number | null;
  plot_name?: string | null;
  returned_to?: string;
  recipient_name?: string | null;
}

export interface HomeOverviewData {
  totalProjects: number;
  activeProjects: number;
  totalProjectCost: number;
  totalOutstanding: number;
  totalIncome: number;
  recentActivity: ActivityItem[];
}

// Accounting calculation functions used across backend and frontend
// Ensures single source of truth for all formulas

export interface ExpenseItem {
  id?: number;
  amount: number;
  quantity?: number | null;
  rate?: number | null;
  category?: string;
  material_name?: string;
}

export interface ContractItem {
  id: number;
  contract_amount: number;
  paid_amount?: number;
}

export interface PaymentItem {
  id?: number;
  contract_id: number;
  amount: number;
}

export interface IncomeItem {
  id?: number;
  amount: number;
}

/**
 * Calculates effective expense amount:
 * If both quantity > 0 and rate > 0 exist, returns quantity * rate.
 * Otherwise returns entered amount.
 */
export function calculateExpenseAmount(
  amount: number,
  quantity?: number | null,
  rate?: number | null
): number {
  const q = Number(quantity);
  const r = Number(rate);
  if (!isNaN(q) && q > 0 && !isNaN(r) && r > 0) {
    return Math.round(q * r * 100) / 100;
  }
  const amt = Number(amount);
  return isNaN(amt) ? 0 : Math.max(0, Math.round(amt * 100) / 100);
}

/**
 * Calculates total paid towards a specific contract from payment list
 */
export function calculateContractPaid(
  contractId: number,
  payments: PaymentItem[]
): number {
  return payments
    .filter((p) => p.contract_id === contractId)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/**
 * Calculates remaining outstanding balance on a contract
 * Contract Amount - Total Payments = Outstanding
 */
export function calculateContractOutstanding(
  contractAmount: number,
  totalPaid: number
): number {
  const amt = Number(contractAmount) || 0;
  const paid = Number(totalPaid) || 0;
  return Math.max(0, amt - paid);
}

/**
 * Validates if a proposed payment amount is valid and does not exceed remaining contract balance
 */
export function validatePaymentAmount(
  contractAmount: number,
  alreadyPaid: number,
  newPaymentAmount: number
): { valid: boolean; remainingBalance: number; error?: string } {
  const amt = Number(contractAmount) || 0;
  const paid = Number(alreadyPaid) || 0;
  const proposed = Number(newPaymentAmount) || 0;

  if (proposed <= 0) {
    return {
      valid: false,
      remainingBalance: Math.max(0, Math.round((amt - paid) * 100) / 100),
      error: 'Payment amount must be greater than zero.',
    };
  }

  const remainingBalance = Math.max(0, Math.round((amt - paid) * 100) / 100);

  if (proposed > remainingBalance + 0.001) {
    return {
      valid: false,
      remainingBalance,
      error: 'Payment exceeds remaining contract balance.',
    };
  }

  return {
    valid: true,
    remainingBalance: Math.max(0, Math.round((remainingBalance - proposed) * 100) / 100),
  };
}

/**
 * Calculates project financial summary:
 * - Material Expenses = Net Material Cost (Gross Material Purchases - Material Returns)
 * - Other Expenses (category !== 'Material')
 * - Contract Total / Commitment (sum of contract_amount — does NOT add to Total Project Cost)
 * - Contractor Paid (sum of actual payments against contracts — contributes to Total Project Cost)
 * - Total Project Cost = Net Material Expenses + Other Expenses + Actual Contractor Payments
 * - Total Paid = Total Project Cost (actual cash expenditure)
 * - Outstanding = Sum of all contract amounts - Sum of all payments against those contracts
 * - Total Recovery / Income = sum of incomes
 * - Net = Total Recovery - Total Project Cost
 */
export function calculateProjectSummary(
  expenses: { amount: number; quantity?: number | null; rate?: number | null; category?: string }[],
  contracts: { id: number; contract_amount: number }[],
  payments: PaymentItem[],
  incomes: { amount: number }[],
  materialReturns: { return_amount: number }[] = []
) {
  let grossMaterialExpenses = 0;
  let otherExpenses = 0;

  for (const exp of expenses) {
    const calculatedAmt = calculateExpenseAmount(exp.amount, exp.quantity, exp.rate);
    if (exp.category === 'Material') {
      grossMaterialExpenses += calculatedAmt;
    } else {
      otherExpenses += calculatedAmt;
    }
  }

  const totalMaterialReturns = materialReturns.reduce(
    (sum, r) => sum + (Number(r.return_amount) || 0),
    0
  );

  // Net Material Expense = Total Material Purchases - Total Material Returns
  const materialExpenses = Math.max(
    0,
    Math.round((grossMaterialExpenses - totalMaterialReturns) * 100) / 100
  );

  // Total contract commitment (used for Outstanding tracking, NOT project cost)
  const thekaCost = contracts.reduce(
    (sum, c) => sum + (Number(c.contract_amount) || 0),
    0
  );

  // Actual contractor payments made against this project's contracts
  const contractIds = new Set(contracts.map((c) => c.id));
  const thekaPaid = payments
    .filter((p) => contractIds.has(p.contract_id))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const outstanding = Math.max(0, Math.round((thekaCost - thekaPaid) * 100) / 100);
  const totalProjectCost = Math.round((materialExpenses + otherExpenses + thekaPaid) * 100) / 100;
  const totalPaid = totalProjectCost;
  const totalIncome = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const net = Math.round((totalIncome - totalProjectCost) * 100) / 100;

  return {
    materialExpenses,
    grossMaterialExpenses,
    materialReturns: totalMaterialReturns,
    otherExpenses,
    thekaCost,
    thekaPaid,
    totalProjectCost,
    totalPaid,
    outstanding,
    totalIncome,
    net,
  };
}

/**
 * Calculates global summary for a contractor across all their contracts and payments
 */
export function calculateContractorGlobalSummary(
  contractorId: number,
  contracts: { id: number; contractor_id: number; contract_amount: number }[],
  payments: PaymentItem[]
) {
  const contractorContracts = contracts.filter((c) => c.contractor_id === contractorId);
  const totalContractsAmount = contractorContracts.reduce(
    (sum, c) => sum + (Number(c.contract_amount) || 0),
    0
  );

  const contractIdSet = new Set(contractorContracts.map((c) => c.id));
  const totalPaid = payments
    .filter((p) => contractIdSet.has(p.contract_id))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const outstanding = Math.max(0, totalContractsAmount - totalPaid);

  return {
    totalContracts: contractorContracts.length,
    totalContractsAmount,
    totalPaid,
    outstanding,
  };
}

/**
 * Format currency in Pakistani Rupees: e.g. Rs. 1,850,000
 */
export function formatCurrency(amount: number | null | undefined): string {
  const val = Number(amount) || 0;
  return `Rs. ${val.toLocaleString('en-US')}`;
}

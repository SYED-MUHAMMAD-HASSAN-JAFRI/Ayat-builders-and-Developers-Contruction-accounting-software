import {
  calculateExpenseAmount,
  calculateContractPaid,
  calculateContractOutstanding,
  validatePaymentAmount,
  calculateProjectSummary,
  calculateContractorGlobalSummary,
} from '../src/shared/calculations.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`PASSED: ${message}`);
}

console.log('--- Running Calculations Unit Tests ---');

// 1. Quantity × rate test
// Example from user requirements: 50 Bori cement at 1,400 = 70,000
const qtyRateCalc = calculateExpenseAmount(0, 50, 1400);
assert(qtyRateCalc === 70000, '50 * 1400 must equal 70,000');

// 2. Direct expense amount test
// Example: Bajri Rs. 20,000 with no quantity/rate
const directExpense = calculateExpenseAmount(20000, null, null);
assert(directExpense === 20000, 'Direct amount 20,000 without quantity and rate must equal 20,000');

// 3. Contract outstanding test
// Contract: 200,000, Paid: 50,000 -> Outstanding: 150,000
const contractOutstanding = calculateContractOutstanding(200000, 50000);
assert(contractOutstanding === 150000, 'Contract 200,000 with 50,000 paid has 150,000 outstanding');

// 4. Multiple partial payments test
// Payment 1: 50,000, Payment 2: 75,000, Payment 3: 75,000 -> Total 200,000, Outstanding 0
const payments = [
  { contract_id: 1, amount: 50000 },
  { contract_id: 1, amount: 75000 },
  { contract_id: 1, amount: 75000 },
];
const totalPaidMultiple = calculateContractPaid(1, payments);
assert(totalPaidMultiple === 200000, 'Three partial payments (50k, 75k, 75k) total 200,000');
const multipleOutstanding = calculateContractOutstanding(200000, totalPaidMultiple);
assert(multipleOutstanding === 0, 'Outstanding after 200,000 total payments must be 0');

// 5. Payment over contract balance test
// Contract: 200,000, Paid: 150,000. Try to pay 60,000 -> must fail with clear message
const overpayValidation = validatePaymentAmount(200000, 150000, 60000);
assert(overpayValidation.valid === false, 'Overpayment must be rejected');
assert(
  overpayValidation.error === 'Payment exceeds remaining contract balance.',
  'Correct error message on overpayment'
);

const validPayment = validatePaymentAmount(200000, 150000, 50000);
assert(validPayment.valid === true, 'Exact remaining balance payment must be accepted');
assert(validPayment.remainingBalance === 0, 'Remaining balance after final payment must be 0');

// 6. Project total cost test (NEW ACCOUNTING RULE)
// Material expenses: 1,200,000, Other: 50,000, Contract commitment: 650,000, Contractor Paid: 500,000
// Total Project Cost MUST include actual contractor payments (500,000), NOT unpaid contract commitment (650,000):
// 1,200,000 + 50,000 + 500,000 = 1,750,000; Outstanding = 650,000 - 500,000 = 150,000
const projectSummary = calculateProjectSummary(
  [
    { amount: 1200000, category: 'Material' },
    { amount: 50000, category: 'Other' },
  ],
  [{ id: 10, contract_amount: 650000 }],
  [{ contract_id: 10, amount: 500000 }],
  [{ amount: 3000000 }]
);
assert(projectSummary.totalProjectCost === 1750000, 'Total Project Cost must be 1,750,000 (actual paid, not unpaid commitment)');
assert(projectSummary.materialExpenses === 1200000, 'Material expenses must be 1,200,000');
assert(projectSummary.otherExpenses === 50000, 'Other expenses must be 50,000');
assert(projectSummary.thekaCost === 650000, 'Total Contract commitments must be 650,000');
assert(projectSummary.thekaPaid === 500000, 'Contractor paid must be 500,000');
assert(projectSummary.outstanding === 150000, 'Contractor outstanding must be 150,000');
assert(projectSummary.totalPaid === 1750000, 'Total cash paid must be 1,750,000 (1.2m + 50k + 500k)');

// 7. Recovery minus project cost test (Net)
// Total Recovery 3,000,000 - Total Project Cost 1,750,000 = 1,250,000
assert(projectSummary.net === 1250000, 'Net must be 1,250,000 (3,000,000 - 1,750,000)');

// 8. Contractor commitment zero cost impact + incremental payments + material returns
const commitmentOnly = calculateProjectSummary(
  [],
  [{ id: 20, contract_amount: 1000000 }],
  [],
  []
);
assert(commitmentOnly.totalProjectCost === 0, 'Creating 1,000,000 contract must leave Total Project Cost at 0');
assert(commitmentOnly.outstanding === 1000000, 'Creating 1,000,000 contract must show 1,000,000 Outstanding');

const afterPaymentsAndExpenses = calculateProjectSummary(
  [
    { amount: 200000, category: 'Material' },
    { amount: 50000, category: 'Other' },
  ],
  [{ id: 20, contract_amount: 1000000 }],
  [
    { contract_id: 20, amount: 100000 },
    { contract_id: 20, amount: 200000 },
  ],
  [{ amount: 500000 }],
  [{ return_amount: 25000 }]
);
assert(afterPaymentsAndExpenses.materialExpenses === 175000, 'Net Material Expense must deduct return (200k - 25k = 175k)');
assert(afterPaymentsAndExpenses.thekaPaid === 300000, 'Contractor Paid must total 300,000 (100k + 200k)');
assert(afterPaymentsAndExpenses.outstanding === 700000, 'Outstanding must be 700,000 (1,000,000 - 300,000)');
assert(
  afterPaymentsAndExpenses.totalProjectCost === 525000,
  'Total Project Cost must equal Net Material (175k) + Other (50k) + Contractor Paid (300k) = 525,000'
);

// 9. Contractor global balance test
// Contractor Ali has 2 contracts: House #124 (200k, 150k paid) and House #125 (300k, 100k paid)
// Total Contracts: 500k, Total Paid: 250k, Outstanding: 250k
const contractorSummary = calculateContractorGlobalSummary(
  99,
  [
    { id: 101, contractor_id: 99, contract_amount: 200000 },
    { id: 102, contractor_id: 99, contract_amount: 300000 },
  ],
  [
    { contract_id: 101, amount: 150000 },
    { contract_id: 102, amount: 100000 },
  ]
);
assert(contractorSummary.totalContractsAmount === 500000, 'Ali total contracts must be 500,000');
assert(contractorSummary.totalPaid === 250000, 'Ali total paid must be 250,000');
assert(contractorSummary.outstanding === 250000, 'Ali outstanding must be 250,000');

console.log('All calculations unit tests PASSED successfully!');

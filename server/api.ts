import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, get, run, withTransaction, logAuditEvent } from './db.js';
import { authenticate, requireAdmin, generateToken, AuthenticatedRequest } from './auth.js';
import {
  calculateExpenseAmount,
  calculateContractPaid,
  calculateContractOutstanding,
  validatePaymentAmount,
  calculateProjectSummary,
  calculateContractorGlobalSummary,
} from '../src/shared/calculations.js';

export const apiRouter = Router();

function isValidIsoDate(val: any): boolean {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const d = new Date(`${val}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
}

function validatePlotBelongsToProject(plotIdRaw: any, projectId: number): { plotId: number | null; error?: string } {
  if (plotIdRaw === undefined || plotIdRaw === null || plotIdRaw === '') {
    return { plotId: null };
  }
  const plotId = Number(plotIdRaw);
  if (isNaN(plotId) || plotId <= 0) {
    return { plotId: null, error: 'Invalid plot selection.' };
  }
  const plot = get<{ id: number; project_id: number }>('SELECT id, project_id FROM plots WHERE id = ?', [plotId]);
  if (!plot) {
    return { plotId: null, error: 'Selected plot does not exist.' };
  }
  if (Number(plot.project_id) !== Number(projectId)) {
    return { plotId: null, error: 'Selected plot does not belong to the chosen project.' };
  }
  return { plotId };
}

function validateMaterialReturnAgainstPurchases(
  projectId: number,
  materialId: number | null,
  materialName: string,
  returnAmount: number,
  returnQuantity: number | null,
  excludeReturnId?: number
): { valid: boolean; error?: string } {
  // Match Material expenses for this project by material_id or case-insensitive material_name
  const purchaseRows = query<{ id: number; amount: number; quantity: number | null; rate: number | null }>(
    `SELECT id, amount, quantity, rate
     FROM expenses
     WHERE project_id = ?
       AND category = 'Material'
       AND ((? IS NOT NULL AND material_id = ?) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))`,
    [projectId, materialId, materialId, materialName]
  );

  const totalPurchasedAmount = purchaseRows.reduce(
    (sum, r) => sum + calculateExpenseAmount(r.amount, r.quantity, r.rate),
    0
  );

  if (totalPurchasedAmount <= 0) {
    return {
      valid: false,
      error: `Cannot record return: no purchase expenses found for "${materialName}" on this project.`,
    };
  }

  let existingReturnsSql = `
    SELECT id, return_amount, quantity
    FROM material_returns
    WHERE project_id = ?
      AND ((? IS NOT NULL AND material_id = ?) OR LOWER(TRIM(material_name)) = LOWER(TRIM(?)))
  `;
  const existingParams: any[] = [projectId, materialId, materialId, materialName];
  if (excludeReturnId) {
    existingReturnsSql += ' AND id != ?';
    existingParams.push(excludeReturnId);
  }
  const existingReturns = query<{ id: number; return_amount: number; quantity: number | null }>(
    existingReturnsSql,
    existingParams
  );

  const alreadyReturnedAmount = existingReturns.reduce((sum, r) => sum + (Number(r.return_amount) || 0), 0);
  if (alreadyReturnedAmount + returnAmount > totalPurchasedAmount + 0.01) {
    const remainingReturnable = Math.max(0, totalPurchasedAmount - alreadyReturnedAmount);
    return {
      valid: false,
      error: `Return amount exceeds purchased total for "${materialName}". Max returnable amount: Rs. ${remainingReturnable.toLocaleString('en-US')}.`,
    };
  }

  if (returnQuantity !== null && returnQuantity > 0) {
    const totalPurchasedQty = purchaseRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    if (totalPurchasedQty > 0) {
      const alreadyReturnedQty = existingReturns.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      if (alreadyReturnedQty + returnQuantity > totalPurchasedQty + 0.001) {
        const remainingQty = Math.max(0, totalPurchasedQty - alreadyReturnedQty);
        return {
          valid: false,
          error: `Return quantity exceeds purchased quantity for "${materialName}". Max returnable quantity: ${remainingQty}.`,
        };
      }
    }
  }

  return { valid: true };
}

// ================= AUTH ROUTES =================

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const user = get<{ id: number; username: string; password_hash: string; role: 'admin' | 'user'; name: string }>(
    'SELECT * FROM users WHERE username = ?',
    [username.trim()]
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const authUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  };

  const token = generateToken(authUser);

  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    ...(isHttps ? { partitioned: true } : {}),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({ token, user: authUser });
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

apiRouter.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// ================= USER MANAGEMENT (Admin Only) =================

apiRouter.get('/users', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = query<{ id: number; username: string; role: string; name: string; created_at: string }>(
    'SELECT id, username, role, name, created_at FROM users ORDER BY id ASC'
  );
  res.json(users);
});

apiRouter.post('/users', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !name) {
    res.status(400).json({ error: 'Username, password, and name are required.' });
    return;
  }

  const existing = get('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existing) {
    res.status(400).json({ error: 'Username already exists.' });
    return;
  }

  const validRole = role === 'admin' ? 'admin' : 'user';
  const hash = bcrypt.hashSync(password, 10);
  const result = run(
    'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    [username.trim(), hash, validRole, name.trim()]
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    username: username.trim(),
    role: validRole,
    name: name.trim(),
  });
});

apiRouter.delete('/users/:id', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const targetId = Number(req.params.id);
  if (req.user?.id === targetId) {
    res.status(400).json({ error: 'You cannot delete your own user account.' });
    return;
  }
  const target = get<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ?', [targetId]);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM users WHERE id = ?', [targetId]);
    logAuditEvent({
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: targetId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: { username: target.username },
    });
  });
  res.json({ success: true });
});

// ================= AUDIT LOGS (Admin Only) =================

apiRouter.get('/audit-logs', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const logs = query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit]);
  res.json(logs);
});

// ================= PROJECTS ROUTES =================

const VALID_PROJECT_STATUSES = new Set(['Active', 'Completed', 'Archived']);

apiRouter.get('/projects', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const projects = query<any>('SELECT * FROM projects ORDER BY created_at DESC, id DESC');

  const allExpenses = query<any>('SELECT project_id, amount, quantity, rate, category FROM expenses');
  const allContracts = query<any>('SELECT id, project_id, contract_amount FROM contracts');
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');
  const allIncomes = query<any>('SELECT project_id, amount FROM incomes');
  const allReturns = query<any>('SELECT project_id, return_amount FROM material_returns');

  const enriched = projects.map((p) => {
    const projExpenses = allExpenses.filter((e) => e.project_id === p.id);
    const projContracts = allContracts.filter((c) => c.project_id === p.id);
    const projIncomes = allIncomes.filter((i) => i.project_id === p.id);
    const projReturns = allReturns.filter((r) => r.project_id === p.id);
    const summary = calculateProjectSummary(projExpenses, projContracts, allPayments, projIncomes, projReturns);

    return {
      ...p,
      total_cost: summary.totalProjectCost,
      total_income: summary.totalIncome,
      total_paid: summary.totalPaid,
      outstanding: summary.outstanding,
      net: summary.net,
      material_expenses: summary.materialExpenses,
      gross_material_expenses: summary.grossMaterialExpenses,
      material_returns: summary.materialReturns,
      other_expenses: summary.otherExpenses,
      theka_cost: summary.thekaCost,
      theka_paid: summary.thekaPaid,
    };
  });

  res.json(enriched);
});

apiRouter.post('/projects', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name, description, location, status, request_id } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    res.status(400).json({ error: 'Project name is required.' });
    return;
  }

  const normalizedStatus = VALID_PROJECT_STATUSES.has(status) ? status : 'Active';
  const rawRequestId =
    typeof request_id === 'string' && request_id.trim()
      ? request_id.trim().slice(0, 128)
      : typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim()
      ? req.headers['x-request-id'].trim().slice(0, 128)
      : null;

  try {
    const { project: created, replayed } = withTransaction(() => {
      if (rawRequestId) {
        const existingByReq = get<any>('SELECT * FROM projects WHERE request_id = ?', [rawRequestId]);
        if (existingByReq) {
          return { project: existingByReq, replayed: true };
        }
      }

      const result = run(
        'INSERT INTO projects (name, description, location, status, request_id) VALUES (?, ?, ?, ?, ?)',
        [
          trimmedName,
          typeof description === 'string' ? description.trim() : '',
          typeof location === 'string' ? location.trim() : '',
          normalizedStatus,
          rawRequestId,
        ]
      );

      if (!result.lastInsertRowid) {
        throw new Error('Project insert did not return an ID.');
      }

      const row = get('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
      if (!row) {
        throw new Error('Failed to verify newly created project in database.');
      }

      logAuditEvent({
        action: 'CREATE_PROJECT',
        entityType: 'project',
        entityId: row.id,
        actorId: req.user?.id,
        actorUsername: req.user?.username,
        details: { name: row.name, status: row.status, request_id: rawRequestId },
      });

      return { project: row, replayed: false };
    });

    res.status(replayed ? 200 : 201).json(created);
  } catch (err: any) {
    console.error('[PROJECTS] Failed to persist new project:', err);
    res.status(500).json({ error: err?.message || 'Failed to save project to database.' });
  }
});

apiRouter.get('/projects/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const projectId = Number(req.params.id);
  const project = get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const expenses = query<any>('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC', [projectId]);
  const contracts = query<any>('SELECT * FROM contracts WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
  const payments = query<any>(
    `SELECT p.* FROM contract_payments p 
     JOIN contracts c ON p.contract_id = c.id 
     WHERE c.project_id = ? ORDER BY p.payment_date DESC`,
    [projectId]
  );
  const incomes = query<any>('SELECT * FROM incomes WHERE project_id = ? ORDER BY income_date DESC', [projectId]);
  const materialReturns = query<any>('SELECT * FROM material_returns WHERE project_id = ? ORDER BY return_date DESC', [projectId]);

  const summary = calculateProjectSummary(expenses, contracts, payments, incomes, materialReturns);

  res.json({
    project,
    summary,
  });
});

apiRouter.put('/projects/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const projectId = Number(req.params.id);
  const existing = get<{ id: number; status: string }>('SELECT id, status FROM projects WHERE id = ?', [projectId]);
  if (!existing) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const { name, description, location, status } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    res.status(400).json({ error: 'Project name is required.' });
    return;
  }

  const normalizedStatus = VALID_PROJECT_STATUSES.has(status) ? status : existing.status;

  try {
    const updated = withTransaction(() => {
      run(
        'UPDATE projects SET name = ?, description = ?, location = ?, status = ? WHERE id = ?',
        [
          trimmedName,
          typeof description === 'string' ? description.trim() : '',
          typeof location === 'string' ? location.trim() : '',
          normalizedStatus,
          projectId,
        ]
      );
      const row = get('SELECT * FROM projects WHERE id = ?', [projectId]);
      logAuditEvent({
        action: 'UPDATE_PROJECT',
        entityType: 'project',
        entityId: projectId,
        actorId: req.user?.id,
        actorUsername: req.user?.username,
        details: { name: trimmedName, status: normalizedStatus },
      });
      return row;
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[PROJECTS] Failed to update project:', err);
    res.status(500).json({ error: err?.message || 'Failed to update project in database.' });
  }
});

apiRouter.delete('/projects/:id', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const projectId = Number(req.params.id);
  const isConfirmed =
    req.body?.confirmDelete === true ||
    String(req.headers['x-confirm-delete'] || '').toLowerCase() === 'true';

  if (!isConfirmed) {
    res.status(400).json({
      error: 'Explicit deletion confirmation is required before deleting a project.',
    });
    return;
  }

  const existing = get<{ id: number; name: string }>('SELECT id, name FROM projects WHERE id = ?', [projectId]);
  if (!existing) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  try {
    withTransaction(() => {
      const counts = {
        expenses: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM expenses WHERE project_id = ?', [projectId])?.cnt || 0),
        contracts: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM contracts WHERE project_id = ?', [projectId])?.cnt || 0),
        incomes: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM incomes WHERE project_id = ?', [projectId])?.cnt || 0),
        material_returns: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM material_returns WHERE project_id = ?', [projectId])?.cnt || 0),
        plots: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM plots WHERE project_id = ?', [projectId])?.cnt || 0),
        khatas: Number(get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM khatas WHERE project_id = ?', [projectId])?.cnt || 0),
      };

      run(
        'DELETE FROM contract_payments WHERE contract_id IN (SELECT id FROM contracts WHERE project_id = ?)',
        [projectId]
      );
      run('DELETE FROM contracts WHERE project_id = ?', [projectId]);
      run('DELETE FROM material_returns WHERE project_id = ?', [projectId]);
      run('DELETE FROM expenses WHERE project_id = ?', [projectId]);
      run('DELETE FROM incomes WHERE project_id = ?', [projectId]);
      run('DELETE FROM khatas WHERE project_id = ?', [projectId]);
      run('DELETE FROM plots WHERE project_id = ?', [projectId]);
      run('DELETE FROM projects WHERE id = ?', [projectId]);

      logAuditEvent({
        action: 'DELETE_PROJECT',
        entityType: 'project',
        entityId: projectId,
        actorId: req.user?.id,
        actorUsername: req.user?.username,
        details: { projectName: existing.name, deletedCounts: counts },
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[PROJECTS] Failed to delete project:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete project.' });
  }
});

// Activity feed for project
apiRouter.get('/projects/:id/activity', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const projectId = Number(req.params.id);

  // 1. Expenses
  const expenses = query<any>(
    `SELECT e.id, e.material_name as title, e.amount, e.quantity, e.unit, e.rate, 
            e.category, e.expense_date as date, e.notes, e.created_at, e.plot_id, pl.name as plot_name, 'expense' as type
     FROM expenses e 
     LEFT JOIN plots pl ON e.plot_id = pl.id
     WHERE e.project_id = ?`,
    [projectId]
  ).map((e) => ({
    ...e,
    calculated_amount: calculateExpenseAmount(e.amount, e.quantity, e.rate),
    subtitle: e.category === 'Material' ? 'Material Expense' : 'Other Expense',
  }));

  // 2. Payments (Contractor Expenses)
  const payments = query<any>(
    `SELECT p.id, c.work_title, cont.name as contractor_name, p.amount, 
            p.payment_date as date, p.payment_method, p.notes, p.created_at, 'payment' as type,
            c.contract_amount, p.contract_id
     FROM contract_payments p
     JOIN contracts c ON p.contract_id = c.id
     JOIN contractors cont ON c.contractor_id = cont.id
     WHERE c.project_id = ?`,
    [projectId]
  ).map((p) => ({
    ...p,
    title: `${p.contractor_name} - ${p.work_title}`,
    calculated_amount: p.amount,
    subtitle: 'Contractor Expense',
  }));

  // 3. Recoveries (Incomes)
  const incomes = query<any>(
    `SELECT i.id, i.source_customer, i.amount, i.income_date as date, i.notes, i.created_at, i.plot_id, pl.name as plot_name, 'income' as type
     FROM incomes i
     LEFT JOIN plots pl ON i.plot_id = pl.id
     WHERE i.project_id = ?`,
    [projectId]
  ).map((i) => ({
    ...i,
    title: i.source_customer ? `Received from ${i.source_customer}` : 'Project Recovery',
    calculated_amount: i.amount,
    subtitle: i.plot_name ? `Project Recovery • ${i.plot_name}` : 'Project Recovery',
  }));

  // 4. Material Returns
  const materialReturns = query<any>(
    `SELECT r.id, r.material_name, r.quantity, r.unit, r.return_amount as amount,
            r.return_date as date, r.returned_to, r.recipient_name, r.notes, r.created_at,
            r.plot_id, pl.name as plot_name, 'material_return' as type
     FROM material_returns r
     LEFT JOIN plots pl ON r.plot_id = pl.id
     WHERE r.project_id = ?`,
    [projectId]
  ).map((r) => ({
    ...r,
    title: `${r.material_name} Return`,
    calculated_amount: r.amount,
    subtitle: `Material Return (${r.returned_to}${r.recipient_name ? `: ${r.recipient_name}` : ''})`,
  }));

  // Merge and sort by date DESC, then created_at DESC
  const all = [...expenses, ...payments, ...incomes, ...materialReturns].sort((a, b) => {
    if (b.date === a.date) {
      return (b.id || 0) - (a.id || 0);
    }
    return b.date.localeCompare(a.date);
  });

  res.json(all);
});

// ================= EXPENSES ROUTES =================

apiRouter.get('/expenses', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, date, startDate, endDate, material, category, plotId, khataId } = req.query;

  let sqlStr = `
    SELECT e.*, p.name as project_name, pl.name as plot_name, k.name as khata_name
    FROM expenses e
    JOIN projects p ON e.project_id = p.id
    LEFT JOIN plots pl ON e.plot_id = pl.id
    LEFT JOIN khatas k ON e.khata_id = k.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (projectId) {
    sqlStr += ' AND e.project_id = ?';
    params.push(Number(projectId));
  }
  if (date) {
    sqlStr += ' AND e.expense_date = ?';
    params.push(date);
  }
  if (startDate) {
    sqlStr += ' AND e.expense_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sqlStr += ' AND e.expense_date <= ?';
    params.push(endDate);
  }
  if (material) {
    sqlStr += ' AND LOWER(TRIM(e.material_name)) = LOWER(TRIM(?))';
    params.push(material);
  }
  if (category) {
    sqlStr += ' AND e.category = ?';
    params.push(category);
  }
  if (plotId) {
    sqlStr += ' AND e.plot_id = ?';
    params.push(Number(plotId));
  }
  if (khataId) {
    sqlStr += ' AND e.khata_id = ?';
    params.push(Number(khataId));
  }

  sqlStr += ' ORDER BY e.expense_date DESC, e.id DESC';

  const rows = query<any>(sqlStr, params).map((r) => ({
    ...r,
    calculated_amount: calculateExpenseAmount(r.amount, r.quantity, r.rate),
  }));

  res.json(rows);
});

apiRouter.post('/expenses', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const {
    project_id,
    plot_id,
    khata_id,
    material_id,
    material_name,
    category,
    amount,
    quantity,
    unit,
    rate,
    expense_date,
    notes,
  } = req.body;

  if (!project_id) {
    res.status(400).json({ error: 'Project is required.' });
    return;
  }
  if (!material_name || !material_name.trim()) {
    res.status(400).json({ error: 'Material/Item name is required.' });
    return;
  }

  const plotCheck = validatePlotBelongsToProject(plot_id, Number(project_id));
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  const q = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : null;
  const r = rate !== undefined && rate !== null && rate !== '' ? Number(rate) : null;
  let finalAmount = Number(amount) || 0;

  if (q !== null && q < 0) {
    res.status(400).json({ error: 'Quantity cannot be negative.' });
    return;
  }
  if (r !== null && r < 0) {
    res.status(400).json({ error: 'Rate cannot be negative.' });
    return;
  }

  if (q !== null && q > 0 && r !== null && r > 0) {
    finalAmount = calculateExpenseAmount(0, q, r);
  }

  if (finalAmount <= 0) {
    res.status(400).json({ error: 'Expense amount must be greater than zero.' });
    return;
  }

  let resolvedMaterialId = material_id ? Number(material_id) : null;
  if (!resolvedMaterialId && (category || 'Material') === 'Material') {
    const matchedMat = get<{ id: number }>('SELECT id FROM materials WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [
      material_name.trim(),
    ]);
    if (matchedMat) resolvedMaterialId = matchedMat.id;
  }

  const dateToUse = expense_date || new Date().toISOString().slice(0, 10);

  const result = run(
    `INSERT INTO expenses 
      (project_id, plot_id, khata_id, material_id, material_name, category, amount, quantity, unit, rate, expense_date, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(project_id),
      plotCheck.plotId,
      khata_id ? Number(khata_id) : null,
      resolvedMaterialId,
      material_name.trim(),
      category || 'Material',
      finalAmount,
      q,
      unit || null,
      r,
      dateToUse,
      notes || null,
    ]
  );

  const created = get('SELECT * FROM expenses WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({
    ...created,
    calculated_amount: calculateExpenseAmount(created.amount, created.quantity, created.rate),
  });
});

apiRouter.put('/expenses/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const expenseId = Number(req.params.id);
  const {
    project_id,
    plot_id,
    khata_id,
    material_id,
    material_name,
    category,
    amount,
    quantity,
    unit,
    rate,
    expense_date,
    notes,
  } = req.body;

  const existing = get('SELECT * FROM expenses WHERE id = ?', [expenseId]);
  if (!existing) {
    res.status(404).json({ error: 'Expense record not found.' });
    return;
  }

  const q = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : null;
  const r = rate !== undefined && rate !== null && rate !== '' ? Number(rate) : null;
  let finalAmount = Number(amount) || 0;

  if (q !== null && q < 0) {
    res.status(400).json({ error: 'Quantity cannot be negative.' });
    return;
  }
  if (r !== null && r < 0) {
    res.status(400).json({ error: 'Rate cannot be negative.' });
    return;
  }

  if (q !== null && q > 0 && r !== null && r > 0) {
    finalAmount = calculateExpenseAmount(0, q, r);
  }

  if (finalAmount <= 0) {
    res.status(400).json({ error: 'Expense amount must be greater than zero.' });
    return;
  }

  run(
    `UPDATE expenses 
     SET project_id = ?, plot_id = ?, khata_id = ?, material_id = ?, material_name = ?, 
         category = ?, amount = ?, quantity = ?, unit = ?, rate = ?, expense_date = ?, notes = ?
     WHERE id = ?`,
    [
      Number(project_id || existing.project_id),
      plot_id !== undefined ? (plot_id ? Number(plot_id) : null) : existing.plot_id,
      khata_id !== undefined ? (khata_id ? Number(khata_id) : null) : existing.khata_id,
      material_id !== undefined ? (material_id ? Number(material_id) : null) : existing.material_id,
      material_name ? material_name.trim() : existing.material_name,
      category || existing.category,
      finalAmount,
      q,
      unit !== undefined ? unit : existing.unit,
      r,
      expense_date || existing.expense_date,
      notes !== undefined ? notes : existing.notes,
      expenseId,
    ]
  );

  const updated = get('SELECT * FROM expenses WHERE id = ?', [expenseId]);
  res.json({
    ...updated,
    calculated_amount: calculateExpenseAmount(updated.amount, updated.quantity, updated.rate),
  });
});

apiRouter.delete('/expenses/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const expenseId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, material_name, amount FROM expenses WHERE id = ?', [expenseId]);
  if (!existing) {
    res.status(404).json({ error: 'Expense record not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM expenses WHERE id = ?', [expenseId]);
    logAuditEvent({
      action: 'DELETE_EXPENSE',
      entityType: 'expense',
      entityId: expenseId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= MATERIAL RETURNS =================

apiRouter.get('/material-returns', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, plotId, material, startDate, endDate } = req.query;

  let sqlStr = `
    SELECT r.*, p.name as project_name, pl.name as plot_name
    FROM material_returns r
    JOIN projects p ON r.project_id = p.id
    LEFT JOIN plots pl ON r.plot_id = pl.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (projectId) {
    sqlStr += ' AND r.project_id = ?';
    params.push(Number(projectId));
  }
  if (plotId) {
    sqlStr += ' AND r.plot_id = ?';
    params.push(Number(plotId));
  }
  if (material) {
    sqlStr += ' AND LOWER(TRIM(r.material_name)) = LOWER(TRIM(?))';
    params.push(material);
  }
  if (startDate) {
    sqlStr += ' AND r.return_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sqlStr += ' AND r.return_date <= ?';
    params.push(endDate);
  }

  sqlStr += ' ORDER BY r.return_date DESC, r.id DESC';
  res.json(query(sqlStr, params));
});

apiRouter.post('/material-returns', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const {
    project_id,
    plot_id,
    material_id,
    material_name,
    quantity,
    unit,
    return_amount,
    return_date,
    returned_to,
    recipient_name,
    notes,
  } = req.body;

  const projectIdNum = Number(project_id);
  if (!projectIdNum) {
    res.status(400).json({ error: 'Project is required.' });
    return;
  }
  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const plotCheck = validatePlotBelongsToProject(plot_id, projectIdNum);
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  let resolvedMaterialId: number | null = material_id ? Number(material_id) : null;
  let resolvedMaterialName = typeof material_name === 'string' ? material_name.trim() : '';

  if (resolvedMaterialId) {
    const mat = get<{ id: number; name: string }>('SELECT id, name FROM materials WHERE id = ?', [resolvedMaterialId]);
    if (!mat) {
      res.status(400).json({ error: 'Selected material does not exist.' });
      return;
    }
    if (!resolvedMaterialName) resolvedMaterialName = mat.name;
  } else if (resolvedMaterialName) {
    const mat = get<{ id: number; name: string }>('SELECT id, name FROM materials WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [
      resolvedMaterialName,
    ]);
    if (mat) {
      resolvedMaterialId = mat.id;
      resolvedMaterialName = mat.name;
    }
  }

  if (!resolvedMaterialName) {
    res.status(400).json({ error: 'Material selection is required.' });
    return;
  }

  const amt = Number(return_amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: 'Return amount must be greater than zero.' });
    return;
  }

  const qty = quantity !== undefined && quantity !== null && quantity !== '' ? Number(quantity) : null;
  if (qty !== null && (isNaN(qty) || qty < 0)) {
    res.status(400).json({ error: 'Return quantity cannot be negative.' });
    return;
  }

  const dateToUse = return_date || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(dateToUse)) {
    res.status(400).json({ error: 'Return date must be a valid YYYY-MM-DD date.' });
    return;
  }

  const validReturnedTo = returned_to === 'Client' || returned_to === 'Contractor' || returned_to === 'Other'
    ? returned_to
    : null;
  if (!validReturnedTo) {
    res.status(400).json({ error: 'Returned To must be Client, Contractor, or Other.' });
    return;
  }

  const purchaseCheck = validateMaterialReturnAgainstPurchases(
    projectIdNum,
    resolvedMaterialId,
    resolvedMaterialName,
    amt,
    qty
  );
  if (!purchaseCheck.valid) {
    res.status(400).json({ error: purchaseCheck.error });
    return;
  }

  const result = run(
    `INSERT INTO material_returns
      (project_id, plot_id, material_id, material_name, quantity, unit, return_amount, return_date, returned_to, recipient_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectIdNum,
      plotCheck.plotId,
      resolvedMaterialId,
      resolvedMaterialName,
      qty,
      unit ? String(unit).trim() : null,
      Math.round(amt * 100) / 100,
      dateToUse,
      validReturnedTo,
      recipient_name ? String(recipient_name).trim() : null,
      notes ? String(notes).trim() : null,
    ]
  );

  const created = get(
    `SELECT r.*, p.name as project_name, pl.name as plot_name
     FROM material_returns r
     JOIN projects p ON r.project_id = p.id
     LEFT JOIN plots pl ON r.plot_id = pl.id
     WHERE r.id = ?`,
    [result.lastInsertRowid]
  );
  res.status(201).json(created);
});

apiRouter.put('/material-returns/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const returnId = Number(req.params.id);
  const existing = get<any>('SELECT * FROM material_returns WHERE id = ?', [returnId]);
  if (!existing) {
    res.status(404).json({ error: 'Material return record not found.' });
    return;
  }

  const {
    project_id,
    plot_id,
    material_id,
    material_name,
    quantity,
    unit,
    return_amount,
    return_date,
    returned_to,
    recipient_name,
    notes,
  } = req.body;

  const projectIdNum = Number(project_id || existing.project_id);
  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const plotCheck = plot_id !== undefined
    ? validatePlotBelongsToProject(plot_id, projectIdNum)
    : validatePlotBelongsToProject(existing.plot_id, projectIdNum);
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  let resolvedMaterialId: number | null = material_id !== undefined
    ? (material_id ? Number(material_id) : null)
    : existing.material_id;
  let resolvedMaterialName = material_name !== undefined
    ? String(material_name).trim()
    : existing.material_name;

  if (resolvedMaterialId) {
    const mat = get<{ id: number; name: string }>('SELECT id, name FROM materials WHERE id = ?', [resolvedMaterialId]);
    if (!mat) {
      res.status(400).json({ error: 'Selected material does not exist.' });
      return;
    }
    if (!material_name) resolvedMaterialName = mat.name;
  } else if (resolvedMaterialName) {
    const mat = get<{ id: number; name: string }>('SELECT id, name FROM materials WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [
      resolvedMaterialName,
    ]);
    if (mat) {
      resolvedMaterialId = mat.id;
      resolvedMaterialName = mat.name;
    }
  }

  if (!resolvedMaterialName) {
    res.status(400).json({ error: 'Material selection is required.' });
    return;
  }

  const amt = return_amount !== undefined ? Number(return_amount) : Number(existing.return_amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: 'Return amount must be greater than zero.' });
    return;
  }

  const qty = quantity !== undefined
    ? (quantity !== null && quantity !== '' ? Number(quantity) : null)
    : existing.quantity;
  if (qty !== null && (isNaN(qty) || qty < 0)) {
    res.status(400).json({ error: 'Return quantity cannot be negative.' });
    return;
  }

  const dateToUse = return_date || existing.return_date;
  if (!isValidIsoDate(dateToUse)) {
    res.status(400).json({ error: 'Return date must be a valid YYYY-MM-DD date.' });
    return;
  }

  const targetReturnedTo = returned_to || existing.returned_to;
  if (targetReturnedTo !== 'Client' && targetReturnedTo !== 'Contractor' && targetReturnedTo !== 'Other') {
    res.status(400).json({ error: 'Returned To must be Client, Contractor, or Other.' });
    return;
  }

  const purchaseCheck = validateMaterialReturnAgainstPurchases(
    projectIdNum,
    resolvedMaterialId,
    resolvedMaterialName,
    amt,
    qty,
    returnId
  );
  if (!purchaseCheck.valid) {
    res.status(400).json({ error: purchaseCheck.error });
    return;
  }

  run(
    `UPDATE material_returns
     SET project_id = ?, plot_id = ?, material_id = ?, material_name = ?, quantity = ?, unit = ?,
         return_amount = ?, return_date = ?, returned_to = ?, recipient_name = ?, notes = ?
     WHERE id = ?`,
    [
      projectIdNum,
      plotCheck.plotId,
      resolvedMaterialId,
      resolvedMaterialName,
      qty,
      unit !== undefined ? (unit ? String(unit).trim() : null) : existing.unit,
      Math.round(amt * 100) / 100,
      dateToUse,
      targetReturnedTo,
      recipient_name !== undefined ? (recipient_name ? String(recipient_name).trim() : null) : existing.recipient_name,
      notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
      returnId,
    ]
  );

  const updated = get(
    `SELECT r.*, p.name as project_name, pl.name as plot_name
     FROM material_returns r
     JOIN projects p ON r.project_id = p.id
     LEFT JOIN plots pl ON r.plot_id = pl.id
     WHERE r.id = ?`,
    [returnId]
  );
  res.json(updated);
});

apiRouter.delete('/material-returns/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const returnId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, material_name, return_amount FROM material_returns WHERE id = ?', [returnId]);
  if (!existing) {
    res.status(404).json({ error: 'Material return record not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM material_returns WHERE id = ?', [returnId]);
    logAuditEvent({
      action: 'DELETE_MATERIAL_RETURN',
      entityType: 'material_return',
      entityId: returnId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= MATERIALS =================

apiRouter.get('/materials', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const materials = query('SELECT * FROM materials ORDER BY name ASC');
  res.json(materials);
});

apiRouter.post('/materials', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name, default_unit } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Material name is required.' });
    return;
  }

  const existing = get('SELECT id FROM materials WHERE LOWER(name) = LOWER(?)', [name.trim()]);
  if (existing) {
    res.json(existing);
    return;
  }

  const result = run('INSERT INTO materials (name, default_unit) VALUES (?, ?)', [
    name.trim(),
    default_unit ? default_unit.trim() : null,
  ]);
  const created = get('SELECT * FROM materials WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(created);
});

// ================= CONTRACTORS & TYPES =================

apiRouter.get('/contractor-types', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
  const sqlStr = activeOnly
    ? 'SELECT * FROM contractor_types WHERE is_active = 1 ORDER BY name ASC'
    : 'SELECT * FROM contractor_types ORDER BY is_active DESC, name ASC';
  const types = query(sqlStr);
  res.json(types);
});

apiRouter.post('/contractor-types', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    res.status(400).json({ error: 'Contract type name is required.' });
    return;
  }

  const existing = get<{ id: number; name: string; is_active: number }>(
    'SELECT * FROM contractor_types WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
    [trimmedName]
  );
  if (existing) {
    res.status(400).json({
      error: existing.is_active
        ? `Contract type "${existing.name}" already exists.`
        : `Contract type "${existing.name}" already exists (inactive). You can reactivate it from Manage Types.`,
    });
    return;
  }

  const result = run(
    'INSERT INTO contractor_types (name, default_rate, is_active) VALUES (?, NULL, 1)',
    [trimmedName]
  );
  const created = get('SELECT * FROM contractor_types WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(created);
});

apiRouter.put('/contractor-types/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const typeId = Number(req.params.id);
  const existing = get<{ id: number; name: string; is_active: number }>(
    'SELECT * FROM contractor_types WHERE id = ?',
    [typeId]
  );
  if (!existing) {
    res.status(404).json({ error: 'Contract type not found.' });
    return;
  }

  const { name, is_active } = req.body;
  const nextName = name !== undefined ? String(name).trim() : existing.name;
  if (!nextName) {
    res.status(400).json({ error: 'Contract type name cannot be empty.' });
    return;
  }

  const duplicate = get<{ id: number }>(
    'SELECT id FROM contractor_types WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?',
    [nextName, typeId]
  );
  if (duplicate) {
    res.status(400).json({ error: `Another contract type named "${nextName}" already exists.` });
    return;
  }

  const nextActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

  const updated = withTransaction(() => {
    run('UPDATE contractor_types SET name = ?, is_active = ? WHERE id = ?', [nextName, nextActive, typeId]);
    if (nextName !== existing.name) {
      run('UPDATE contracts SET contract_type = ? WHERE contract_type_id = ?', [nextName, typeId]);
    }
    return get('SELECT * FROM contractor_types WHERE id = ?', [typeId]);
  });

  res.json(updated);
});

apiRouter.get('/contractors', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractors = query<any>('SELECT * FROM contractors ORDER BY name ASC');
  const allContracts = query<any>('SELECT * FROM contracts');
  const allPayments = query<any>('SELECT * FROM contract_payments');

  const enriched = contractors.map((c) => {
    const stats = calculateContractorGlobalSummary(c.id, allContracts, allPayments);
    return {
      ...c,
      contracts_count: stats.totalContracts,
      total_contracts_amount: stats.totalContractsAmount,
      total_paid: stats.totalPaid,
      outstanding: stats.outstanding,
    };
  });

  res.json(enriched);
});

apiRouter.post('/contractors', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, type_name, notes } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Contractor name is required.' });
    return;
  }
  if (!type_name || !type_name.trim()) {
    res.status(400).json({ error: 'Contractor type is required.' });
    return;
  }

  const result = run(
    'INSERT INTO contractors (name, phone, type_name, notes) VALUES (?, ?, ?, ?)',
    [name.trim(), phone ? phone.trim() : null, type_name.trim(), notes ? notes.trim() : null]
  );

  const created = get('SELECT * FROM contractors WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(created);
});

// Contractor Profile / Global Khata
apiRouter.get('/contractors/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractorId = Number(req.params.id);
  const contractor = get('SELECT * FROM contractors WHERE id = ?', [contractorId]);
  if (!contractor) {
    res.status(404).json({ error: 'Contractor not found.' });
    return;
  }

  // All contracts for this contractor across ALL projects
  const contracts = query<any>(
    `SELECT c.*, p.name as project_name 
     FROM contracts c
     JOIN projects p ON c.project_id = p.id
     WHERE c.contractor_id = ?
     ORDER BY c.created_at DESC`,
    [contractorId]
  );

  const contractIds = contracts.map((c) => c.id);
  let payments: any[] = [];
  if (contractIds.length > 0) {
    const placeholders = contractIds.map(() => '?').join(',');
    payments = query<any>(
      `SELECT p.*, c.work_title, proj.name as project_name 
       FROM contract_payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN projects proj ON c.project_id = proj.id
       WHERE p.contract_id IN (${placeholders})
       ORDER BY p.payment_date DESC, p.id DESC`,
      contractIds
    );
  }

  // Calculate per-contract totals
  const contractsWithStatus = contracts.map((c) => {
    const paid = calculateContractPaid(c.id, payments);
    const outstanding = calculateContractOutstanding(c.contract_amount, paid);
    return {
      ...c,
      paid_amount: paid,
      outstanding_amount: outstanding,
    };
  });

  const globalSummary = calculateContractorGlobalSummary(contractorId, contracts, payments);

  res.json({
    contractor,
    contracts: contractsWithStatus,
    payments,
    globalSummary,
  });
});

apiRouter.put('/contractors/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractorId = Number(req.params.id);
  const { name, phone, type_name, notes } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Contractor name is required.' });
    return;
  }

  run(
    'UPDATE contractors SET name = ?, phone = ?, type_name = ?, notes = ? WHERE id = ?',
    [name.trim(), phone ? phone.trim() : null, type_name ? type_name.trim() : 'Other', notes || null, contractorId]
  );

  const updated = get('SELECT * FROM contractors WHERE id = ?', [contractorId]);
  res.json(updated);
});

apiRouter.delete('/contractors/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractorId = Number(req.params.id);
  const existing = get<any>('SELECT id, name FROM contractors WHERE id = ?', [contractorId]);
  if (!existing) {
    res.status(404).json({ error: 'Contractor not found.' });
    return;
  }
  // Check if contracts exist
  const existingContracts = query('SELECT id FROM contracts WHERE contractor_id = ?', [contractorId]);
  if (existingContracts.length > 0) {
    res.status(400).json({
      error: `Cannot delete contractor: ${existingContracts.length} contract(s) exist. Please remove or reassign the contracts first.`,
    });
    return;
  }

  withTransaction(() => {
    run('DELETE FROM contractors WHERE id = ?', [contractorId]);
    logAuditEvent({
      action: 'DELETE_CONTRACTOR',
      entityType: 'contractor',
      entityId: contractorId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= CONTRACTS (THEKA) & PAYMENTS =================

apiRouter.get('/contracts', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;
  let sqlStr = `
    SELECT c.*, p.name as project_name, cont.name as contractor_name, cont.phone as contractor_phone, cont.type_name as contractor_type
    FROM contracts c
    JOIN projects p ON c.project_id = p.id
    JOIN contractors cont ON c.contractor_id = cont.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND c.project_id = ?';
    params.push(Number(projectId));
  }
  sqlStr += ' ORDER BY c.created_at DESC';

  const contracts = query<any>(sqlStr, params);
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');

  const enriched = contracts.map((c) => {
    const paid = calculateContractPaid(c.id, allPayments);
    const outstanding = calculateContractOutstanding(c.contract_amount, paid);
    return {
      ...c,
      paid_amount: paid,
      outstanding_amount: outstanding,
    };
  });

  res.json(enriched);
});

apiRouter.post('/contracts', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { project_id, contractor_id, contract_type_id, contract_type, work_title, contract_amount, contract_date, notes } = req.body;

  if (!project_id) {
    res.status(400).json({ error: 'Project is required.' });
    return;
  }
  if (!contractor_id) {
    res.status(400).json({ error: 'Contractor is required.' });
    return;
  }
  if (!work_title || !work_title.trim()) {
    res.status(400).json({ error: 'Work description/title is required.' });
    return;
  }
  const amount = Number(contract_amount);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'Contract amount must be a positive number.' });
    return;
  }

  let resolvedTypeId: number | null = contract_type_id ? Number(contract_type_id) : null;
  let resolvedTypeName: string | null = contract_type ? String(contract_type).trim() : null;

  if (resolvedTypeId) {
    const ct = get<{ id: number; name: string; is_active: number }>(
      'SELECT id, name, is_active FROM contractor_types WHERE id = ?',
      [resolvedTypeId]
    );
    if (!ct) {
      res.status(400).json({ error: 'Selected contract type does not exist.' });
      return;
    }
    if (!ct.is_active) {
      res.status(400).json({ error: 'Selected contract type is inactive. Please pick an active contract type.' });
      return;
    }
    resolvedTypeName = ct.name;
  } else if (resolvedTypeName) {
    const ct = get<{ id: number; name: string }>(
      'SELECT id, name FROM contractor_types WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
      [resolvedTypeName]
    );
    if (ct) {
      resolvedTypeId = ct.id;
      resolvedTypeName = ct.name;
    }
  }

  const dateToUse = contract_date || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(dateToUse)) {
    res.status(400).json({ error: 'Contract date must be a valid YYYY-MM-DD date.' });
    return;
  }

  const result = run(
    'INSERT INTO contracts (project_id, contractor_id, contract_type_id, contract_type, work_title, contract_amount, contract_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [Number(project_id), Number(contractor_id), resolvedTypeId, resolvedTypeName, work_title.trim(), amount, dateToUse, notes || null]
  );

  const created = get('SELECT * FROM contracts WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({
    ...created,
    paid_amount: 0,
    outstanding_amount: amount,
  });
});

apiRouter.put('/contracts/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractId = Number(req.params.id);
  const { contract_type_id, contract_type, work_title, contract_amount, contract_date, notes } = req.body;

  const existing = get<any>('SELECT * FROM contracts WHERE id = ?', [contractId]);
  if (!existing) {
    res.status(404).json({ error: 'Contract not found.' });
    return;
  }

  const newAmount = Number(contract_amount);
  if (isNaN(newAmount) || newAmount <= 0) {
    res.status(400).json({ error: 'Contract amount must be a positive number.' });
    return;
  }

  // Check already paid
  const paidRows = query<{ amount: number }>('SELECT amount FROM contract_payments WHERE contract_id = ?', [contractId]);
  const totalPaid = paidRows.reduce((sum, p) => sum + Number(p.amount), 0);

  if (newAmount < totalPaid) {
    res.status(400).json({
      error: `Contract amount cannot be reduced below already paid amount (Rs. ${totalPaid.toLocaleString()}).`,
    });
    return;
  }

  let resolvedTypeId: number | null = contract_type_id !== undefined
    ? (contract_type_id ? Number(contract_type_id) : null)
    : existing.contract_type_id;
  let resolvedTypeName: string | null = contract_type !== undefined
    ? (contract_type ? String(contract_type).trim() : null)
    : existing.contract_type;

  if (contract_type_id !== undefined && resolvedTypeId) {
    const ct = get<{ id: number; name: string }>('SELECT id, name FROM contractor_types WHERE id = ?', [resolvedTypeId]);
    if (ct) resolvedTypeName = ct.name;
  }

  const dateToUse = contract_date || existing.contract_date || new Date().toISOString().slice(0, 10);

  run(
    'UPDATE contracts SET contract_type_id = ?, contract_type = ?, work_title = ?, contract_amount = ?, contract_date = ?, notes = ? WHERE id = ?',
    [
      resolvedTypeId,
      resolvedTypeName,
      work_title ? work_title.trim() : existing.work_title,
      newAmount,
      dateToUse,
      notes !== undefined ? notes : existing.notes,
      contractId,
    ]
  );

  const updated = get('SELECT * FROM contracts WHERE id = ?', [contractId]);
  res.json({
    ...updated,
    paid_amount: totalPaid,
    outstanding_amount: calculateContractOutstanding(newAmount, totalPaid),
  });
});

apiRouter.delete('/contracts/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, work_title, contract_amount FROM contracts WHERE id = ?', [contractId]);
  if (!existing) {
    res.status(404).json({ error: 'Contract not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM contract_payments WHERE contract_id = ?', [contractId]);
    run('DELETE FROM contracts WHERE id = ?', [contractId]);
    logAuditEvent({
      action: 'DELETE_CONTRACT',
      entityType: 'contract',
      entityId: contractId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// PAYMENTS (Contractor Expenses)
apiRouter.get('/contract-payments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, contractorId, contractId } = req.query;
  let sqlStr = `
    SELECT p.*, c.project_id, c.contractor_id, c.work_title, c.contract_type, c.contract_amount,
           cont.name as contractor_name, proj.name as project_name
    FROM contract_payments p
    JOIN contracts c ON p.contract_id = c.id
    JOIN contractors cont ON c.contractor_id = cont.id
    JOIN projects proj ON c.project_id = proj.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND c.project_id = ?';
    params.push(Number(projectId));
  }
  if (contractorId) {
    sqlStr += ' AND c.contractor_id = ?';
    params.push(Number(contractorId));
  }
  if (contractId) {
    sqlStr += ' AND p.contract_id = ?';
    params.push(Number(contractId));
  }
  sqlStr += ' ORDER BY p.payment_date DESC, p.id DESC';
  res.json(query(sqlStr, params));
});

apiRouter.post('/contract-payments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { project_id, contractor_id, contract_id, amount, payment_date, payment_method, notes, request_id } = req.body;

  if (!contract_id) {
    res.status(400).json({ error: 'Contract is required.' });
    return;
  }

  const contract = get<{ id: number; contract_amount: number; project_id: number; contractor_id: number; work_title: string }>(
    'SELECT id, contract_amount, project_id, contractor_id, work_title FROM contracts WHERE id = ?',
    [Number(contract_id)]
  );
  if (!contract) {
    res.status(404).json({ error: 'Contract not found.' });
    return;
  }

  if (project_id !== undefined && project_id !== null && project_id !== '' && Number(contract.project_id) !== Number(project_id)) {
    res.status(400).json({ error: 'Selected contract does not belong to the chosen project.' });
    return;
  }

  if (contractor_id !== undefined && contractor_id !== null && contractor_id !== '' && Number(contract.contractor_id) !== Number(contractor_id)) {
    res.status(400).json({ error: 'Selected contract does not belong to the chosen contractor.' });
    return;
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    return;
  }

  const dateToUse = payment_date || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(dateToUse)) {
    res.status(400).json({ error: 'Payment date must be a valid YYYY-MM-DD date.' });
    return;
  }

  const rawRequestId =
    typeof request_id === 'string' && request_id.trim()
      ? request_id.trim().slice(0, 128)
      : typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim()
      ? req.headers['x-request-id'].trim().slice(0, 128)
      : null;

  try {
    const outcome = withTransaction(() => {
      if (rawRequestId) {
        const existingByReq = get<any>(
          `SELECT p.*, c.project_id, c.contractor_id, c.work_title, cont.name as contractor_name, proj.name as project_name
           FROM contract_payments p
           JOIN contracts c ON p.contract_id = c.id
           JOIN contractors cont ON c.contractor_id = cont.id
           JOIN projects proj ON c.project_id = proj.id
           WHERE p.request_id = ?`,
          [rawRequestId]
        );
        if (existingByReq) {
          return { payment: existingByReq, replayed: true, validationError: null as any };
        }
      }

      const paidPayments = query<{ amount: number }>('SELECT amount FROM contract_payments WHERE contract_id = ?', [
        contract.id,
      ]);
      const totalPaid = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const validation = validatePaymentAmount(contract.contract_amount, totalPaid, paymentAmount);
      if (!validation.valid) {
        return {
          payment: null,
          replayed: false,
          validationError: {
            error: validation.error || 'Payment exceeds remaining contract balance.',
            remainingBalance: validation.remainingBalance,
          },
        };
      }

      const result = run(
        'INSERT INTO contract_payments (contract_id, amount, payment_date, payment_method, notes, request_id) VALUES (?, ?, ?, ?, ?, ?)',
        [contract.id, Math.round(paymentAmount * 100) / 100, dateToUse, payment_method || 'Cash', notes || null, rawRequestId]
      );

      const created = get<any>(
        `SELECT p.*, c.project_id, c.contractor_id, c.work_title, cont.name as contractor_name, proj.name as project_name
         FROM contract_payments p
         JOIN contracts c ON p.contract_id = c.id
         JOIN contractors cont ON c.contractor_id = cont.id
         JOIN projects proj ON c.project_id = proj.id
         WHERE p.id = ?`,
        [result.lastInsertRowid]
      );

      logAuditEvent({
        action: 'CREATE_CONTRACT_PAYMENT',
        entityType: 'contract_payment',
        entityId: created.id,
        actorId: req.user?.id,
        actorUsername: req.user?.username,
        details: {
          project_id: contract.project_id,
          contractor_id: contract.contractor_id,
          contract_id: contract.id,
          amount: created.amount,
          payment_date: dateToUse,
          request_id: rawRequestId,
        },
      });

      return { payment: created, replayed: false, validationError: null };
    });

    if (outcome.validationError) {
      res.status(400).json(outcome.validationError);
      return;
    }

    res.status(outcome.replayed ? 200 : 201).json(outcome.payment);
  } catch (err: any) {
    console.error('[CONTRACT_PAYMENTS] Failed to persist payment:', err);
    res.status(500).json({ error: err?.message || 'Failed to save contractor payment.' });
  }
});

apiRouter.put('/contract-payments/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const paymentId = Number(req.params.id);
  const { amount, payment_date, payment_method, notes } = req.body;

  const existingPayment = get<{ id: number; contract_id: number; amount: number }>(
    'SELECT * FROM contract_payments WHERE id = ?',
    [paymentId]
  );
  if (!existingPayment) {
    res.status(404).json({ error: 'Payment not found.' });
    return;
  }

  const contract = get<{ id: number; contract_amount: number }>(
    'SELECT * FROM contracts WHERE id = ?',
    [existingPayment.contract_id]
  );
  if (!contract) {
    res.status(404).json({ error: 'Contract not found.' });
    return;
  }

  const newAmount = Number(amount);
  if (isNaN(newAmount) || newAmount <= 0) {
    res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    return;
  }

  // Total paid excluding this payment
  const otherPayments = query<{ amount: number }>(
    'SELECT amount FROM contract_payments WHERE contract_id = ? AND id != ?',
    [contract.id, paymentId]
  );
  const paidExcludingThis = otherPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const validation = validatePaymentAmount(contract.contract_amount, paidExcludingThis, newAmount);
  if (!validation.valid) {
    res.status(400).json({
      error: validation.error || 'Payment exceeds remaining contract balance.',
      remainingBalance: validation.remainingBalance,
    });
    return;
  }

  run(
    'UPDATE contract_payments SET amount = ?, payment_date = ?, payment_method = ?, notes = ? WHERE id = ?',
    [newAmount, payment_date || new Date().toISOString().slice(0, 10), payment_method || 'Cash', notes || null, paymentId]
  );

  const updated = get('SELECT * FROM contract_payments WHERE id = ?', [paymentId]);
  res.json(updated);
});

apiRouter.delete('/contract-payments/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const paymentId = Number(req.params.id);
  const existing = get<any>('SELECT id, contract_id, amount FROM contract_payments WHERE id = ?', [paymentId]);
  if (!existing) {
    res.status(404).json({ error: 'Payment not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM contract_payments WHERE id = ?', [paymentId]);
    logAuditEvent({
      action: 'DELETE_CONTRACT_PAYMENT',
      entityType: 'contract_payment',
      entityId: paymentId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= INCOMES =================

apiRouter.get('/incomes', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, plotId } = req.query;
  let sqlStr = `
    SELECT i.*, p.name as project_name, pl.name as plot_name
    FROM incomes i
    JOIN projects p ON i.project_id = p.id
    LEFT JOIN plots pl ON i.plot_id = pl.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND i.project_id = ?';
    params.push(Number(projectId));
  }
  if (plotId === 'unallocated') {
    sqlStr += ' AND i.plot_id IS NULL';
  } else if (plotId) {
    sqlStr += ' AND i.plot_id = ?';
    params.push(Number(plotId));
  }
  sqlStr += ' ORDER BY i.income_date DESC, i.id DESC';

  const rows = query(sqlStr, params);
  res.json(rows);
});

apiRouter.post('/incomes', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { project_id, plot_id, amount, income_date, source_customer, notes } = req.body;

  const projectIdNum = Number(project_id);
  if (!projectIdNum) {
    res.status(400).json({ error: 'Project is required.' });
    return;
  }
  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const plotCheck = validatePlotBelongsToProject(plot_id, projectIdNum);
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: 'Income amount must be greater than zero.' });
    return;
  }

  const dateToUse = income_date || new Date().toISOString().slice(0, 10);
  const result = run(
    'INSERT INTO incomes (project_id, plot_id, amount, income_date, source_customer, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [projectIdNum, plotCheck.plotId, amt, dateToUse, source_customer ? source_customer.trim() : null, notes || null]
  );

  const created = get(
    `SELECT i.*, p.name as project_name, pl.name as plot_name
     FROM incomes i
     JOIN projects p ON i.project_id = p.id
     LEFT JOIN plots pl ON i.plot_id = pl.id
     WHERE i.id = ?`,
    [result.lastInsertRowid]
  );
  res.status(201).json(created);
});

apiRouter.put('/incomes/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const incomeId = Number(req.params.id);
  const existing = get<any>('SELECT * FROM incomes WHERE id = ?', [incomeId]);
  if (!existing) {
    res.status(404).json({ error: 'Income record not found.' });
    return;
  }

  const { project_id, plot_id, amount, income_date, source_customer, notes } = req.body;
  const projectIdNum = Number(project_id || existing.project_id);
  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const plotCheck = plot_id !== undefined
    ? validatePlotBelongsToProject(plot_id, projectIdNum)
    : validatePlotBelongsToProject(existing.plot_id, projectIdNum);
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: 'Income amount must be greater than zero.' });
    return;
  }

  run(
    'UPDATE incomes SET project_id = ?, plot_id = ?, amount = ?, income_date = ?, source_customer = ?, notes = ? WHERE id = ?',
    [projectIdNum, plotCheck.plotId, amt, income_date || existing.income_date, source_customer || null, notes || null, incomeId]
  );

  const updated = get(
    `SELECT i.*, p.name as project_name, pl.name as plot_name
     FROM incomes i
     JOIN projects p ON i.project_id = p.id
     LEFT JOIN plots pl ON i.plot_id = pl.id
     WHERE i.id = ?`,
    [incomeId]
  );
  res.json(updated);
});

apiRouter.delete('/incomes/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const incomeId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, amount, source_customer FROM incomes WHERE id = ?', [incomeId]);
  if (!existing) {
    res.status(404).json({ error: 'Income record not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM incomes WHERE id = ?', [incomeId]);
    logAuditEvent({
      action: 'DELETE_INCOME',
      entityType: 'income',
      entityId: incomeId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= PLOTS & KHATAS =================

apiRouter.get('/plots', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;
  let sqlStr = 'SELECT * FROM plots WHERE 1=1';
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND project_id = ?';
    params.push(Number(projectId));
  }
  sqlStr += ' ORDER BY name ASC';
  res.json(query(sqlStr, params));
});

apiRouter.post('/plots', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { project_id, name } = req.body;
  const projectIdNum = Number(project_id);
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!projectIdNum || isNaN(projectIdNum) || !trimmedName) {
    res.status(400).json({ error: 'Project and plot name are required.' });
    return;
  }

  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const duplicate = get<{ id: number; name: string }>(
    'SELECT id, name FROM plots WHERE project_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))',
    [projectIdNum, trimmedName]
  );
  if (duplicate) {
    res.status(400).json({ error: `Plot "${duplicate.name}" already exists in this project.` });
    return;
  }

  const result = run('INSERT INTO plots (project_id, name) VALUES (?, ?)', [
    projectIdNum,
    trimmedName,
  ]);
  const created = get('SELECT * FROM plots WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(created);
});

apiRouter.delete('/plots/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const plotId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, name FROM plots WHERE id = ?', [plotId]);
  if (!existing) {
    res.status(404).json({ error: 'Plot not found.' });
    return;
  }
  withTransaction(() => {
    run('UPDATE khatas SET plot_id = NULL WHERE plot_id = ?', [plotId]);
    run('UPDATE expenses SET plot_id = NULL WHERE plot_id = ?', [plotId]);
    run('UPDATE material_returns SET plot_id = NULL WHERE plot_id = ?', [plotId]);
    run('UPDATE incomes SET plot_id = NULL WHERE plot_id = ?', [plotId]);
    run('DELETE FROM plots WHERE id = ?', [plotId]);
    logAuditEvent({
      action: 'DELETE_PLOT',
      entityType: 'plot',
      entityId: plotId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

apiRouter.get('/khatas', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, plotId } = req.query;
  let sqlStr = 'SELECT * FROM khatas WHERE 1=1';
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND project_id = ?';
    params.push(Number(projectId));
  }
  if (plotId) {
    sqlStr += ' AND plot_id = ?';
    params.push(Number(plotId));
  }
  sqlStr += ' ORDER BY name ASC';
  res.json(query(sqlStr, params));
});

apiRouter.post('/khatas', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { project_id, plot_id, name } = req.body;
  const projectIdNum = Number(project_id);
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!projectIdNum || isNaN(projectIdNum) || !trimmedName) {
    res.status(400).json({ error: 'Project and khata name are required.' });
    return;
  }

  const project = get('SELECT id FROM projects WHERE id = ?', [projectIdNum]);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const plotCheck = validatePlotBelongsToProject(plot_id, projectIdNum);
  if (plotCheck.error) {
    res.status(400).json({ error: plotCheck.error });
    return;
  }

  const result = run('INSERT INTO khatas (project_id, plot_id, name) VALUES (?, ?, ?)', [
    projectIdNum,
    plotCheck.plotId,
    trimmedName,
  ]);
  const created = get('SELECT * FROM khatas WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(created);
});

apiRouter.delete('/khatas/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const khataId = Number(req.params.id);
  const existing = get<any>('SELECT id, project_id, name FROM khatas WHERE id = ?', [khataId]);
  if (!existing) {
    res.status(404).json({ error: 'Khata not found.' });
    return;
  }
  withTransaction(() => {
    run('DELETE FROM khatas WHERE id = ?', [khataId]);
    logAuditEvent({
      action: 'DELETE_KHATA',
      entityType: 'khata',
      entityId: khataId,
      actorId: req.user?.id,
      actorUsername: req.user?.username,
      details: existing,
    });
  });
  res.json({ success: true });
});

// ================= HOME OVERVIEW =================

apiRouter.get('/home/overview', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const projects = query<any>('SELECT id, name, status FROM projects');
  const allExpenses = query<any>('SELECT project_id, amount, quantity, rate, category FROM expenses');
  const allContracts = query<any>('SELECT id, project_id, contract_amount FROM contracts');
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');
  const allIncomes = query<any>('SELECT project_id, amount FROM incomes');
  const allReturns = query<any>('SELECT project_id, return_amount FROM material_returns');

  let totalProjectCost = 0;
  let totalOutstanding = 0;
  let totalIncome = 0;

  for (const p of projects) {
    const projExpenses = allExpenses.filter((e) => e.project_id === p.id);
    const projContracts = allContracts.filter((c) => c.project_id === p.id);
    const projIncomes = allIncomes.filter((i) => i.project_id === p.id);
    const projReturns = allReturns.filter((r) => r.project_id === p.id);
    const summary = calculateProjectSummary(projExpenses, projContracts, allPayments, projIncomes, projReturns);

    totalProjectCost += summary.totalProjectCost;
    totalOutstanding += summary.outstanding;
    totalIncome += summary.totalIncome;
  }

  // Recent activity across all projects
  const recentExpenses = query<any>(
    `SELECT e.id, e.material_name as title, e.amount, e.quantity, e.unit, e.rate, 
            e.category, e.expense_date as date, p.name as project_name, 'expense' as type
     FROM expenses e
     JOIN projects p ON e.project_id = p.id
     ORDER BY e.expense_date DESC, e.id DESC LIMIT 10`
  ).map((e) => ({
    ...e,
    calculated_amount: calculateExpenseAmount(e.amount, e.quantity, e.rate),
    subtitle: `${e.project_name} • ${e.category === 'Material' ? 'Material Expense' : 'Other Expense'}`,
  }));

  const recentPayments = query<any>(
    `SELECT p.id, c.work_title, cont.name as contractor_name, p.amount, 
            p.payment_date as date, proj.name as project_name, 'payment' as type
     FROM contract_payments p
     JOIN contracts c ON p.contract_id = c.id
     JOIN contractors cont ON c.contractor_id = cont.id
     JOIN projects proj ON c.project_id = proj.id
     ORDER BY p.payment_date DESC, p.id DESC LIMIT 10`
  ).map((p) => ({
    ...p,
    title: `${p.contractor_name} - ${p.work_title}`,
    calculated_amount: p.amount,
    subtitle: `${p.project_name} • Contractor Expense`,
  }));

  const recentReturns = query<any>(
    `SELECT r.id, r.material_name, r.return_amount as amount, r.quantity, r.unit,
            r.return_date as date, r.returned_to, p.name as project_name, 'material_return' as type
     FROM material_returns r
     JOIN projects p ON r.project_id = p.id
     ORDER BY r.return_date DESC, r.id DESC LIMIT 10`
  ).map((r) => ({
    ...r,
    title: `${r.material_name} Return`,
    calculated_amount: r.amount,
    subtitle: `${r.project_name} • Material Return (${r.returned_to})`,
  }));

  const combinedActivity = [...recentExpenses, ...recentPayments, ...recentReturns]
    .sort((a, b) => {
      if (b.date === a.date) return (b.id || 0) - (a.id || 0);
      return b.date.localeCompare(a.date);
    })
    .slice(0, 8);

  res.json({
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'Active').length,
    totalProjectCost,
    totalOutstanding,
    totalIncome,
    recentActivity: combinedActivity,
  });
});

// ================= REPORTS =================

// 1. Project Expense Report
apiRouter.get('/reports/project-expense', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;
  const projects = projectId
    ? query<any>('SELECT * FROM projects WHERE id = ?', [Number(projectId)])
    : query<any>('SELECT * FROM projects ORDER BY name ASC');

  const allExpenses = query<any>('SELECT project_id, amount, quantity, rate, category FROM expenses');
  const allContracts = query<any>('SELECT id, project_id, contract_amount FROM contracts');
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');
  const allIncomes = query<any>('SELECT project_id, amount FROM incomes');
  const allReturns = query<any>('SELECT project_id, return_amount FROM material_returns');

  const report = projects.map((p) => {
    const projExpenses = allExpenses.filter((e) => e.project_id === p.id);
    const projContracts = allContracts.filter((c) => c.project_id === p.id);
    const projIncomes = allIncomes.filter((i) => i.project_id === p.id);
    const projReturns = allReturns.filter((r) => r.project_id === p.id);
    const summary = calculateProjectSummary(projExpenses, projContracts, allPayments, projIncomes, projReturns);

    return {
      project_id: p.id,
      project_name: p.name,
      material_expenses: summary.materialExpenses,
      gross_material_expenses: summary.grossMaterialExpenses,
      material_returns: summary.materialReturns,
      other_expenses: summary.otherExpenses,
      theka_cost: summary.thekaCost,
      theka_paid: summary.thekaPaid,
      contractor_paid: summary.thekaPaid,
      total_cost: summary.totalProjectCost,
      total_project_cost: summary.totalProjectCost,
      total_paid: summary.totalPaid,
      outstanding: summary.outstanding,
    };
  });

  res.json(report);
});

// 2. Daily Expense Report
apiRouter.get('/reports/daily-expense', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const { projectId } = req.query;

  let sqlStr = `
    SELECT e.*, p.name as project_name
    FROM expenses e
    JOIN projects p ON e.project_id = p.id
    WHERE e.expense_date = ?
  `;
  const params: any[] = [dateStr];
  if (projectId) {
    sqlStr += ' AND e.project_id = ?';
    params.push(Number(projectId));
  }
  sqlStr += ' ORDER BY e.id DESC';

  const expenses = query<any>(sqlStr, params).map((e) => ({
    ...e,
    calculated_amount: calculateExpenseAmount(e.amount, e.quantity, e.rate),
  }));

  const totalExpense = expenses.reduce((sum, e) => sum + (e.calculated_amount || e.amount || 0), 0);

  // Material Returns on this date
  let returnSql = `
    SELECT r.*, p.name as project_name, pl.name as plot_name
    FROM material_returns r
    JOIN projects p ON r.project_id = p.id
    LEFT JOIN plots pl ON r.plot_id = pl.id
    WHERE r.return_date = ?
  `;
  const returnParams: any[] = [dateStr];
  if (projectId) {
    returnSql += ' AND r.project_id = ?';
    returnParams.push(Number(projectId));
  }
  returnSql += ' ORDER BY r.id DESC';
  const materialReturns = query<any>(returnSql, returnParams);
  const totalReturns = materialReturns.reduce((sum, r) => sum + Number(r.return_amount || 0), 0);

  // Also fetch any contractor payments on this date
  let paymentSql = `
    SELECT p.*, c.work_title, cont.name as contractor_name, proj.name as project_name
    FROM contract_payments p
    JOIN contracts c ON p.contract_id = c.id
    JOIN contractors cont ON c.contractor_id = cont.id
    JOIN projects proj ON c.project_id = proj.id
    WHERE p.payment_date = ?
  `;
  const paymentParams: any[] = [dateStr];
  if (projectId) {
    paymentSql += ' AND c.project_id = ?';
    paymentParams.push(Number(projectId));
  }
  const payments = query<any>(paymentSql, paymentParams);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const netExpense = Math.max(0, totalExpense - totalReturns);
  const grandTotal = Math.max(0, totalExpense - totalReturns + totalPayments);

  res.json({
    date: dateStr,
    expenses,
    materialReturns,
    payments,
    totalExpense,
    totalReturns,
    netExpense,
    totalPayments,
    grandTotal,
    totalOutflow: grandTotal,
  });
});

// 3. Material Report
apiRouter.get('/reports/materials', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;
  let sqlStr = 'SELECT material_name, amount, quantity, unit, rate FROM expenses WHERE category = "Material"';
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND project_id = ?';
    params.push(Number(projectId));
  }

  const rows = query<any>(sqlStr, params);

  let retSqlStr = 'SELECT material_name, return_amount, quantity, unit FROM material_returns WHERE 1=1';
  const retParams: any[] = [];
  if (projectId) {
    retSqlStr += ' AND project_id = ?';
    retParams.push(Number(projectId));
  }
  const returnRows = query<any>(retSqlStr, retParams);

  // Group by normalized material name
  const grouped: Record<string, {
    material: string;
    material_name: string;
    quantity: number;
    total_quantity: number;
    purchased_quantity: number;
    returned_quantity: number;
    unit: string;
    purchased_cost: number;
    returned_cost: number;
    net_cost: number;
    total_cost: number;
    entries_count: number;
    returns_count: number;
  }> = {};

  for (const r of rows) {
    const rawName = (r.material_name || 'Unspecified').trim();
    const key = rawName.toLowerCase();
    const calculatedAmt = calculateExpenseAmount(r.amount, r.quantity, r.rate);
    const q = Number(r.quantity) || 0;
    const unit = r.unit || '';

    if (!grouped[key]) {
      grouped[key] = {
        material: rawName,
        material_name: rawName,
        quantity: q,
        total_quantity: q,
        purchased_quantity: q,
        returned_quantity: 0,
        unit,
        purchased_cost: calculatedAmt,
        returned_cost: 0,
        net_cost: calculatedAmt,
        total_cost: calculatedAmt,
        entries_count: 1,
        returns_count: 0,
      };
    } else {
      grouped[key].purchased_quantity += q;
      grouped[key].quantity += q;
      grouped[key].total_quantity += q;
      grouped[key].purchased_cost += calculatedAmt;
      grouped[key].net_cost += calculatedAmt;
      grouped[key].total_cost += calculatedAmt;
      grouped[key].entries_count += 1;
      if (!grouped[key].unit && unit) {
        grouped[key].unit = unit;
      }
    }
  }

  for (const ret of returnRows) {
    const rawName = (ret.material_name || 'Unspecified').trim();
    const key = rawName.toLowerCase();
    const retAmt = Number(ret.return_amount) || 0;
    const retQty = Number(ret.quantity) || 0;
    if (!grouped[key]) {
      grouped[key] = {
        material: rawName,
        material_name: rawName,
        quantity: 0,
        total_quantity: 0,
        purchased_quantity: 0,
        returned_quantity: retQty,
        unit: ret.unit || '',
        purchased_cost: 0,
        returned_cost: retAmt,
        net_cost: 0,
        total_cost: 0,
        entries_count: 0,
        returns_count: 1,
      };
    } else {
      grouped[key].returned_quantity += retQty;
      grouped[key].returned_cost += retAmt;
      grouped[key].returns_count += 1;
    }
  }

  const result = Object.values(grouped)
    .map((item) => {
      const netQty = Math.max(0, Math.round((item.purchased_quantity - item.returned_quantity) * 100) / 100);
      const netCost = Math.max(0, Math.round((item.purchased_cost - item.returned_cost) * 100) / 100);
      return {
        ...item,
        quantity: netQty,
        total_quantity: netQty,
        net_cost: netCost,
        total_cost: netCost,
      };
    })
    .sort((a, b) => b.total_cost - a.total_cost);

  res.json(result);
});

// 4. Contractor Report
apiRouter.get('/reports/contractors', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;

  let sqlStr = `
    SELECT c.id, c.work_title, c.contract_amount, cont.id as contractor_id, cont.name as contractor_name, 
           cont.type_name, p.id as project_id, p.name as project_name
    FROM contracts c
    JOIN contractors cont ON c.contractor_id = cont.id
    JOIN projects p ON c.project_id = p.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (projectId) {
    sqlStr += ' AND c.project_id = ?';
    params.push(Number(projectId));
  }
  sqlStr += ' ORDER BY cont.name ASC, c.created_at DESC';

  const contracts = query<any>(sqlStr, params);
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');

  const report = contracts.map((c) => {
    const paid = calculateContractPaid(c.id, allPayments);
    const outstanding = calculateContractOutstanding(c.contract_amount, paid);
    return {
      contract_id: c.id,
      contractor_id: c.contractor_id,
      contractor_name: c.contractor_name,
      contractor_type: c.type_name,
      type_name: c.type_name,
      project_id: c.project_id,
      project_name: c.project_name,
      work_title: c.work_title,
      contract_amount: c.contract_amount,
      total_contracts_amount: c.contract_amount,
      total_paid: paid,
      outstanding,
    };
  });

  res.json(report);
});

// 5. Outstanding Report (Contractors with outstanding balances > 0)
apiRouter.get('/reports/outstanding', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const contractors = query<any>('SELECT * FROM contractors ORDER BY name ASC');
  const allContracts = query<any>(
    `SELECT c.*, p.name as project_name 
     FROM contracts c
     JOIN projects p ON c.project_id = p.id`
  );
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');

  const outstandingContractors = contractors
    .map((cont) => {
      const contContracts = allContracts.filter((c) => c.contractor_id === cont.id);
      const enrichedContracts = contContracts
        .map((c) => {
          const paid = calculateContractPaid(c.id, allPayments);
          const outstanding = calculateContractOutstanding(c.contract_amount, paid);
          return {
            ...c,
            total_paid: paid,
            outstanding,
          };
        })
        .filter((c) => c.outstanding > 0);

      const totalContracts = contContracts.reduce((sum, c) => sum + Number(c.contract_amount), 0);
      const contractIds = new Set(contContracts.map((c) => c.id));
      const totalPaid = allPayments
        .filter((p) => contractIds.has(p.contract_id))
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalOutstanding = Math.max(0, totalContracts - totalPaid);

      return {
        id: cont.id,
        name: cont.name,
        phone: cont.phone,
        type_name: cont.type_name,
        notes: cont.notes,
        contractor: cont,
        contracts: enrichedContracts,
        total_contracts_amount: totalContracts,
        total_paid: totalPaid,
        outstanding: totalOutstanding,
      };
    })
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  res.json(outstandingContractors);
});

// 6. Project Income vs Expense
apiRouter.get('/reports/income-vs-expense', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.query;
  const projects = projectId
    ? query<any>('SELECT * FROM projects WHERE id = ?', [Number(projectId)])
    : query<any>('SELECT * FROM projects ORDER BY name ASC');

  const allExpenses = query<any>('SELECT project_id, amount, quantity, rate, category FROM expenses');
  const allContracts = query<any>('SELECT id, project_id, contract_amount FROM contracts');
  const allPayments = query<any>('SELECT contract_id, amount FROM contract_payments');
  const allIncomes = query<any>('SELECT project_id, amount FROM incomes');
  const allReturns = query<any>('SELECT project_id, return_amount FROM material_returns');

  const rows = projects.map((p) => {
    const projExpenses = allExpenses.filter((e) => e.project_id === p.id);
    const projContracts = allContracts.filter((c) => c.project_id === p.id);
    const projIncomes = allIncomes.filter((i) => i.project_id === p.id);
    const projReturns = allReturns.filter((r) => r.project_id === p.id);
    const summary = calculateProjectSummary(projExpenses, projContracts, allPayments, projIncomes, projReturns);

    return {
      project_id: p.id,
      project_name: p.name,
      income: summary.totalIncome,
      total_income: summary.totalIncome,
      project_cost: summary.totalProjectCost,
      total_project_cost: summary.totalProjectCost,
      actual_paid: summary.totalPaid,
      outstanding: summary.outstanding,
      net: summary.net,
    };
  });

  res.json(rows);
});

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

function resolveAppRoot(): string {
  const candidates: string[] = [];
  try {
    if (typeof __dirname === 'string' && __dirname) {
      candidates.push(__dirname);
    }
  } catch {
    // ignore in strict ESM
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      candidates.push(path.dirname(fileURLToPath(import.meta.url)));
    }
  } catch {
    // ignore in CJS bundles
  }
  candidates.push(process.cwd());

  for (const startDir of candidates) {
    let cur = path.resolve(startDir);
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(cur, 'package.json'))) {
        return cur;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }
  return path.resolve(process.cwd());
}

export const APP_ROOT = resolveAppRoot();
const configuredDbPath = process.env.SQLITE_DB_PATH?.trim();
export const dbPath = configuredDbPath
  ? path.resolve(APP_ROOT, configuredDbPath)
  : path.join(APP_ROOT, 'data', 'accounting.sqlite');
export const dbDir = path.dirname(dbPath);

let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;
let SQL: SqlJsStatic | null = null;
let inTransaction = false;

function reloadDbFromDiskAfterFailure(): void {
  if (!SQL || !fs.existsSync(dbPath)) return;
  try {
    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length > 0) {
      const restored = new SQL.Database(fileBuffer);
      restored.run('PRAGMA foreign_keys = ON;');
      db?.close();
      db = restored;
      console.error('[DB] Reloaded in-memory SQLite state from disk after persistence failure.');
    }
  } catch (reloadErr) {
    console.error('[DB] Failed to reload SQLite database from disk after write failure:', reloadErr);
  }
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    SQL = await initSqlJs({
      locateFile: (file) => path.join(APP_ROOT, 'node_modules/sql.js/dist', file),
    });

    const dbExisted = fs.existsSync(dbPath);
    if (dbExisted) {
      const stat = fs.statSync(dbPath);
      if (stat.size === 0) {
        throw new Error(
          `Existing SQLite database file at ${dbPath} is empty (0 bytes). Refusing to overwrite.`
        );
      }
      const fileBuffer = fs.readFileSync(dbPath);
      const loadedDb = new SQL.Database(fileBuffer);
      const integrityRes = loadedDb.exec('PRAGMA integrity_check;');
      const integrityVal = String(integrityRes[0]?.values[0]?.[0] || '');
      if (integrityVal.toLowerCase() !== 'ok') {
        loadedDb.close();
        throw new Error(
          `SQLite integrity check failed for ${dbPath}: ${integrityVal || 'unknown error'}`
        );
      }
      db = loadedDb;
    } else {
      db = new SQL.Database();
    }

    const didMutateOnStartup = initializeSchema(db, dbExisted);
    if (!dbExisted || didMutateOnStartup) {
      saveDb();
    }

    const projectCountRes = db.exec('SELECT COUNT(*) FROM projects');
    const projectCount = Number(projectCountRes[0]?.values[0]?.[0] || 0);
    console.log(
      `[DB] ${dbExisted ? 'Opened existing' : 'Created new'} SQLite database at ${dbPath} (projects=${projectCount}, mutatedOnStartup=${didMutateOnStartup})`
    );
    return db;
  })();

  try {
    return await dbInitPromise;
  } catch (err) {
    dbInitPromise = null;
    throw err;
  }
}

export function saveDb(): void {
  if (!db || inTransaction) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (buffer.length === 0) {
    throw new Error('Refusing to persist empty SQLite database buffer.');
  }
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const tmpPath = `${dbPath}.tmp.${process.pid}`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, dbPath);
  // sql.js db.export() can reset connection PRAGMA flags; keep foreign_keys enforced
  db.run('PRAGMA foreign_keys = ON;');
}

export function query<T = any>(sqlStr: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sqlStr);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function get<T = any>(sqlStr: string, params: any[] = []): T | undefined {
  const rows = query<T>(sqlStr, params);
  return rows[0];
}

export function run(
  sqlStr: string,
  params: any[] = []
): { lastInsertRowid: number; changes: number } {
  if (!db) throw new Error('Database not initialized');
  const executeMutation = () => {
    if (!db) throw new Error('Database not initialized');
    db.run(sqlStr, params);
    const idRes = db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = Number(idRes[0]?.values[0]?.[0] || 0);
    const changesRes = db.exec('SELECT changes() as ch');
    const changes = Number(changesRes[0]?.values[0]?.[0] || 0);
    return { lastInsertRowid, changes };
  };

  if (inTransaction) {
    return executeMutation();
  }

  return withTransaction(executeMutation);
}

export function withTransaction<T>(fn: () => T): T {
  if (!db) throw new Error('Database not initialized');
  if (inTransaction) {
    return fn();
  }
  db.run('BEGIN TRANSACTION');
  inTransaction = true;
  try {
    const result = fn();
    db.run('COMMIT');
    inTransaction = false;
    try {
      saveDb();
    } catch (persistErr) {
      reloadDbFromDiskAfterFailure();
      throw persistErr;
    }
    return result;
  } catch (err) {
    if (inTransaction) {
      inTransaction = false;
      try {
        db.run('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
    }
    throw err;
  }
}

export function logAuditEvent(params: {
  action: string;
  entityType: string;
  entityId?: number | null;
  actorId?: number | null;
  actorUsername?: string | null;
  details?: Record<string, any> | string | null;
}): void {
  if (!db) return;
  const serializedDetails =
    params.details === undefined || params.details === null
      ? null
      : typeof params.details === 'string'
      ? params.details
      : JSON.stringify(params.details);

  run(
    `INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_username, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.actorId ?? null,
      params.actorUsername ?? null,
      serializedDetails,
    ]
  );
}

export function getOrCreateAppSetting(key: string, generator: () => string): string {
  const existing = get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  if (existing?.value) {
    return existing.value;
  }
  const generated = generator();
  run(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO NOTHING`,
    [key, generated]
  );
  const stored = get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return stored?.value || generated;
}

export function verifyDbHealth(): {
  ok: boolean;
  dbPath: string;
  projectsCount: number;
} {
  if (!db) {
    return { ok: false, dbPath, projectsCount: 0 };
  }
  const res = db.exec('SELECT COUNT(*) FROM projects');
  const projectsCount = Number(res[0]?.values[0]?.[0] || 0);
  return { ok: true, dbPath, projectsCount };
}

function hasTable(database: Database, tableName: string): boolean {
  const res = database.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name) = LOWER(?)`,
    [tableName]
  );
  return Boolean(res[0]?.values?.length);
}

function hasColumn(database: Database, tableName: string, columnName: string): boolean {
  const res = database.exec(`PRAGMA table_info(${tableName})`);
  if (!res[0]?.values) return false;
  return res[0].values.some((row) => String(row[1]).toLowerCase() === columnName.toLowerCase());
}

function hasIndex(database: Database, indexName: string): boolean {
  const res = database.exec(
    `SELECT name FROM sqlite_master WHERE type='index' AND LOWER(name) = LOWER(?)`,
    [indexName]
  );
  return Boolean(res[0]?.values?.length);
}

function createPreMigrationBackupIfNeeded(): void {
  if (!fs.existsSync(dbPath)) return;
  const backupPath = `${dbPath}.pre-migration-${Date.now()}.bak`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[DB] Created pre-migration backup at ${backupPath}`);
}

function initializeSchema(database: Database, dbExisted: boolean): boolean {
  database.run('PRAGMA foreign_keys = ON;');

  const hadProjectsTable = hasTable(database, 'projects');
  const hadAuditTable = hasTable(database, 'audit_logs');
  const hadSettingsTable = hasTable(database, 'app_settings');

  const needsMigration =
    dbExisted &&
    hadProjectsTable &&
    (!hasColumn(database, 'incomes', 'plot_id') ||
      !hasColumn(database, 'contractor_types', 'is_active') ||
      !hasColumn(database, 'contracts', 'contract_type_id') ||
      !hasColumn(database, 'contracts', 'contract_type') ||
      !hasColumn(database, 'contracts', 'contract_date') ||
      !hasColumn(database, 'projects', 'request_id') ||
      !hasColumn(database, 'contract_payments', 'request_id') ||
      !hasIndex(database, 'idx_projects_request_id') ||
      !hasIndex(database, 'idx_contract_payments_request_id') ||
      !hadAuditTable ||
      !hadSettingsTable);

  if (needsMigration) {
    createPreMigrationBackupIfNeeded();
  }

  let didMutate = !dbExisted || !hadProjectsTable || needsMigration;

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS khatas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      plot_id INTEGER,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      default_unit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contractor_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      default_rate REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      type_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      contractor_id INTEGER NOT NULL,
      contract_type_id INTEGER,
      contract_type TEXT,
      work_title TEXT NOT NULL,
      contract_amount REAL NOT NULL,
      contract_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE RESTRICT,
      FOREIGN KEY (contract_type_id) REFERENCES contractor_types(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS contract_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT,
      notes TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      plot_id INTEGER,
      khata_id INTEGER,
      material_id INTEGER,
      material_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Material',
      amount REAL NOT NULL,
      quantity REAL,
      unit TEXT,
      rate REAL,
      expense_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
      FOREIGN KEY (khata_id) REFERENCES khatas(id) ON DELETE SET NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS material_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      plot_id INTEGER,
      material_id INTEGER,
      material_name TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      return_amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      returned_to TEXT NOT NULL CHECK(returned_to IN ('Client', 'Contractor', 'Other')),
      recipient_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      plot_id INTEGER,
      amount REAL NOT NULL,
      income_date TEXT NOT NULL,
      source_customer TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      actor_id INTEGER,
      actor_username TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe non-destructive migrations for existing SQLite databases
  if (!hasColumn(database, 'projects', 'request_id')) {
    database.run('ALTER TABLE projects ADD COLUMN request_id TEXT;');
    didMutate = true;
  }
  if (!hasColumn(database, 'incomes', 'plot_id')) {
    database.run('ALTER TABLE incomes ADD COLUMN plot_id INTEGER REFERENCES plots(id) ON DELETE SET NULL;');
    didMutate = true;
  }
  if (!hasColumn(database, 'contractor_types', 'is_active')) {
    database.run('ALTER TABLE contractor_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
    didMutate = true;
  }
  if (!hasColumn(database, 'contracts', 'contract_type_id')) {
    database.run('ALTER TABLE contracts ADD COLUMN contract_type_id INTEGER REFERENCES contractor_types(id) ON DELETE SET NULL;');
    didMutate = true;
  }
  if (!hasColumn(database, 'contracts', 'contract_type')) {
    database.run('ALTER TABLE contracts ADD COLUMN contract_type TEXT;');
    didMutate = true;
  }
  if (!hasColumn(database, 'contracts', 'contract_date')) {
    database.run('ALTER TABLE contracts ADD COLUMN contract_date TEXT;');
    didMutate = true;
  }

  if (!hasColumn(database, 'contract_payments', 'request_id')) {
    database.run('ALTER TABLE contract_payments ADD COLUMN request_id TEXT;');
    didMutate = true;
  }

  // Backfill contract_date only if any rows need it
  const missingContractDateCount =
    database.exec(`SELECT COUNT(*) FROM contracts WHERE contract_date IS NULL AND created_at IS NOT NULL`)[0]?.values[0]?.[0] || 0;
  if (Number(missingContractDateCount) > 0) {
    database.run(`UPDATE contracts SET contract_date = substr(created_at, 1, 10) WHERE contract_date IS NULL AND created_at IS NOT NULL;`);
    didMutate = true;
  }

  // Performance & integrity indexes
  database.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_request_id ON projects(request_id) WHERE request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_payments_request_id ON contract_payments(request_id) WHERE request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_incomes_project_plot ON incomes(project_id, plot_id);
    CREATE INDEX IF NOT EXISTS idx_incomes_project_date ON incomes(project_id, income_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_project_mat_date ON expenses(project_id, material_id, expense_date);
    CREATE INDEX IF NOT EXISTS idx_material_returns_proj_mat_date ON material_returns(project_id, material_id, return_date);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
  `);

  // Seed default materials ONLY if empty (never touches existing databases with materials)
  const matCount = database.exec('SELECT count(*) FROM materials')[0]?.values[0]?.[0] || 0;
  if (Number(matCount) === 0) {
    const materials = [
      { name: 'Cement', unit: 'Bori' },
      { name: 'Bajri', unit: 'Truck' },
      { name: 'Sand', unit: 'Truck' },
      { name: 'Bricks', unit: 'Pieces' },
      { name: 'Steel', unit: 'KG' },
      { name: 'Tiles', unit: 'Sq.Ft' },
      { name: 'Paint', unit: 'Gallon' },
      { name: 'Plumbing Material', unit: 'Items' },
      { name: 'Electrical Material', unit: 'Items' },
      { name: 'Wood', unit: 'Sq.Ft' },
      { name: 'Transport', unit: 'Trip' },
      { name: 'Labor', unit: 'Days' },
      { name: 'Other', unit: 'Items' },
    ];
    for (const m of materials) {
      database.run('INSERT INTO materials (name, default_unit) VALUES (?, ?)', [m.name, m.unit]);
    }
    didMutate = true;
  }

  // Ensure the 10 required initial contract types exist idempotently (no hardcoded default rates)
  const requiredContractTypes = [
    'SBCA',
    'Plinth',
    'Plumber',
    'Electrician',
    'Karandi Work',
    'Shattering',
    'Steel Labour',
    'Forcelling',
    'Color Labour',
    'Carpenter',
  ];
  for (const typeName of requiredContractTypes) {
    const existingType = database.exec(
      `SELECT id FROM contractor_types WHERE LOWER(name) = LOWER(?)`,
      [typeName]
    );
    if (!existingType[0]?.values?.length) {
      database.run('INSERT INTO contractor_types (name, default_rate, is_active) VALUES (?, NULL, 1)', [typeName]);
      didMutate = true;
    }
  }
  const nonNullDefaultRateCount =
    database.exec('SELECT COUNT(*) FROM contractor_types WHERE default_rate IS NOT NULL')[0]?.values[0]?.[0] || 0;
  if (Number(nonNullDefaultRateCount) > 0) {
    database.run('UPDATE contractor_types SET default_rate = NULL WHERE default_rate IS NOT NULL;');
    didMutate = true;
  }

  // Seed default users ONLY if users table is completely empty
  const userCount = database.exec('SELECT count(*) FROM users')[0]?.values[0]?.[0] || 0;
  if (Number(userCount) === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('builder123', 10);
    database.run('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)', [
      'admin',
      adminHash,
      'admin',
      'Site Administrator',
    ]);
    database.run('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)', [
      'builder',
      userHash,
      'user',
      'Construction Supervisor',
    ]);
    didMutate = true;
  }

  // Ensure persistent JWT signing key exists in app_settings if env var is unset
  if (!process.env.JWT_SECRET?.trim()) {
    const existingSecret = database.exec(`SELECT value FROM app_settings WHERE key = 'jwt_secret'`);
    if (!existingSecret[0]?.values?.length) {
      const secret = crypto.randomBytes(32).toString('hex');
      database.run(`INSERT INTO app_settings (key, value) VALUES ('jwt_secret', ?)`, [secret]);
      didMutate = true;
    }
  }

  // Demo project/transaction seeding is strictly prohibited on startup so existing or empty client databases are never altered.
  return didMutate;
}

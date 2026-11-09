/**
 * database.js — طبقة SQLite المحلية لبرنامج الجمال (Electron main process)
 * =====================================================================
 * - ملف قاعدة البيانات: algamal.db داخل مجلد userData (AppData\Roaming على ويندوز)
 *   => يظهر تلقائياً مع التثبيت، ويستمر بين عمليات التشغيل وبعد تحديث النسخة.
 * - better-sqlite3: API متزامن وسريع، ولا يحتاج أي برنامج قاعدة بيانات خارجي.
 * - كل العمليات تُرجع { ok, data } أو { ok:false, error } حتى لا ينهار التطبيق.
 *
 * ملاحظة مهمة: عند تشغيل خادم Next.js كعملية Electron/Node فرعية (ELECTRON_RUN_AS_NODE=1)
 * فإن require('electron') يُعيد مسار الملف التنفيذي وليس كائن app، لذلك نستخدم
 * المتغير ALGAMAL_USER_DATA الذي يضبطه main.cjs ليشير كلاهما لنفس الملف.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");
const schema = require("./src/db/schema-sql.json");

let connection = null;
let dbFilePath = null;

/** يحدد مسار قاعدة البيانات بترتيب آمن (Electron ← متغير بيئة ← مسار افتراضي) */
function resolveDatabasePath() {
  if (process.env.ALGAMAL_SQLITE_PATH) return process.env.ALGAMAL_SQLITE_PATH;

  // داخل العملية الرئيسية لـ Electron فقط
  try {
    // استخدام require غير ثابت حتى لا يحاول مجمّع الويب حل حزمة electron وقت البناء.
    const runtimeRequire = eval("require");
    const electron = runtimeRequire("electron");
    if (electron && electron.app && typeof electron.app.getPath === "function") {
      return path.join(electron.app.getPath("userData"), "algamal.db");
    }
  } catch {
    /* غير متاح — نكمل بالبديل */
  }

  // يضبطه main.cjs لخادم Next.js الفرعي
  if (process.env.ALGAMAL_USER_DATA) {
    return path.join(process.env.ALGAMAL_USER_DATA, "algamal.db");
  }

  // بديل آمن للتطوير/المعاينة خارج Electron
  const fallback =
    process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Roaming", "algamal-desktop")
      : path.join(os.homedir(), ".local", "share", "algamal-desktop");
  return path.join(fallback, "algamal.db");
}

function getDbPath() {
  if (!dbFilePath) dbFilePath = resolveDatabasePath();
  return dbFilePath;
}

/** يفتح الاتصال وينشئ الجداول الافتراضية عند أول تشغيل */
function initDatabase() {
  if (connection) return { ok: true, data: { path: getDbPath(), created: false } };
  try {
    const file = getDbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const created = !fs.existsSync(file);
    connection = new Database(file);
    // الأداء والتزامن بين العملية الرئيسية وخادم Next.js
    connection.pragma("journal_mode = WAL");
    connection.pragma("synchronous = NORMAL");
    connection.pragma("foreign_keys = ON");
    connection.pragma("busy_timeout = 5000");
    for (const statement of schema.statements) connection.exec(statement);
    return { ok: true, data: { path: file, created } };
  } catch (error) {
    connection = null;
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getDb() {
  if (!connection) {
    const result = initDatabase();
    if (!result.ok) throw new Error(result.error);
  }
  return connection;
}

/** إغلاق آمن — يُستدعى من حدث before-quit */
function closeDatabase() {
  try {
    if (connection) {
      connection.pragma("wal_checkpoint(TRUNCATE)");
      connection.close();
      connection = null;
      return { ok: true, data: true };
    }
    return { ok: true, data: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* ===================== أدوات CRUD عامة ===================== */

// الأعمدة المسموح بها تمنع حقن SQL عبر مفاتيح غير متوقعة من الرندرر.
const TABLES = {
  users: ["name", "username", "password", "role", "phone", "active"],
  products: ["code", "barcode", "name", "category", "unit", "purchasePrice", "salePrice", "quantity", "minQuantity", "taxRate", "active"],
  invoices: ["invoiceNo", "type", "customerId", "customerName", "paymentType", "subtotal", "discount", "tax", "total", "paid", "remaining", "notes", "status", "invoiceDate"],
};

function normalizeValue(value) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

function add(table, payload = {}) {
  try {
    const columns = TABLES[table];
    if (!columns) throw new Error(`جدول غير مدعوم: ${table}`);
    const keys = columns.filter((col) => payload[col] !== undefined);
    if (keys.length === 0) throw new Error("لا توجد بيانات صالحة للإضافة");
    const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
    const info = getDb().prepare(sql).run(...keys.map((key) => normalizeValue(payload[key])));
    return { ok: true, data: getById(table, info.lastInsertRowid).data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getAll(table, options = {}) {
  try {
    if (!TABLES[table]) throw new Error(`جدول غير مدعوم: ${table}`);
    const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 5000);
    const rows = getDb().prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT ?`).all(limit);
    return { ok: true, data: rows.map((row) => ({ ...row, active: row.active === undefined ? undefined : Boolean(row.active) })) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getById(table, id) {
  try {
    if (!TABLES[table]) throw new Error(`جدول غير مدعوم: ${table}`);
    const row = getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
    if (!row) return { ok: false, error: "السجل غير موجود" };
    return { ok: true, data: { ...row, active: row.active === undefined ? undefined : Boolean(row.active) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function update(table, id, payload = {}) {
  try {
    const columns = TABLES[table];
    if (!columns) throw new Error(`جدول غير مدعوم: ${table}`);
    const keys = columns.filter((col) => payload[col] !== undefined);
    if (keys.length === 0) throw new Error("لا توجد بيانات للتعديل");
    const sql = `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`;
    const info = getDb().prepare(sql).run(...keys.map((key) => normalizeValue(payload[key])), Number(id));
    if (info.changes === 0) return { ok: false, error: "السجل غير موجود" };
    return { ok: true, data: getById(table, id).data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function remove(table, id) {
  try {
    if (!TABLES[table]) throw new Error(`جدول غير مدعوم: ${table}`);
    const info = getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(id));
    return { ok: true, data: { deleted: info.changes } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* ============ واجهات CRUD لكل جدول (للاستخدام المباشر ولـ IPC) ============ */
const addUser = (data) => add("users", data);
const getAllUsers = (options) => getAll("users", options);
const getUserById = (id) => getById("users", id);
const updateUser = (id, data) => update("users", id, data);
const deleteUser = (id) => remove("users", id);

const addProduct = (data) => add("products", data);
const getAllProducts = (options) => getAll("products", options);
const getProductById = (id) => getById("products", id);
const updateProduct = (id, data) => update("products", id, data);
const deleteProduct = (id) => remove("products", id);

const addInvoice = (data) => add("invoices", data);
const getAllInvoices = (options) => getAll("invoices", options);
const getInvoiceById = (id) => getById("invoices", id);
const updateInvoice = (id, data) => update("invoices", id, data);
const deleteInvoice = (id) => remove("invoices", id);

/** معلومات تشخيصية للرندرر */
function getInfo() {
  try {
    const db = getDb();
    const counts = {};
    for (const table of Object.keys(TABLES)) {
      counts[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    }
    return { ok: true, data: { path: getDbPath(), engine: "better-sqlite3", counts } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** تسجيل كل معالجات IPC دفعة واحدة من main.cjs */
function registerIpcHandlers(ipcMain) {
  const handlers = {
    "db:getInfo": () => getInfo(),
    "db:addUser": (_e, data) => addUser(data),
    "db:getAllUsers": (_e, options) => getAllUsers(options),
    "db:getUserById": (_e, id) => getUserById(id),
    "db:updateUser": (_e, id, data) => updateUser(id, data),
    "db:deleteUser": (_e, id) => deleteUser(id),
    "db:addProduct": (_e, data) => addProduct(data),
    "db:getAllProducts": (_e, options) => getAllProducts(options),
    "db:getProductById": (_e, id) => getProductById(id),
    "db:updateProduct": (_e, id, data) => updateProduct(id, data),
    "db:deleteProduct": (_e, id) => deleteProduct(id),
    "db:addInvoice": (_e, data) => addInvoice(data),
    "db:getAllInvoices": (_e, options) => getAllInvoices(options),
    "db:getInvoiceById": (_e, id) => getInvoiceById(id),
    "db:updateInvoice": (_e, id, data) => updateInvoice(id, data),
    "db:deleteInvoice": (_e, id) => deleteInvoice(id),
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  }
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  closeDatabase,
  getInfo,
  registerIpcHandlers,
  addUser, getAllUsers, getUserById, updateUser, deleteUser,
  addProduct, getAllProducts, getProductById, updateProduct, deleteProduct,
  addInvoice, getAllInvoices, getInvoiceById, updateInvoice, deleteInvoice,
};

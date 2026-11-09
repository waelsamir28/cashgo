/**
 * طبقة البيانات المحلية (SQLite) — تُستخدم بواسطة كل مسارات /api داخل Next.js.
 * نفس ملف algamal.db الذي تستخدمه العملية الرئيسية في Electron (عبر database.js).
 * لا يحتاج المستخدم لأي برنامج قاعدة بيانات خارجي: better-sqlite3 مضمّن داخل الحزمة.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import schema from "./schema-sql.json";
import { LICENSE_CONFIG } from "@/lib/license-config";

// تحميل الوحدة الأصلية في وقت التشغيل من مجلد التطبيق نفسه (يعمل داخل EXE وفي التطوير).
// نستخدم اسماً غير حرفي حتى لا يولّد المجمّع alias خارجياً يعتمد على مسار البناء.
type SqliteDatabase = import("better-sqlite3").Database;
type SqliteCtor = typeof import("better-sqlite3");
function loadSqlite(): SqliteCtor {
  const runtimeRequire = createRequire(path.join(process.cwd(), "algamal-runtime.cjs"));
  const moduleName = ["better", "sqlite3"].join("-");
  return runtimeRequire(moduleName) as SqliteCtor;
}
import { productSeed, customerSeed, categorySeed } from "./seed-data";
import { round } from "@/lib/format";
import {
  DEFAULT_SETTINGS,
  type InstallmentsData,
  type ReportsData,
  type StatementData,
  type StoreSettings,
} from "@/lib/types";

type Row = Record<string, unknown>;
type IncomingItem = {
  productId?: number | null;
  productCode?: string;
  productName?: string;
  barcode?: string;
  unit?: string;
  quantity?: number;
  price?: number;
  discount?: number;
};
export type InvoiceInput = {
  invoiceNo?: string;
  type?: string;
  customerId?: number | null;
  customerName?: string;
  paymentType?: string;
  discount?: number;
  tax?: number;
  paid?: number;
  notes?: string;
  items?: IncomingItem[];
  createdAt?: string;
};

let instance: SqliteDatabase | null = null;

export function localDbPath(): string {
  if (process.env.ALGAMAL_SQLITE_PATH) return process.env.ALGAMAL_SQLITE_PATH;
  if (process.env.ALGAMAL_USER_DATA) return path.join(process.env.ALGAMAL_USER_DATA, "algamal.db");
  const dir = process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Roaming", "algamal-desktop")
    : path.join(os.homedir(), ".local", "share", "algamal-desktop");
  return path.join(dir, "algamal.db");
}

const str = (value: unknown, fallback = "") => (value === undefined || value === null ? fallback : String(value).trim());
const num = (value: unknown) => { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; };
const nowIso = () => new Date().toISOString();

function seedIfEmpty(db: SqliteDatabase) {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

  for (const name of categorySeed) {
    db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(name);
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  if (count("products") === 0) {
    const insert = db.prepare(`INSERT INTO products
      (code, barcode, name, category, unit, purchasePrice, salePrice, quantity, minQuantity, taxRate, active, createdAt)
      VALUES (@code, @barcode, @name, @category, @unit, @purchasePrice, @salePrice, @quantity, @minQuantity, 0, 1, @createdAt)`);
    db.transaction(() => {
      for (const product of productSeed) insert.run({ ...product, createdAt: nowIso() });
    })();
  }

  if (count("customers") === 0) {
    const insert = db.prepare(`INSERT INTO customers (code, name, phone, address, customerType, balance, createdAt) VALUES (?,?,?,?,?,0,?)`);
    db.transaction(() => {
      for (const customer of customerSeed) insert.run(customer.code, customer.name, customer.phone, customer.address, customer.customerType, nowIso());
    })();
  }

  // بيانات تجريبية خفيفة لإظهار التقارير والفواتير من أول تشغيل
  if (count("invoices") === 0) {
    const getProduct = (code: string) => db.prepare("SELECT * FROM products WHERE code = ?").get(code) as Row | undefined;
    const getCustomer = (code: string) => db.prepare("SELECT * FROM customers WHERE code = ?").get(code) as Row | undefined;
    const library = getCustomer("C10002");
    const school = getCustomer("C10003");
    const samples = [
      { no: "1001", customer: library, paymentType: "نقدي", days: 0, codes: [["1001", 4], ["1006", 2], ["1016", 1]] as [string, number][] },
      { no: "1002", customer: school, paymentType: "قسط", days: 75, codes: [["1029", 2], ["1032", 1]] as [string, number][] },
    ];
    db.transaction(() => {
      for (const sample of samples) {
        if (!sample.customer) continue;
        const createdAt = new Date(Date.now() - sample.days * 86400000).toISOString();
        const lines = sample.codes.map(([code, qty]) => ({ product: getProduct(code), qty })).filter((line) => line.product);
        let subtotal = 0;
        for (const line of lines) subtotal += line.qty * num(line.product!.salePrice);
        subtotal = round(subtotal);
        const paid = sample.paymentType === "نقدي" ? subtotal : 0;
        const info = db.prepare(`INSERT INTO invoices
          (invoiceNo, type, customerId, customerName, paymentType, subtotal, discount, tax, total, paid, remaining, notes, status, invoiceDate, createdAt)
          VALUES (?, 'sale', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sample.no, sample.customer.id, sample.customer.name, sample.paymentType, subtotal, subtotal, paid, round(subtotal - paid), "بيانات تجريبية", paid < subtotal ? "آجل" : "محفوظة", createdAt, createdAt);
        const invoiceId = Number(info.lastInsertRowid);
        const insertItem = db.prepare(`INSERT INTO invoiceItems (invoiceId, productId, productCode, productName, barcode, unit, quantity, price, discount, total) VALUES (?,?,?,?,?,?,?,?,0,?)`);
        for (const line of lines) {
          const product = line.product!;
          insertItem.run(invoiceId, product.id, product.code, product.name, product.barcode, product.unit, line.qty, product.salePrice, round(line.qty * num(product.salePrice)));
          db.prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?").run(line.qty, product.id);
        }
        if (subtotal - paid > 0) {
          db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(round(subtotal - paid), sample.customer.id);
        }
      }
    })();
  }
}

export function getLocalDb(): SqliteDatabase {
  if (instance) return instance;
  const file = localDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const SqliteCtor = loadSqlite();
  const db = new SqliteCtor(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  for (const statement of schema.statements) db.exec(statement);
  seedIfEmpty(db);
  instance = db;
  return db;
}

export function healthCheck(): boolean {
  getLocalDb().prepare("SELECT 1 AS ok").get();
  return true;
}

const mapProduct = (row: Row): Row => ({ ...row, active: Boolean(row.active) });
const mapRows = (rows: Row[]) => rows.map(mapProduct);

/* ========================= الترخيص / الفترة التجريبية ========================= */
export type LicenseState = {
  installId: string;
  installedAt: string;
  activated: boolean;
  activatedAt: string | null;
  trialDays: number;
  trialProductLimit: number;
  daysUsed: number;
  daysLeft: number;
  expired: boolean;
  limited: boolean;
  productCount: number;
  totalProducts: number;
};

export function getLicense(): LicenseState {
  const db = getLocalDb();
  let row = db.prepare("SELECT * FROM license WHERE id = 1").get() as Row | undefined;
  if (!row) {
    db.prepare("INSERT INTO license (id, installId, installedAt, trialDays, trialProductLimit) VALUES (1, ?, ?, ?, ?)")
      .run(randomUUID(), nowIso(), LICENSE_CONFIG.trialDays, LICENSE_CONFIG.trialProductLimit);
    row = db.prepare("SELECT * FROM license WHERE id = 1").get() as Row;
  }
  const installed = new Date(String(row.installedAt)).getTime();
  const daysUsed = Math.max(0, Math.floor((Date.now() - installed) / 86400000));
  const trialDays = Number(row.trialDays) || LICENSE_CONFIG.trialDays;
  const trialProductLimit = Number(row.trialProductLimit) || LICENSE_CONFIG.trialProductLimit;
  const activated = Boolean(row.activated);
  const totalProducts = (db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number }).n;
  return {
    installId: String(row.installId),
    installedAt: String(row.installedAt),
    activated,
    activatedAt: row.activatedAt ? String(row.activatedAt) : null,
    trialDays,
    trialProductLimit,
    daysUsed,
    daysLeft: Math.max(0, trialDays - daysUsed),
    expired: !activated && daysUsed >= trialDays,
    limited: !activated,
    productCount: totalProducts,
    totalProducts,
  };
}

export function activateLicense(): LicenseState {
  const db = getLocalDb();
  getLicense(); // يضمن وجود السجل
  db.prepare("UPDATE license SET activated = 1, activatedAt = ? WHERE id = 1").run(nowIso());
  return getLicense();
}

/** يُستخدم فقط من واجهة البرنامج للتحكم في مدة/حدود النسخة (بصلاحية المطور) */
export function setTrialPolicy(days: number, productLimit: number): LicenseState {
  const db = getLocalDb();
  getLicense();
  db.prepare("UPDATE license SET trialDays = ?, trialProductLimit = ? WHERE id = 1")
    .run(Math.max(1, Math.round(days)), Math.max(1, Math.round(productLimit)));
  return getLicense();
}

/* ========================= products ========================= */
export function listProducts() {
  const db = getLocalDb();
  const license = getLicense();
  // في النسخة التجريبية نعرض عدداً محدداً من الأصناف فقط (عيّنة ثابتة).
  const rows = license.activated
    ? db.prepare("SELECT * FROM products ORDER BY id DESC").all()
    : db.prepare("SELECT * FROM (SELECT * FROM products ORDER BY id ASC LIMIT ?) ORDER BY id DESC").all(license.trialProductLimit);
  return mapRows(rows as Row[]);
}

export function insertProduct(body: Row) {
  const db = getLocalDb();
  const license = getLicense();
  if (license.limited && license.totalProducts >= license.trialProductLimit) {
    throw new Error(`النسخة التجريبية تسمح بـ ${license.trialProductLimit} صنفاً فقط — فعّل البرنامج لإضافة أصناف غير محدودة`);
  }
  const code = str(body.code) || `P${Date.now().toString().slice(-7)}`;
  const info = db.prepare(`INSERT INTO products
    (code, barcode, name, category, unit, purchasePrice, salePrice, quantity, minQuantity, taxRate, active, createdAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    code, str(body.barcode), str(body.name), str(body.category, "عام") || "عام", str(body.unit, "قطعة") || "قطعة",
    num(body.purchasePrice), num(body.salePrice), num(body.quantity), num(body.minQuantity), num(body.taxRate),
    body.active === false ? 0 : 1, nowIso(),
  );
  return mapProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid) as Row);
}

export function updateProduct(body: Row) {
  const db = getLocalDb();
  const id = Number(body.id);
  const info = db.prepare(`UPDATE products SET code=?, barcode=?, name=?, category=?, unit=?, purchasePrice=?, salePrice=?, quantity=?, minQuantity=?, taxRate=?, active=? WHERE id=?`).run(
    str(body.code) || `P${Date.now().toString().slice(-7)}`, str(body.barcode), str(body.name),
    str(body.category, "عام") || "عام", str(body.unit, "قطعة") || "قطعة",
    num(body.purchasePrice), num(body.salePrice), num(body.quantity), num(body.minQuantity), num(body.taxRate),
    body.active === false ? 0 : 1, id,
  );
  if (info.changes === 0) throw new Error("الصنف غير موجود");
  return mapProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Row);
}

export function deleteProduct(id: number) {
  getLocalDb().prepare("DELETE FROM products WHERE id = ?").run(id);
}

/* ========================= customers ========================= */
export function listCustomers() {
  return getLocalDb().prepare("SELECT * FROM customers ORDER BY id DESC").all() as Row[];
}

export function insertCustomer(body: Row) {
  const db = getLocalDb();
  const info = db.prepare(`INSERT INTO customers (code, name, phone, address, customerType, balance, createdAt) VALUES (?,?,?,?,?,?,?)`).run(
    `C${Date.now().toString().slice(-8)}`, str(body.name), str(body.phone), str(body.address),
    str(body.customerType, "عادي") || "عادي", num(body.balance), nowIso(),
  );
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid) as Row;
}

/* ========================= categories ========================= */
export function listCategories() {
  const db = getLocalDb();
  const aggregated = db.prepare(`SELECT category AS name, COUNT(*) AS count, COALESCE(SUM(quantity * purchasePrice), 0) AS stockValue FROM products GROUP BY category`).all() as Row[];
  const map = new Map<string, Row>();
  for (const row of aggregated) map.set(String(row.name), { name: row.name, count: row.count, stockValue: round(num(row.stockValue)) });
  for (const row of db.prepare("SELECT name FROM categories").all() as Row[]) {
    if (!map.has(String(row.name))) map.set(String(row.name), { name: row.name, count: 0, stockValue: 0 });
  }
  return Array.from(map.values()).sort((a, b) => num(b.count) - num(a.count) || String(a.name).localeCompare(String(b.name), "ar"));
}

export function insertCategory(name: string) {
  getLocalDb().prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(name);
  return listCategories();
}

export function renameCategory(name: string, newName: string) {
  const db = getLocalDb();
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(newName);
    db.prepare("UPDATE OR IGNORE categories SET name = ? WHERE name = ?").run(newName, name);
    db.prepare("DELETE FROM categories WHERE name = ?").run(name);
    db.prepare("UPDATE products SET category = ? WHERE category = ?").run(newName, name);
  })();
  return listCategories();
}

export function deleteCategory(name: string, moveTo: string) {
  const db = getLocalDb();
  const row = db.prepare("SELECT COUNT(*) AS n FROM products WHERE category = ?").get(name) as { n: number };
  if (row.n > 0 && !moveTo) throw new Error(`المجموعة «${name}» تحتوي ${row.n} صنف — اختر نقلهم لمجموعة أخرى أولاً`);
  db.transaction(() => {
    if (row.n > 0) db.prepare("UPDATE products SET category = ? WHERE category = ?").run(moveTo || "عام", name);
    db.prepare("DELETE FROM categories WHERE name = ?").run(name);
  })();
  return listCategories();
}

/* ========================= invoices ========================= */
export function nextInvoiceNo(): string {
  const row = getLocalDb().prepare("SELECT COALESCE(MAX(id), 0) AS n FROM invoices").get() as { n: number };
  return String(1000 + num(row.n) + 1);
}

export function listInvoices(type?: string) {
  const db = getLocalDb();
  return (type
    ? db.prepare("SELECT * FROM invoices WHERE type = ? ORDER BY id DESC LIMIT 100").all(type)
    : db.prepare("SELECT * FROM invoices ORDER BY id DESC LIMIT 100").all()) as Row[];
}

export function getInvoice(id: number) {
  const db = getLocalDb();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as Row | undefined;
  if (!invoice) throw new Error("الفاتورة غير موجودة");
  return { ...invoice, items: db.prepare("SELECT * FROM invoiceItems WHERE invoiceId = ? ORDER BY id").all(id) as Row[] };
}

export function createInvoice(body: InvoiceInput) {
  const db = getLocalDb();
  const type = body.type === "purchase" ? "purchase" : "sale";
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .filter((item) => str(item.productName) && num(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId ? Number(item.productId) : null,
      productCode: str(item.productCode), productName: str(item.productName), barcode: str(item.barcode),
      unit: str(item.unit, "قطعة") || "قطعة", quantity: round(num(item.quantity)),
      price: round(num(item.price)), discount: round(num(item.discount)),
    }));
  if (items.length === 0) throw new Error("لا يمكن حفظ فاتورة بدون أصناف");

  return db.transaction(() => {
    if (type === "sale") {
      for (const item of items) {
        if (!item.productId) continue;
        const product = db.prepare("SELECT name, quantity FROM products WHERE id = ?").get(item.productId) as Row | undefined;
        if (product && num(product.quantity) < item.quantity) {
          throw new Error(`الكمية غير متوفرة للمخزون: ${product.name} (المتوفر ${product.quantity})`);
        }
      }
    }

    let invoiceNo = str(body.invoiceNo);
    if (invoiceNo && db.prepare("SELECT id FROM invoices WHERE invoiceNo = ?").get(invoiceNo)) invoiceNo = "";
    if (!invoiceNo) invoiceNo = nextInvoiceNo();

    const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
    const discount = round(num(body.discount));
    const tax = round(num(body.tax));
    const total = round(subtotal - discount + tax);
    const paid = round(body.paid === undefined ? total : num(body.paid));
    const remaining = round(Math.max(0, total - paid));
    const createdAt = body.createdAt || nowIso();

    const info = db.prepare(`INSERT INTO invoices
      (invoiceNo, type, customerId, customerName, paymentType, subtotal, discount, tax, total, paid, remaining, notes, status, invoiceDate, createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      invoiceNo, type, body.customerId ? Number(body.customerId) : null,
      str(body.customerName, "عميل نقدي") || "عميل نقدي", str(body.paymentType, "نقدي") || "نقدي",
      subtotal, discount, tax, total, paid, remaining, str(body.notes), remaining > 0 ? "آجل" : "محفوظة", createdAt, createdAt,
    );
    const invoiceId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(`INSERT INTO invoiceItems
      (invoiceId, productId, productCode, productName, barcode, unit, quantity, price, discount, total) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const item of items) {
      insertItem.run(invoiceId, item.productId, item.productCode, item.productName, item.barcode, item.unit,
        item.quantity, item.price, item.discount, round(item.quantity * item.price - item.discount));
      if (item.productId) {
        const delta = type === "sale" ? -item.quantity : item.quantity;
        db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(delta, item.productId);
      }
    }
    if (type === "sale" && remaining > 0 && body.customerId) {
      db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(remaining, Number(body.customerId));
    }
    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId) as Row;
  })();
}

export function deleteInvoice(id: number) {
  const db = getLocalDb();
  db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as Row | undefined;
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    const items = db.prepare("SELECT * FROM invoiceItems WHERE invoiceId = ?").all(id) as Row[];
    for (const item of items) {
      if (!item.productId) continue;
      const delta = invoice.type === "sale" ? num(item.quantity) : -num(item.quantity);
      db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(delta, item.productId);
    }
    if (invoice.type === "sale" && invoice.customerId && num(invoice.remaining) > 0) {
      db.prepare("UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?").run(num(invoice.remaining), invoice.customerId);
    }
    db.prepare("DELETE FROM invoiceItems WHERE invoiceId = ?").run(id);
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
  })();
}

/* ========================= payments ========================= */
export function listPayments(customerId?: number) {
  const db = getLocalDb();
  return (customerId
    ? db.prepare("SELECT * FROM payments WHERE customerId = ? ORDER BY paymentDate DESC LIMIT 200").all(customerId)
    : db.prepare("SELECT * FROM payments ORDER BY paymentDate DESC LIMIT 200").all()) as Row[];
}

export function insertPayment(body: Row) {
  const db = getLocalDb();
  const customerId = Number(body.customerId);
  const amount = num(body.amount);
  if (!customerId || amount <= 0) throw new Error("اختر العميل وأدخل مبلغاً صحيحاً أكبر من صفر");
  const parsed = body.paymentDate ? new Date(String(body.paymentDate)) : new Date();
  const paymentDate = Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
  return db.transaction(() => {
    const info = db.prepare("INSERT INTO payments (customerId, amount, method, note, paymentDate, createdAt) VALUES (?,?,?,?,?,?)")
      .run(customerId, amount, str(body.method, "نقدي") || "نقدي", str(body.note), paymentDate, nowIso());
    db.prepare("UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?").run(amount, customerId);
    return db.prepare("SELECT * FROM payments WHERE id = ?").get(info.lastInsertRowid) as Row;
  })();
}

export function deletePayment(id: number) {
  const db = getLocalDb();
  db.transaction(() => {
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as Row | undefined;
    if (!payment) throw new Error("الدفعة غير موجودة");
    db.prepare("DELETE FROM payments WHERE id = ?").run(id);
    db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(num(payment.amount), payment.customerId);
  })();
}

/* ========================= statement & installments ========================= */
type Entry = { id: string; date: Date; kind: "invoice" | "payment"; description: string; reference: string; debit: number; credit: number; net: number };

export function getStatement(customerId: number, fromText = "", toText = ""): StatementData {
  const db = getLocalDb();
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId) as Row | undefined;
  if (!customer) throw new Error("العميل غير موجود");
  const from = fromText ? new Date(`${fromText}T00:00:00`) : null;
  const to = toText ? new Date(`${toText}T23:59:59.999`) : null;
  const validFrom = from && !Number.isNaN(from.getTime()) ? from : null;
  const validTo = to && !Number.isNaN(to.getTime()) ? to : null;

  const entries: Entry[] = [];
  for (const invoice of db.prepare("SELECT * FROM invoices WHERE customerId = ? AND type = 'sale'").all(customerId) as Row[]) {
    entries.push({
      id: `invoice-${invoice.id}`, date: new Date(String(invoice.createdAt)), kind: "invoice",
      description: `فاتورة مبيعات - ${invoice.paymentType}`, reference: String(invoice.invoiceNo),
      debit: num(invoice.total), credit: num(invoice.paid), net: num(invoice.total) - num(invoice.paid),
    });
  }
  for (const payment of db.prepare("SELECT * FROM payments WHERE customerId = ?").all(customerId) as Row[]) {
    entries.push({
      id: `payment-${payment.id}`, date: new Date(String(payment.paymentDate)), kind: "payment",
      description: `دفعة ${payment.method}${payment.note ? ` - ${payment.note}` : ""}`, reference: `PAY-${payment.id}`,
      debit: 0, credit: num(payment.amount), net: -num(payment.amount),
    });
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  const opening = round(entries.filter((e) => validFrom && e.date < validFrom).reduce((sum, e) => sum + e.net, 0));
  const inRange = entries.filter((e) => (!validFrom || e.date >= validFrom) && (!validTo || e.date <= validTo));
  let running = opening;
  let debitTotal = 0;
  let creditTotal = 0;
  const transactions = inRange.map((entry) => {
    running = round(running + entry.net);
    debitTotal += entry.debit; creditTotal += entry.credit;
    return {
      id: entry.id, date: entry.date.toISOString(), kind: entry.kind, description: entry.description,
      reference: entry.reference, debit: round(entry.debit), credit: round(entry.credit), balance: running,
    };
  });
  return { customer: customer as unknown as StatementData["customer"], opening, debitTotal: round(debitTotal), creditTotal: round(creditTotal), closing: round(running), transactions };
}

export function getInstallments(): InstallmentsData {
  const db = getLocalDb();
  const invoices = db.prepare("SELECT * FROM invoices WHERE type = 'sale' AND paymentType = 'قسط'").all() as Row[];
  if (invoices.length === 0) return { plans: [], overdue: [] };
  const customerIds = Array.from(new Set(invoices.map((invoice) => Number(invoice.customerId)).filter(Boolean)));
  const lastPayments = new Map<number, { amount: number; date: Date }>();
  for (const payment of db.prepare("SELECT * FROM payments").all() as Row[]) {
    const id = Number(payment.customerId);
    if (!customerIds.includes(id)) continue;
    const date = new Date(String(payment.paymentDate));
    const current = lastPayments.get(id);
    if (!current || date.getTime() > current.date.getTime()) lastPayments.set(id, { amount: num(payment.amount), date });
  }
  const now = Date.now();
  const plans = customerIds.map((id) => {
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Row | undefined;
    const rows = invoices.filter((invoice) => Number(invoice.customerId) === id);
    const totalPlan = round(rows.reduce((sum, invoice) => sum + num(invoice.total), 0));
    const debt = round(rows.reduce((sum, invoice) => sum + Math.max(0, num(invoice.total) - num(invoice.paid)), 0));
    const last = lastPayments.get(id);
    const reference = last ? last.date : rows.map((invoice) => new Date(String(invoice.createdAt))).sort((a, b) => a.getTime() - b.getTime())[0] ?? new Date();
    const daysSincePayment = Math.max(0, Math.floor((now - reference.getTime()) / 86400000));
    return {
      customerId: id, customerName: String(customer?.name ?? "غير معروف"), phone: String(customer?.phone ?? ""),
      customerType: String(customer?.customerType ?? ""), totalPlan, debt, invoiceCount: rows.length,
      lastPaymentAmount: last ? round(last.amount) : null, lastPaymentDate: last ? last.date.toISOString() : null,
      referenceDate: reference.toISOString(), daysSincePayment, overdue: debt > 0 && daysSincePayment >= 60,
    };
  }).filter((plan) => plan.debt > 0.001).sort((a, b) => b.daysSincePayment - a.daysSincePayment);
  return { plans, overdue: plans.filter((plan) => plan.overdue) };
}

/* ========================= reports ========================= */
export function getReports(): ReportsData {
  const db = getLocalDb();
  const invoices = db.prepare("SELECT * FROM invoices ORDER BY id DESC LIMIT 500").all() as Row[];
  const items = db.prepare("SELECT * FROM invoiceItems").all() as Row[];
  // نحترم حد الأصناف في النسخة التجريبية حتى تتطابق التقارير مع ما يراه المستخدم.
  const products = listProducts() as Row[];
  const customersCount = (db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number }).n;
  const saleInvoices = invoices.filter((invoice) => invoice.type === "sale");
  const purchaseInvoices = invoices.filter((invoice) => invoice.type === "purchase");
  const salesTotal = round(saleInvoices.reduce((sum, invoice) => sum + num(invoice.total), 0));
  const purchasesTotal = round(purchaseInvoices.reduce((sum, invoice) => sum + num(invoice.total), 0));
  const saleIds = new Set(saleInvoices.map((invoice) => Number(invoice.id)));
  const costByProduct = new Map(products.map((product) => [Number(product.id), num(product.purchasePrice)]));
  const cost = items.filter((item) => saleIds.has(Number(item.invoiceId))).reduce((sum, item) => sum + num(item.quantity) * (costByProduct.get(Number(item.productId)) ?? 0), 0);

  const dayMap = new Map<string, number>();
  const today = new Date();
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(today); day.setDate(today.getDate() - offset);
    dayMap.set(day.toISOString().slice(0, 10), 0);
  }
  for (const invoice of saleInvoices) {
    const key = new Date(String(invoice.createdAt)).toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + num(invoice.total));
  }
  const daily = Array.from(dayMap.entries()).map(([key, total]) => ({
    day: new Date(key).toLocaleDateString("ar-EG", { weekday: "short" }), total: round(total),
  }));

  const topMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const item of items.filter((row) => saleIds.has(Number(row.invoiceId)))) {
    const name = String(item.productName);
    const current = topMap.get(name) ?? { name, quantity: 0, total: 0 };
    current.quantity += num(item.quantity); current.total += num(item.total);
    topMap.set(name, current);
  }
  const topProducts = Array.from(topMap.values()).sort((a, b) => b.total - a.total).slice(0, 6)
    .map((item) => ({ ...item, quantity: round(item.quantity), total: round(item.total) }));

  return {
    salesTotal, purchasesTotal, salesCount: saleInvoices.length, purchasesCount: purchaseInvoices.length,
    profit: round(salesTotal - cost), productsCount: products.length, customersCount,
    stockValue: round(products.reduce((sum, product) => sum + num(product.quantity) * num(product.purchasePrice), 0)),
    lowStock: mapRows(products.filter((product) => num(product.quantity) <= num(product.minQuantity))).map((product) => ({ ...product, createdAt: String(product.createdAt) })) as unknown as ReportsData["lowStock"],
    topProducts, daily, recent: invoices.slice(0, 8).map((invoice) => ({ ...invoice, invoiceDate: String(invoice.invoiceDate), createdAt: String(invoice.createdAt) })) as unknown as ReportsData["recent"],
  };
}

/* ========================= settings & tickets ========================= */
export function getSettings(): StoreSettings {
  const rows = getLocalDb().prepare("SELECT key, value FROM settings").all() as Row[];
  const result: Record<string, string> = { ...DEFAULT_SETTINGS } as unknown as Record<string, string>;
  for (const row of rows) if (String(row.key) in result) result[String(row.key)] = String(row.value);
  return result as unknown as StoreSettings;
}

export function updateSettings(body: Record<string, unknown>): StoreSettings {
  const db = getLocalDb();
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (!(key in body)) continue;
      upsert.run(key, str(body[key]));
    }
  })();
  return getSettings();
}

export function listTickets() {
  return getLocalDb().prepare("SELECT * FROM supportTickets ORDER BY id DESC LIMIT 50").all() as Row[];
}

export function insertTicket(body: Row) {
  const db = getLocalDb();
  const info = db.prepare("INSERT INTO supportTickets (name, phone, subject, message, status, createdAt) VALUES (?,?,?,?,'جديدة',?)")
    .run(str(body.name), str(body.phone), str(body.subject), str(body.message), nowIso());
  return db.prepare("SELECT * FROM supportTickets WHERE id = ?").get(info.lastInsertRowid) as Row;
}

/* ========================= كاميرا الموبايل / الباركود عبر الشبكة ========================= */
export function pushScan(code: string, source = "phone", target = "pos") {
  const db = getLocalDb();
  const clean = String(code ?? "").trim().slice(0, 80);
  if (!clean) throw new Error("الرمز فارغ");
  // نمنع تكرار الرمز نفسه خلال ثانيتين (اهتزاز يد أو قراءة مزدوجة).
  const recent = db.prepare("SELECT id FROM scanQueue WHERE code = ? AND createdAt > ? LIMIT 1")
    .get(clean, new Date(Date.now() - 1500).toISOString());
  if (recent) return { ok: true, duplicate: true, id: Number((recent as Row).id) };
  const info = db.prepare("INSERT INTO scanQueue (code, source, target) VALUES (?, ?, ?)").run(clean, source, target);
  // تنظيف تلقائي للسجلات القديمة (أكثر من 500 صف)
  db.prepare("DELETE FROM scanQueue WHERE id < (SELECT COALESCE(MAX(id),0) - 500 FROM scanQueue)").run();
  return { ok: true, duplicate: false, id: Number(info.lastInsertRowid) };
}

export function pollScans(target = "pos") {
  const db = getLocalDb();
  const rows = db.prepare("SELECT id, code, source, createdAt FROM scanQueue WHERE consumed = 0 AND target = ? ORDER BY id ASC LIMIT 20").all(target) as Row[];
  if (rows.length) {
    const mark = db.prepare("UPDATE scanQueue SET consumed = 1 WHERE id = ?");
    db.transaction(() => { for (const row of rows) mark.run(row.id); })();
  }
  return rows.map((row) => ({ id: Number(row.id), code: String(row.code), source: String(row.source), createdAt: String(row.createdAt) }));
}

export function searchProducts(query: string) {
  const db = getLocalDb();
  const license = getLicense();
  const q = `%${String(query ?? "").trim().toLowerCase()}%`;
  const rows = (license.activated
    ? db.prepare("SELECT * FROM products WHERE lower(name) LIKE ? OR lower(code) LIKE ? OR lower(barcode) LIKE ? ORDER BY id DESC LIMIT 12").all(q, q, q)
    : db.prepare("SELECT * FROM (SELECT * FROM products ORDER BY id ASC LIMIT ?) p WHERE lower(p.name) LIKE ? OR lower(p.code) LIKE ? OR lower(p.barcode) LIKE ? ORDER BY p.id DESC LIMIT 12").all(license.trialProductLimit, q, q, q)) as Row[];
  return mapRows(rows);
}

export function findProductByCode(code: string) {
  const db = getLocalDb();
  const value = String(code ?? "").trim();
  const row = db.prepare("SELECT * FROM products WHERE barcode = ? OR code = ? LIMIT 1").get(value, value) as Row | undefined;
  return row ? mapProduct(row) : null;
}

/* ========================= backup ========================= */
export function exportBackup() {
  const db = getLocalDb();
  const invoices = db.prepare("SELECT * FROM invoices").all() as Row[];
  const items = db.prepare("SELECT * FROM invoiceItems").all() as Row[];
  return {
    app: "الجمال للأدوات المدرسية — نسخة SQLite", version: "3.0.0", exportedAt: nowIso(),
    products: listProducts(), customers: listCustomers(),
    invoices: invoices.map((invoice) => ({ ...invoice, items: items.filter((item) => Number(item.invoiceId) === Number(invoice.id)) })),
    payments: listPayments(),
    settings: db.prepare("SELECT * FROM settings").all(),
    tickets: listTickets(),
  };
}

export function restoreBackup(body: Record<string, unknown>) {
  const db = getLocalDb();
  const rows = (key: string) => (Array.isArray(body[key]) ? body[key] as Row[] : []);
  const products = rows("products");
  const customers = rows("customers");
  const settingsRows = rows("settings");
  if (!products.length && !customers.length && !settingsRows.length) throw new Error("ملف النسخة الاحتياطية غير صالح");

  const insertProductRow = db.prepare(`INSERT INTO products
    (code, barcode, name, category, unit, purchasePrice, salePrice, quantity, minQuantity, taxRate, active, createdAt)
    VALUES (@code,@barcode,@name,@category,@unit,@purchasePrice,@salePrice,@quantity,@minQuantity,@taxRate,@active,@createdAt)
    ON CONFLICT(code) DO UPDATE SET barcode=excluded.barcode, name=excluded.name, category=excluded.category,
      unit=excluded.unit, purchasePrice=excluded.purchasePrice, salePrice=excluded.salePrice,
      quantity=excluded.quantity, minQuantity=excluded.minQuantity, taxRate=excluded.taxRate, active=excluded.active`);
  const insertCustomerRow = db.prepare(`INSERT INTO customers (code,name,phone,address,customerType,balance,createdAt)
    VALUES (@code,@name,@phone,@address,@customerType,@balance,@createdAt)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name, phone=excluded.phone, address=excluded.address,
      customerType=excluded.customerType, balance=excluded.balance`);

  return db.transaction(() => {
    let productCount = 0, customerCount = 0, settingCount = 0;
    for (const row of products) {
      const code = str(row.code), name = str(row.name);
      if (!code || !name) continue;
      insertProductRow.run({
        code, barcode: str(row.barcode), name, category: str(row.category, "عام") || "عام",
        unit: str(row.unit, "قطعة") || "قطعة", purchasePrice: num(row.purchasePrice), salePrice: num(row.salePrice),
        quantity: num(row.quantity), minQuantity: num(row.minQuantity), taxRate: num(row.taxRate),
        active: row.active === false ? 0 : 1, createdAt: str(row.createdAt) || nowIso(),
      });
      productCount++;
    }
    for (const row of customers) {
      const code = str(row.code), name = str(row.name);
      if (!code || !name) continue;
      insertCustomerRow.run({
        code, name, phone: str(row.phone), address: str(row.address),
        customerType: str(row.customerType, "عادي") || "عادي", balance: num(row.balance), createdAt: str(row.createdAt) || nowIso(),
      });
      customerCount++;
    }
    for (const row of settingsRows) {
      const key = str(row.key);
      if (!key) continue;
      db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, str(row.value));
      settingCount++;
    }
    return { products: productCount, customers: customerCount, settings: settingCount };
  })();
}

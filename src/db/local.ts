/** Neon/PostgreSQL persistence for the Vercel web application. */
import { Pool, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { LICENSE_CONFIG } from "@/lib/license-config";
import { round } from "@/lib/format";
import { categorySeed } from "./seed-data";
import {
  DEFAULT_SETTINGS,
  type InstallmentsData,
  type ReportsData,
  type StatementData,
  type StoreSettings,
} from "@/lib/types";

type Row = Record<string, any>;
type IncomingItem = { productId?: number | null; productCode?: string; productName?: string; barcode?: string; unit?: string; quantity?: number; price?: number; discount?: number };
export type InvoiceInput = { invoiceNo?: string; type?: string; customerId?: number | null; customerName?: string; paymentType?: string; discount?: number; tax?: number; paid?: number; notes?: string; items?: IncomingItem[]; createdAt?: string };
export type LicenseState = { installId: string; installedAt: string; activated: boolean; activatedAt: string | null; trialDays: number; trialProductLimit: number; daysUsed: number; daysLeft: number; expired: boolean; limited: boolean; productCount: number; totalProducts: number };

const globalPool = globalThis as typeof globalThis & { __cashgoPool?: Pool; __cashgoSchemaReady?: Promise<void> };
function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL غير مضبوط. أضف رابط Neon في إعدادات Environment Variables على Vercel.");
  if (!globalPool.__cashgoPool) globalPool.__cashgoPool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });
  return globalPool.__cashgoPool;
}
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const rows = (result: { rows: Row[] }): Row[] => result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value])));
const str = (value: unknown, fallback = "") => value == null ? fallback : String(value).trim();
const num = (value: unknown) => { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; };
const nowIso = () => new Date().toISOString();

/** Create missing tables/indexes once per warm server instance; safe to run concurrently. */
async function ensureSchema(): Promise<void> {
  if (!globalPool.__cashgoSchemaReady) {
    globalPool.__cashgoSchemaReady = (async () => {
      const db = getPool();
      const ddl = [
        `CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, barcode TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'عام', unit TEXT NOT NULL DEFAULT 'قطعة', purchase_price NUMERIC(14,3) NOT NULL DEFAULT 0, sale_price NUMERIC(14,3) NOT NULL DEFAULT 0, quantity NUMERIC(14,3) NOT NULL DEFAULT 0, min_quantity NUMERIC(14,3) NOT NULL DEFAULT 0, tax_rate NUMERIC(14,3) NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', customer_type TEXT NOT NULL DEFAULT 'عادي', balance NUMERIC(14,3) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS invoices (id SERIAL PRIMARY KEY, invoice_no TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'sale', customer_id INTEGER, customer_name TEXT NOT NULL DEFAULT 'عميل نقدي', payment_type TEXT NOT NULL DEFAULT 'نقدي', subtotal NUMERIC(14,3) NOT NULL DEFAULT 0, discount NUMERIC(14,3) NOT NULL DEFAULT 0, tax NUMERIC(14,3) NOT NULL DEFAULT 0, total NUMERIC(14,3) NOT NULL DEFAULT 0, paid NUMERIC(14,3) NOT NULL DEFAULT 0, remaining NUMERIC(14,3) NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'محفوظة', invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS invoice_items (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, product_id INTEGER, product_code TEXT NOT NULL DEFAULT '', product_name TEXT NOT NULL, barcode TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT 'قطعة', quantity NUMERIC(14,3) NOT NULL DEFAULT 0, price NUMERIC(14,3) NOT NULL DEFAULT 0, discount NUMERIC(14,3) NOT NULL DEFAULT 0, total NUMERIC(14,3) NOT NULL DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL, amount NUMERIC(14,3) NOT NULL DEFAULT 0, method TEXT NOT NULL DEFAULT 'نقدي', note TEXT NOT NULL DEFAULT '', payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS settings (id SERIAL PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL DEFAULT '')`,
        `CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'جديدة', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE, password TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'admin', phone TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
        `CREATE TABLE IF NOT EXISTS license (id INTEGER PRIMARY KEY CHECK (id = 1), install_id TEXT NOT NULL, installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), activated BOOLEAN NOT NULL DEFAULT FALSE, activated_at TIMESTAMPTZ, trial_days INTEGER NOT NULL DEFAULT 10, trial_product_limit INTEGER NOT NULL DEFAULT 25)`,
        `CREATE TABLE IF NOT EXISTS scan_queue (id SERIAL PRIMARY KEY, code TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'phone', target TEXT NOT NULL DEFAULT 'pos', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), consumed BOOLEAN NOT NULL DEFAULT FALSE)`,
        `CREATE INDEX IF NOT EXISTS idx_scan_queue_poll ON scan_queue(consumed, target, id)`,
        `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)`,
        `CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`,
        `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
      ];
      try {
        for (const sql of ddl) await db.query(sql);
        for (const name of categorySeed) await db.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING", [name]);
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) await db.query("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING", [key, String(value)]);
      } catch (error) { globalPool.__cashgoSchemaReady = undefined; throw error; }
    })();
  }
  await globalPool.__cashgoSchemaReady;
}
async function query(sql: string, params: unknown[] = []) { await ensureSchema(); return getPool().query(sql, params); }
async function all(sql: string, params: unknown[] = []): Promise<Row[]> { return rows(await query(sql, params)); }
async function one(sql: string, params: unknown[] = []): Promise<Row | undefined> { return (await all(sql, params))[0]; }
async function tx<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema(); const client = await getPool().connect();
  try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
const mapProduct = (row: Row): Row => ({ ...row, active: Boolean(row.active) });
const mapRows = (data: Row[]) => data.map(mapProduct);

export async function healthCheck(): Promise<boolean> { await query("SELECT 1"); return true; }

export async function getLicense(): Promise<LicenseState> {
  await query(`INSERT INTO license(id,install_id,trial_days,trial_product_limit) VALUES(1,$1,$2,$3) ON CONFLICT(id) DO NOTHING`, [randomUUID(), LICENSE_CONFIG.trialDays, LICENSE_CONFIG.trialProductLimit]);
  const row = (await one("SELECT * FROM license WHERE id=1"))!;
  const total = Number((await one("SELECT COUNT(*) AS n FROM products"))?.n ?? 0);
  const installed = new Date(row.installedAt).getTime();
  const daysUsed = Math.max(0, Math.floor((Date.now() - installed) / 86400000));
  const trialDays = Number(row.trialDays) || LICENSE_CONFIG.trialDays;
  const trialProductLimit = Number(row.trialProductLimit) || LICENSE_CONFIG.trialProductLimit;
  const activated = Boolean(row.activated);
  return { installId: String(row.installId), installedAt: new Date(row.installedAt).toISOString(), activated, activatedAt: row.activatedAt ? new Date(row.activatedAt).toISOString() : null, trialDays, trialProductLimit, daysUsed, daysLeft: Math.max(0, trialDays - daysUsed), expired: !activated && daysUsed >= trialDays, limited: !activated, productCount: total, totalProducts: total };
}
export async function activateLicense(): Promise<LicenseState> { await getLicense(); await query("UPDATE license SET activated=TRUE, activated_at=NOW() WHERE id=1"); return getLicense(); }
export async function setTrialPolicy(days: number, productLimit: number): Promise<LicenseState> { await getLicense(); await query("UPDATE license SET trial_days=$1, trial_product_limit=$2 WHERE id=1", [Math.max(1, Math.round(days)), Math.max(1, Math.round(productLimit))]); return getLicense(); }

export async function listProducts() {
  const license = await getLicense();
  return mapRows(license.activated ? await all("SELECT * FROM products ORDER BY id DESC") : await all("SELECT * FROM (SELECT * FROM products ORDER BY id ASC LIMIT $1) p ORDER BY id DESC", [license.trialProductLimit]));
}
export async function insertProduct(body: Row) {
  const license = await getLicense();
  if (license.limited && license.totalProducts >= license.trialProductLimit) throw new Error(`النسخة التجريبية تسمح بـ ${license.trialProductLimit} صنفاً فقط — فعّل البرنامج لإضافة أصناف غير محدودة`);
  const code = str(body.code) || `P${Date.now().toString().slice(-7)}`;
  const r = await query(`INSERT INTO products(code,barcode,name,category,unit,purchase_price,sale_price,quantity,min_quantity,tax_rate,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [code,str(body.barcode),str(body.name),str(body.category,"عام")||"عام",str(body.unit,"قطعة")||"قطعة",num(body.purchasePrice),num(body.salePrice),num(body.quantity),num(body.minQuantity),num(body.taxRate),body.active !== false]);
  return mapProduct(rows(r)[0]);
}
export async function updateProduct(body: Row) {
  const id = Number(body.id);
  const r = await query(`UPDATE products SET code=$1,barcode=$2,name=$3,category=$4,unit=$5,purchase_price=$6,sale_price=$7,quantity=$8,min_quantity=$9,tax_rate=$10,active=$11 WHERE id=$12 RETURNING *`, [str(body.code)||`P${Date.now().toString().slice(-7)}`,str(body.barcode),str(body.name),str(body.category,"عام")||"عام",str(body.unit,"قطعة")||"قطعة",num(body.purchasePrice),num(body.salePrice),num(body.quantity),num(body.minQuantity),num(body.taxRate),body.active!==false,id]);
  const result = rows(r)[0]; if (!result) throw new Error("الصنف غير موجود"); return mapProduct(result);
}
export async function deleteProduct(id: number) { await query("DELETE FROM products WHERE id=$1", [id]); }
export async function listCustomers() { return all("SELECT * FROM customers ORDER BY id DESC"); }
export async function insertCustomer(body: Row) {
  const r = await query("INSERT INTO customers(code,name,phone,address,customer_type,balance) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [`C${Date.now().toString().slice(-8)}`,str(body.name),str(body.phone),str(body.address),str(body.customerType,"عادي")||"عادي",num(body.balance)]); return rows(r)[0];
}
export async function listCategories() {
  const aggregated = await all("SELECT category AS name,COUNT(*) AS count,COALESCE(SUM(quantity*purchase_price),0) AS stock_value FROM products GROUP BY category");
  const map = new Map<string, Row>(); for (const row of aggregated) map.set(String(row.name), { name:row.name,count:Number(row.count),stockValue:round(num(row.stockValue)) });
  for (const row of await all("SELECT name FROM categories")) if (!map.has(String(row.name))) map.set(String(row.name),{name:row.name,count:0,stockValue:0});
  return Array.from(map.values()).sort((a,b)=>num(b.count)-num(a.count)||String(a.name).localeCompare(String(b.name),"ar"));
}
export async function insertCategory(name: string) { await query("INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING",[name]); return listCategories(); }
export async function renameCategory(name: string,newName: string) { await tx(async c=>{await c.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING",[newName]); await c.query("UPDATE products SET category=$1 WHERE category=$2",[newName,name]); await c.query("DELETE FROM categories WHERE name=$1",[name]);}); return listCategories(); }
export async function deleteCategory(name: string,moveTo: string) { const n=Number((await one("SELECT COUNT(*) AS n FROM products WHERE category=$1",[name]))?.n??0); if(n&&!moveTo) throw new Error(`المجموعة «${name}» تحتوي ${n} صنف — اختر نقلهم لمجموعة أخرى أولاً`); await tx(async c=>{if(n) await c.query("UPDATE products SET category=$1 WHERE category=$2",[moveTo||"عام",name]); await c.query("DELETE FROM categories WHERE name=$1",[name]);}); return listCategories(); }

export async function nextInvoiceNo(): Promise<string> { return String(1000+Number((await one("SELECT COALESCE(MAX(id),0) AS n FROM invoices"))?.n??0)+1); }
export async function listInvoices(type?: string) { return type ? all("SELECT * FROM invoices WHERE type=$1 ORDER BY id DESC LIMIT 100",[type]) : all("SELECT * FROM invoices ORDER BY id DESC LIMIT 100"); }
export async function getInvoice(id: number) { const invoice=await one("SELECT * FROM invoices WHERE id=$1",[id]); if(!invoice) throw new Error("الفاتورة غير موجودة"); return {...invoice,items:await all("SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id",[id])}; }
export async function createInvoice(body: InvoiceInput) {
  const type=body.type==="purchase"?"purchase":"sale";
  const items=(Array.isArray(body.items)?body.items:[]).filter(i=>str(i.productName)&&num(i.quantity)>0).map(i=>({productId:i.productId?Number(i.productId):null,productCode:str(i.productCode),productName:str(i.productName),barcode:str(i.barcode),unit:str(i.unit,"قطعة")||"قطعة",quantity:round(num(i.quantity)),price:round(num(i.price)),discount:round(num(i.discount))}));
  if(!items.length) throw new Error("لا يمكن حفظ فاتورة بدون أصناف");
  return tx(async c=>{
    if(type==="sale") for(const item of items){if(!item.productId)continue; const p=rows(await c.query("SELECT name,quantity FROM products WHERE id=$1 FOR UPDATE",[item.productId]))[0]; if(p&&num(p.quantity)<item.quantity) throw new Error(`الكمية غير متوفرة للمخزون: ${p.name} (المتوفر ${p.quantity})`);}
    let invoiceNo=str(body.invoiceNo); if(invoiceNo&&(await c.query("SELECT id FROM invoices WHERE invoice_no=$1",[invoiceNo])).rowCount) invoiceNo=""; if(!invoiceNo) invoiceNo=String(1000+Number((rows(await c.query("SELECT COALESCE(MAX(id),0) AS n FROM invoices"))[0]).n)+1);
    const subtotal=round(items.reduce((s,i)=>s+i.quantity*i.price,0)),discount=round(num(body.discount)),tax=round(num(body.tax)),total=round(subtotal-discount+tax),paid=round(body.paid===undefined?total:num(body.paid)),remaining=round(Math.max(0,total-paid)),createdAt=body.createdAt||nowIso();
    const inv=rows(await c.query(`INSERT INTO invoices(invoice_no,type,customer_id,customer_name,payment_type,subtotal,discount,tax,total,paid,remaining,notes,status,invoice_date,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,[invoiceNo,type,body.customerId?Number(body.customerId):null,str(body.customerName,"عميل نقدي")||"عميل نقدي",str(body.paymentType,"نقدي")||"نقدي",subtotal,discount,tax,total,paid,remaining,str(body.notes),remaining>0?"آجل":"محفوظة",createdAt]))[0];
    for(const item of items){await c.query("INSERT INTO invoice_items(invoice_id,product_id,product_code,product_name,barcode,unit,quantity,price,discount,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[inv.id,item.productId,item.productCode,item.productName,item.barcode,item.unit,item.quantity,item.price,item.discount,round(item.quantity*item.price-item.discount)]); if(item.productId) await c.query("UPDATE products SET quantity=quantity+$1 WHERE id=$2",[type==="sale"?-item.quantity:item.quantity,item.productId]);}
    if(type==="sale"&&remaining>0&&body.customerId) await c.query("UPDATE customers SET balance=balance+$1 WHERE id=$2",[remaining,Number(body.customerId)]);
    return inv;
  });
}
export async function deleteInvoice(id:number){await tx(async c=>{const inv=rows(await c.query("SELECT * FROM invoices WHERE id=$1 FOR UPDATE",[id]))[0];if(!inv)throw new Error("الفاتورة غير موجودة");for(const item of rows(await c.query("SELECT * FROM invoice_items WHERE invoice_id=$1",[id])))if(item.productId)await c.query("UPDATE products SET quantity=quantity+$1 WHERE id=$2",[inv.type==="sale"?num(item.quantity):-num(item.quantity),item.productId]);if(inv.type==="sale"&&inv.customerId&&num(inv.remaining)>0)await c.query("UPDATE customers SET balance=GREATEST(0,balance-$1) WHERE id=$2",[num(inv.remaining),inv.customerId]);await c.query("DELETE FROM invoices WHERE id=$1",[id]);});}

export async function listPayments(customerId?:number){return customerId?all("SELECT * FROM payments WHERE customer_id=$1 ORDER BY payment_date DESC LIMIT 200",[customerId]):all("SELECT * FROM payments ORDER BY payment_date DESC LIMIT 200");}
export async function insertPayment(body:Row){const customerId=Number(body.customerId),amount=num(body.amount);if(!customerId||amount<=0)throw new Error("اختر العميل وأدخل مبلغاً صحيحاً أكبر من صفر");const parsed=body.paymentDate?new Date(String(body.paymentDate)):new Date(),paymentDate=Number.isNaN(parsed.getTime())?nowIso():parsed.toISOString();return tx(async c=>{const p=rows(await c.query("INSERT INTO payments(customer_id,amount,method,note,payment_date) VALUES($1,$2,$3,$4,$5) RETURNING *",[customerId,amount,str(body.method,"نقدي")||"نقدي",str(body.note),paymentDate]))[0];await c.query("UPDATE customers SET balance=GREATEST(0,balance-$1) WHERE id=$2",[amount,customerId]);return p;});}
export async function deletePayment(id:number){await tx(async c=>{const p=rows(await c.query("SELECT * FROM payments WHERE id=$1 FOR UPDATE",[id]))[0];if(!p)throw new Error("الدفعة غير موجودة");await c.query("DELETE FROM payments WHERE id=$1",[id]);await c.query("UPDATE customers SET balance=balance+$1 WHERE id=$2",[num(p.amount),p.customerId]);});}

type Entry={id:string;date:Date;kind:"invoice"|"payment";description:string;reference:string;debit:number;credit:number;net:number};
export async function getStatement(customerId:number,fromText="",toText=""):Promise<StatementData>{const customer=await one("SELECT * FROM customers WHERE id=$1",[customerId]);if(!customer)throw new Error("العميل غير موجود");const from=fromText?new Date(`${fromText}T00:00:00`):null,to=toText?new Date(`${toText}T23:59:59.999`):null,validFrom=from&&!Number.isNaN(from.getTime())?from:null,validTo=to&&!Number.isNaN(to.getTime())?to:null;const entries:Entry[]=[];for(const i of await all("SELECT * FROM invoices WHERE customer_id=$1 AND type='sale'",[customerId]))entries.push({id:`invoice-${i.id}`,date:new Date(i.createdAt),kind:"invoice",description:`فاتورة مبيعات - ${i.paymentType}`,reference:String(i.invoiceNo),debit:num(i.total),credit:num(i.paid),net:num(i.total)-num(i.paid)});for(const p of await all("SELECT * FROM payments WHERE customer_id=$1",[customerId]))entries.push({id:`payment-${p.id}`,date:new Date(p.paymentDate),kind:"payment",description:`دفعة ${p.method}${p.note?` - ${p.note}`:""}`,reference:`PAY-${p.id}`,debit:0,credit:num(p.amount),net:-num(p.amount)});entries.sort((a,b)=>a.date.getTime()-b.date.getTime());const opening=round(entries.filter(e=>validFrom&&e.date<validFrom).reduce((s,e)=>s+e.net,0)),inRange=entries.filter(e=>(!validFrom||e.date>=validFrom)&&(!validTo||e.date<=validTo));let running=opening,debitTotal=0,creditTotal=0;const transactions=inRange.map(e=>{running=round(running+e.net);debitTotal+=e.debit;creditTotal+=e.credit;return{id:e.id,date:e.date.toISOString(),kind:e.kind,description:e.description,reference:e.reference,debit:round(e.debit),credit:round(e.credit),balance:running};});return{customer:customer as unknown as StatementData["customer"],opening,debitTotal:round(debitTotal),creditTotal:round(creditTotal),closing:round(running),transactions};}
export async function getInstallments():Promise<InstallmentsData>{const invoices=await all("SELECT * FROM invoices WHERE type='sale' AND payment_type='قسط'");if(!invoices.length)return{plans:[],overdue:[]};const ids=[...new Set(invoices.map(i=>Number(i.customerId)).filter(Boolean))],payments=await all("SELECT * FROM payments"),last=new Map<number,{amount:number;date:Date}>();for(const p of payments){const id=Number(p.customerId);if(!ids.includes(id))continue;const date=new Date(p.paymentDate),prev=last.get(id);if(!prev||date>prev.date)last.set(id,{amount:num(p.amount),date});}const now=Date.now(),plans=[] as any[];for(const id of ids){const customer=await one("SELECT * FROM customers WHERE id=$1",[id]),rs=invoices.filter(i=>Number(i.customerId)===id),totalPlan=round(rs.reduce((s,i)=>s+num(i.total),0)),debt=round(rs.reduce((s,i)=>s+Math.max(0,num(i.total)-num(i.paid)),0)),lp=last.get(id),reference=lp?.date??rs.map(i=>new Date(i.createdAt)).sort((a,b)=>a.getTime()-b.getTime())[0]??new Date(),daysSincePayment=Math.max(0,Math.floor((now-reference.getTime())/86400000));if(debt>.001)plans.push({customerId:id,customerName:String(customer?.name??"غير معروف"),phone:String(customer?.phone??""),customerType:String(customer?.customerType??""),totalPlan,debt,invoiceCount:rs.length,lastPaymentAmount:lp?round(lp.amount):null,lastPaymentDate:lp?.date.toISOString()??null,referenceDate:reference.toISOString(),daysSincePayment,overdue:daysSincePayment>=60});}plans.sort((a,b)=>b.daysSincePayment-a.daysSincePayment);return{plans,overdue:plans.filter(p=>p.overdue)};}

export async function getReports():Promise<ReportsData>{const [invoices,items,products,customers]=await Promise.all([all("SELECT * FROM invoices ORDER BY id DESC LIMIT 500"),all("SELECT * FROM invoice_items"),listProducts(),one("SELECT COUNT(*) AS n FROM customers")]);const sales=invoices.filter(i=>i.type==="sale"),purchases=invoices.filter(i=>i.type==="purchase"),salesTotal=round(sales.reduce((s,i)=>s+num(i.total),0)),purchasesTotal=round(purchases.reduce((s,i)=>s+num(i.total),0)),saleIds=new Set(sales.map(i=>Number(i.id))),costByProduct=new Map(products.map(p=>[Number(p.id),num(p.purchasePrice)])),cost=items.filter(i=>saleIds.has(Number(i.invoiceId))).reduce((s,i)=>s+num(i.quantity)*(costByProduct.get(Number(i.productId))??0),0);const dayMap=new Map<string,number>(),today=new Date();for(let o=6;o>=0;o--){const d=new Date(today);d.setDate(today.getDate()-o);dayMap.set(d.toISOString().slice(0,10),0);}for(const i of sales){const k=new Date(i.createdAt).toISOString().slice(0,10);if(dayMap.has(k))dayMap.set(k,(dayMap.get(k)??0)+num(i.total));}const daily=Array.from(dayMap.entries()).map(([key,total])=>({day:new Date(key).toLocaleDateString("ar-EG",{weekday:"short"}),total:round(total)}));const tops=new Map<string,{name:string;quantity:number;total:number}>();for(const i of items.filter(r=>saleIds.has(Number(r.invoiceId)))){const name=String(i.productName),x=tops.get(name)??{name,quantity:0,total:0};x.quantity+=num(i.quantity);x.total+=num(i.total);tops.set(name,x);}const topProducts=Array.from(tops.values()).sort((a,b)=>b.total-a.total).slice(0,6).map(i=>({...i,quantity:round(i.quantity),total:round(i.total)}));return{salesTotal,purchasesTotal,salesCount:sales.length,purchasesCount:purchases.length,profit:round(salesTotal-cost),productsCount:products.length,customersCount:Number(customers?.n??0),stockValue:round(products.reduce((s,p)=>s+num(p.quantity)*num(p.purchasePrice),0)),lowStock:mapRows(products.filter(p=>num(p.quantity)<=num(p.minQuantity))) as unknown as ReportsData["lowStock"],topProducts,daily,recent:invoices.slice(0,8) as unknown as ReportsData["recent"]};}

export async function getSettings():Promise<StoreSettings>{const result={...DEFAULT_SETTINGS} as unknown as Record<string,string>;for(const row of await all("SELECT key,value FROM settings"))if(String(row.key) in result)result[String(row.key)]=String(row.value);return result as unknown as StoreSettings;}
export async function updateSettings(body:Record<string,unknown>):Promise<StoreSettings>{await tx(async c=>{for(const key of Object.keys(DEFAULT_SETTINGS))if(key in body)await c.query("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[key,str(body[key])]);});return getSettings();}
export async function listTickets(){return all("SELECT * FROM support_tickets ORDER BY id DESC LIMIT 50");}
export async function insertTicket(body:Row){return rows(await (await query("INSERT INTO support_tickets(name,phone,subject,message,status) VALUES($1,$2,$3,$4,'جديدة') RETURNING *",[str(body.name),str(body.phone),str(body.subject),str(body.message)])))[0];}
export async function pushScan(code:string,source="phone",target="pos"){const clean=String(code??"").trim().slice(0,80);if(!clean)throw new Error("الرمز فارغ");const recent=await one("SELECT id FROM scan_queue WHERE code=$1 AND created_at>NOW()-INTERVAL '1.5 seconds' LIMIT 1",[clean]);if(recent)return{ok:true,duplicate:true,id:Number(recent.id)};const inserted=rows(await query("INSERT INTO scan_queue(code,source,target) VALUES($1,$2,$3) RETURNING id",[clean,source,target]))[0];await query("DELETE FROM scan_queue WHERE id < (SELECT GREATEST(COALESCE(MAX(id),0)-500,0) FROM scan_queue)");return{ok:true,duplicate:false,id:Number(inserted.id)};}
export async function pollScans(target="pos"){return tx(async c=>{const result=rows(await c.query("SELECT id,code,source,created_at FROM scan_queue WHERE consumed=FALSE AND target=$1 ORDER BY id ASC LIMIT 20 FOR UPDATE SKIP LOCKED",[target]));if(result.length)await c.query("UPDATE scan_queue SET consumed=TRUE WHERE id=ANY($1::int[])",[result.map(r=>r.id)]);return result.map(r=>({id:Number(r.id),code:String(r.code),source:String(r.source),createdAt:new Date(r.createdAt).toISOString()}));});}
export async function searchProducts(queryText:string){const license=await getLicense(),q=`%${String(queryText??"").trim().toLowerCase()}%`;return mapRows(license.activated?await all("SELECT * FROM products WHERE lower(name) LIKE $1 OR lower(code) LIKE $1 OR lower(barcode) LIKE $1 ORDER BY id DESC LIMIT 12",[q]):await all("SELECT * FROM (SELECT * FROM products ORDER BY id ASC LIMIT $1) p WHERE lower(p.name) LIKE $2 OR lower(p.code) LIKE $2 OR lower(p.barcode) LIKE $2 ORDER BY p.id DESC LIMIT 12",[license.trialProductLimit,q]));}
export async function findProductByCode(code:string){const value=String(code??"").trim(),row=await one("SELECT * FROM products WHERE barcode=$1 OR code=$1 LIMIT 1",[value]);return row?mapProduct(row):null;}
export async function exportBackup(){const [invoices,items,products,customers,payments,settings,tickets]=await Promise.all([all("SELECT * FROM invoices"),all("SELECT * FROM invoice_items"),listProducts(),listCustomers(),listPayments(),all("SELECT * FROM settings"),listTickets()]);return{app:"Cashgo — نسخة Neon",version:"3.0.0",exportedAt:nowIso(),products,customers,invoices:invoices.map(i=>({...i,items:items.filter(x=>Number(x.invoiceId)===Number(i.id))})),payments,settings,tickets};}
export async function restoreBackup(body:Record<string,unknown>){const rowsOf=(key:string)=>Array.isArray(body[key])?body[key] as Row[]:[],products=rowsOf("products"),customers=rowsOf("customers"),settings=rowsOf("settings");if(!products.length&&!customers.length&&!settings.length)throw new Error("ملف النسخة الاحتياطية غير صالح");return tx(async c=>{let pc=0,cc=0,sc=0;for(const p of products){const code=str(p.code),name=str(p.name);if(!code||!name)continue;await c.query(`INSERT INTO products(code,barcode,name,category,unit,purchase_price,sale_price,quantity,min_quantity,tax_rate,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(code) DO UPDATE SET barcode=EXCLUDED.barcode,name=EXCLUDED.name,category=EXCLUDED.category,unit=EXCLUDED.unit,purchase_price=EXCLUDED.purchase_price,sale_price=EXCLUDED.sale_price,quantity=EXCLUDED.quantity,min_quantity=EXCLUDED.min_quantity,tax_rate=EXCLUDED.tax_rate,active=EXCLUDED.active`,[code,str(p.barcode),name,str(p.category,"عام")||"عام",str(p.unit,"قطعة")||"قطعة",num(p.purchasePrice),num(p.salePrice),num(p.quantity),num(p.minQuantity),num(p.taxRate),p.active!==false]);pc++;}for(const p of customers){const code=str(p.code),name=str(p.name);if(!code||!name)continue;await c.query(`INSERT INTO customers(code,name,phone,address,customer_type,balance) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone,address=EXCLUDED.address,customer_type=EXCLUDED.customer_type,balance=EXCLUDED.balance`,[code,name,str(p.phone),str(p.address),str(p.customerType,"عادي")||"عادي",num(p.balance)]);cc++;}for(const s of settings){const key=str(s.key);if(!key)continue;await c.query("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[key,str(s.value)]);sc++;}return{products:pc,customers:cc,settings:sc};});}

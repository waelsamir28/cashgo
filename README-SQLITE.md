# دمج قاعدة SQLite المحلية في نسخة Electron — برنامج الجمال

> ✅ ملف `algamal.db` يُنشأ تلقائياً داخل `%APPDATA%\algamal-desktop\` على ويندوز.
> ✅ لا يحتاج المستخدم النهائي إلى Node.js أو Python أو PostgreSQL أو أي برنامج قاعدة بيانات.
> ✅ الملف لا يُحذف عند تحديث النسخة (لأن المسار مرتبط باسم التطبيق لا برقم الإصدار).
> ✅ نفس الملف تستخدمه العملية الرئيسية (IPC) وخادم Next.js المحلي (`/api/*`).

---

## الخطوة 1 — الأوامر المضبوطة لتثبيت الحزم

```bash
# 1) من جذر المشروع: better-sqlite3 كـ dependency إنتاجي
npm install better-sqlite3@11.10.0
npm install --save-dev @types/better-sqlite3     # لأن المشروع TypeScript

# 2) من مجلد desktop: electron-rebuild كـ devDependency
cd desktop
npm install --save-dev electron-rebuild@3.2.9
npm install --save better-sqlite3@11.10.0       # يُذكر كـ dependency إنتاجي أيضاً

# 3) إعادة بناء الوحدة الأصلية على ABI الخاص بـ Electron 33 (بعد prepare.mjs)
npx electron-rebuild --version 33.4.11 --module-dir app --force
# أو ببساطة (موصى به: يجرب الـ prebuilt الرسمي أولاً ثم electron-rebuild):
npm run rebuild      # ينفّذ desktop/rebuild-native.mjs
```

> في هذه البيئة تم فعلياً استخدام:
> `prebuild-install --runtime=electron --target=33.4.11 --platform=win32 --arch=x64 --force`
> (نتيجة ABI = 130، والملف الناتج بتوقيع `MZ`). `electron-rebuild` يبقى المسار البديل على ويندوز.

> لماذا؟ `better-sqlite3` وحدة C++ أصلية (`.node`)، ويجب أن تُبنى على **ABI إلكترون** وليس ABI نود.
> على جهاز ويندوز يحتاج `electron-rebuild` إلى Visual Studio Build Tools + Python **فقط على جهاز البناء**، وليس على جهاز المستخدم.

### بناء كامل (من ويندوز، نقرة واحدة)
```bat
build-exe.bat
```
أو يدوياً:
```bash
npm run build
cd desktop
npm install
node prepare.mjs
npm run rebuild        # electron-rebuild
npm run dist           # rebuild + electron-builder --win --x64
```

---

## الخطوة 2 — `database.js` (جذر المشروع)

- يستورد `better-sqlite3` و`path` و`app` من Electron (مع حماية عند التشغيل كـ Node فرعي).
- ينشئ `algamal.db` في `app.getPath('userData')`، ويضبط `WAL` و`foreign_keys`.
- ينشئ الجداول الافتراضية عند أول تشغيل من `src/db/schema-sql.json`:
  `users`, `products`, `customers`, `invoices`, `invoiceItems`, `payments`, `categories`, `settings`, `supportTickets`.
- يصدّر لكل جدول من (users / products / invoices): `add`, `getAll`, `getById`, `update`, `delete`.
  مثال: `addUser / getAllUsers / getUserById / updateUser / deleteUser`، وكذلك `addProduct…` و`addInvoice…`.
- كل دالة تُرجع `{ ok: true, data }` أو `{ ok: false, error }` (لا استثناءات تصل للرندرر).
- `closeDatabase()` تُستدعى من `before-quit` وتعمل `wal_checkpoint(TRUNCATE)`.

### مسار قاعدة البيانات
| السياق | المسار |
|---|---|
| Electron main | `app.getPath('userData')/algamal.db` → `C:\Users\<user>\AppData\Roaming\algamal-desktop\algamal.db` |
| خادم Next.js الفرعي | نفس المسار عبر متغير البيئة `ALGAMAL_USER_DATA` الذي يضبطه `main.cjs` |
| المعاينة/التطوير خارج Electron | `~/.local/share/algamal-desktop/algamal.db` (أو `ALGAMAL_SQLITE_PATH`) |

---

## الخطوة 3 — `desktop/main.cjs`

```js
const { app, ipcMain } = require("electron");
const database = require("./app/database.js");   // يُنسخ عبر prepare.mjs

app.whenReady().then(async () => {
  process.env.ALGAMAL_USER_DATA = app.getPath("userData");
  process.env.ALGAMAL_SQLITE = "1";
  const result = database.initDatabase();          // إنشاء الجداول
  database.registerIpcHandlers(ipcMain);           // كل معالجات ipcMain.handle
  // ... ثم تشغيل خادم Next.js وفتح النافذة مع preload
});

app.on("before-quit", (event) => {
  event.preventDefault();
  database.closeDatabase();                       // إغلاق آمن
  app.exit(0);
});
```

القنوات المسجّلة: `db:getInfo`, `db:addUser`, `db:getAllUsers`, `db:getUserById`, `db:updateUser`, `db:deleteUser`، ونفس النمط لـ `Product` و`Invoice`.

---

## الخطوة 4 — `desktop/preload.js`

```js
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("db", {
  addUser: (data) => ipcRenderer.invoke("db:addUser", data),
  getAllUsers: () => ipcRenderer.invoke("db:getAllUsers"),
  // ... باقي العمليات
});
```
`contextIsolation: true` و`nodeIntegration: false` — الرندرر لا يصل لـ Node مباشرة.

---

## الخطوة 5 — أمثلة الاستخدام من الرندرر

### مثال 1: async/await — إضافة مستخدمين ثم قراءتهم
```js
async function seedUsers() {
  if (!window.db) { console.warn("هذه النسخة تعمل خارج Electron"); return; }

  const created = await window.db.addUser({
    name: "أحمد محمود",
    username: "ahmed",
    password: "123456",
    role: "admin",
    phone: "01222355769",
  });
  if (!created.ok) { console.error("فشل الإضافة:", created.error); return; }
  console.log("تم الإنشاء:", created.data.id);

  const list = await window.db.getAllUsers({ limit: 100 });
  if (list.ok) console.table(list.data);
}
```

### مثال 2: async/await — دورة CRUD كاملة على الأصناف
```js
async function productCrud() {
  const added = await window.db.addProduct({
    code: "9001", name: "كراسة 100 ورقة",
    purchasePrice: 12, salePrice: 18, quantity: 50, active: true,
  });
  const id = added.data.id;

  await window.db.updateProduct(id, { salePrice: 20, quantity: 45 });
  const one = await window.db.getProductById(id);
  console.log("بعد التعديل:", one.data);

  const all = await window.db.getAllProducts();
  console.log("عدد الأصناف:", all.data.length);

  await window.db.deleteProduct(id);
  console.log("تم الحذف");
}
```

### مثال 3: async/await — فواتير + معلومات الملف
```js
async function invoiceExample() {
  const info = await window.db.getInfo();
  console.log("مسار قاعدة البيانات:", info.data.path, info.data.counts);

  const invoice = await window.db.addInvoice({
    invoiceNo: "1099", type: "sale", customerName: "مكتبة النور",
    paymentType: "نقدي", subtotal: 180, total: 180, paid: 180, remaining: 0,
  });
  if (!invoice.ok) return console.error(invoice.error);

  const invoices = await window.db.getAllInvoices();
  console.log(invoices.data);
}
```

### مثال 4: نمط Promise (بدون async) + معالجة أخطاء مركزية
```js
function safe(channel, ...args) {
  return window.db[channel](...args).then((res) => {
    if (!res.ok) throw new Error(res.error);
    return res.data;
  });
}

safe("getAllProducts")
  .then((products) => console.log("الأصناف:", products.length))
  .catch((error) => console.error("خطأ قاعدة البيانات:", error.message));
```

### مثال 5: داخل مكوّن React (useEffect)
```tsx
"use client";
import { useEffect, useState } from "react";

export function DbStatus() {
  const [path, setPath] = useState("—");
  useEffect(() => {
    if (!window.db) return;
    window.db.getInfo().then((res) => { if (res.ok) setPath(res.data.path); });
  }, []);
  return <span>قاعدة البيانات: {path}</span>;
}
```

> ملاحظة: واجهة الويب نفسها تستخدم `/api/*` (نفس ملف `algamal.db` عبر طبقة `src/db/local.ts`)،
> بينما `window.db` متاح لأي ميزة إضافية تريد تنفيذها مباشرة من الرندرر عبر IPC.

---

## الخطوة 6 — `desktop/prepare.mjs`

- أضيف `database.js` و`src/db/schema-sql.json` لقائمة النسخ داخل `desktop/app/`.
- يتحقق من وجود `app/node_modules/better-sqlite3/build/Release/better_sqlite3.node`.
- ينسخه إلى `desktop/build/native/better-sqlite3/` (ويُضمّن كـ `extraResources`).
- يفحص توقيع `MZ`: إن كان `ELF` يطبع تحذيراً صريحاً بأن الوحدة تحتاج `npm run rebuild` على ويندوز.
- إعداد `build.files` يضمن تضمين `app/**/*` (وبالتالي كل ملفات `.node`).

---

## الخطوة 7 — `desktop/package.json`

```json
{
  "dependencies": { "better-sqlite3": "^11.10.0" },
  "devDependencies": { "electron-rebuild": "^3.2.9", "electron": "^33.2.0", "electron-builder": "^25.1.8" },
  "scripts": {
    "rebuild": "electron-rebuild --version 33.4.11 --module-dir app --force",
    "dist": "npm run rebuild && electron-builder --win --x64"
  },
  "build": {
    "asar": false,
    "npmRebuild": false,
    "asarUnpack": ["**/*.node", "**/better-sqlite3/**"],
    "extraResources": [{ "from": "build/native", "to": "native", "filter": ["**/*"] }],
    "files": ["main.cjs", "preload.js", "package.json", "database.js", "build/**/*", "app/**/*"]
  }
}
```

`npmRebuild: false` لأننا نُعيد البناء صراحةً بـ `electron-rebuild` قبل التعبئة (تحكم كامل في ABI).

---

## ضمانات التشغيل
- **الاستمرارية:** ملف واحد في `userData` + `WAL` + إغلاق نظيف عند الخروج ⇒ لا فقدان بيانات.
- **التحديثات:** NSIS لا يمسح `userData`، واسم المجلد ثابت ⇒ البيانات تبقى بعد التحديث.
- **بدون متطلبات خارجية:** SQLite مضمّن داخل `.exe`، و`better_sqlite3.node` يُشحن مع الحزمة.
- **الأمان:** لا `nodeIntegration`، كل الوصول عبر `contextBridge` + `ipcMain.handle` مع قوائم أعمدة بيضاء تمنع حقن SQL.

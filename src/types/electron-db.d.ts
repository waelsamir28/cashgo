type DbRow = Record<string, unknown>;
type DbResult<T = DbRow> = Promise<{ ok: true; data: T } | { ok: false; error: string }>;

/** واجهة IPC التي يعرضها desktop/preload.js داخل Electron فقط */
interface ElectronDbBridge {
  getInfo: () => DbResult<{ path: string; engine: string; counts: Record<string, number> }>;
  addUser: (data: DbRow) => DbResult<DbRow>;
  getAllUsers: (options?: { limit?: number }) => DbResult<DbRow[]>;
  getUserById: (id: number) => DbResult<DbRow>;
  updateUser: (id: number, data: DbRow) => DbResult<DbRow>;
  deleteUser: (id: number) => DbResult<{ deleted: number }>;
  addProduct: (data: DbRow) => DbResult<DbRow>;
  getAllProducts: (options?: { limit?: number }) => DbResult<DbRow[]>;
  getProductById: (id: number) => DbResult<DbRow>;
  updateProduct: (id: number, data: DbRow) => DbResult<DbRow>;
  deleteProduct: (id: number) => DbResult<{ deleted: number }>;
  addInvoice: (data: DbRow) => DbResult<DbRow>;
  getAllInvoices: (options?: { limit?: number }) => DbResult<DbRow[]>;
  getInvoiceById: (id: number) => DbResult<DbRow>;
  updateInvoice: (id: number, data: DbRow) => DbResult<DbRow>;
  deleteInvoice: (id: number) => DbResult<{ deleted: number }>;
}

interface Window {
  db?: ElectronDbBridge;
}

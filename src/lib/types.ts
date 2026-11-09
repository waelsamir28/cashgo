export type Product = {
  id: number;
  code: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  taxRate: number;
  active: boolean;
  createdAt: string;
};

export type Customer = {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  customerType: string;
  balance: number;
  createdAt: string;
};

export type InvoiceItem = {
  id: number;
  invoiceId: number;
  productId: number | null;
  productCode: string;
  productName: string;
  barcode: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
};

export type Invoice = {
  id: number;
  invoiceNo: string;
  type: string;
  customerId: number | null;
  customerName: string;
  paymentType: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  notes: string;
  status: string;
  invoiceDate: string;
  createdAt: string;
  items?: InvoiceItem[];
};

export type CategoryInfo = {
  name: string;
  count: number;
  stockValue: number;
};

export type StoreSettings = {
  storeName: string;
  subtitle: string;
  phone: string;
  address: string;
  taxNumber: string;
  currency: string;
  defaultTax: string;
  printer: string;
  footer: string;
  theme: string;
  customPrimary: string;
  customAccent: string;
  invoiceHeader: string;
  invoiceSubtitle: string;
  invoiceAccent: string;
  invoiceTableHeader: string;
  invoiceLogoUrl: string;
  invoiceShowLogo: string;
  invoiceShowBarcode: string;
  invoiceShowTax: string;
  invoiceShowBalance: string;
  invoicePaper: string;
  invoiceFontSize: string;
  invoiceFooter: string;
  invoiceTemplate: string;
  appFont: string;
  buttonShape: string;
  buttonSize: string;
  visibleModules: string;
  customModules: string;
  uiFlags: string;
};

export type Payment = {
  id: number;
  customerId: number;
  amount: number;
  method: string;
  note: string;
  paymentDate: string;
  createdAt: string;
};

export type StatementTransaction = {
  id: string;
  date: string;
  kind: "invoice" | "payment";
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

export type StatementData = {
  customer: Customer | null;
  opening: number;
  debitTotal: number;
  creditTotal: number;
  closing: number;
  transactions: StatementTransaction[];
};

export type SupportTicket = {
  id: number;
  name: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export type ReportsData = {
  salesTotal: number;
  purchasesTotal: number;
  salesCount: number;
  purchasesCount: number;
  profit: number;
  productsCount: number;
  customersCount: number;
  stockValue: number;
  lowStock: Product[];
  topProducts: { name: string; quantity: number; total: number }[];
  daily: { day: string; total: number }[];
  recent: Invoice[];
};

export type ScreenKey =
  | "home"
  | "sales"
  | "purchases"
  | "inventory"
  | "reports"
  | "customers"
  | "settings"
  | "backup"
  | "support"
  | "about"
  | "help"
  | "statements"
  | "installments"
  | "labels"
  | "pricecheck"
  | "preview"
  | "customize";

export type InstallmentPlan = {
  customerId: number;
  customerName: string;
  phone: string;
  customerType: string;
  totalPlan: number;
  debt: number;
  invoiceCount: number;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  referenceDate: string | null;
  daysSincePayment: number;
  overdue: boolean;
};

export type InstallmentsData = {
  plans: InstallmentPlan[];
  overdue: InstallmentPlan[];
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "الجمال للأدوات المدرسية",
  subtitle: "للأدوات المدرسية والمكتبية",
  phone: "01222355769",
  address: "جمهورية مصر العربية",
  taxNumber: "",
  currency: "ج.م",
  defaultTax: "0",
  printer: "الطابعة الافتراضية للنظام",
  footer: "شكراً لتعاملكم معنا",
  theme: "blue",
  customPrimary: "",
  customAccent: "",
  invoiceHeader: "الجمال للأدوات المدرسية",
  invoiceSubtitle: "للأدوات المدرسية والمكتبية والقرطاسية",
  invoiceAccent: "#0b4fa2",
  invoiceTableHeader: "#e4f0fc",
  invoiceLogoUrl: "",
  invoiceShowLogo: "true",
  invoiceShowBarcode: "true",
  invoiceShowTax: "true",
  invoiceShowBalance: "true",
  invoicePaper: "A4",
  invoiceFontSize: "12",
  invoiceFooter: "شكراً لتعاملكم معنا — لا ترد البضاعة بعد 3 أيام",
  invoiceTemplate: "classic",
  appFont: "",
  buttonShape: "soft",
  buttonSize: "normal",
  visibleModules: "",
  customModules: "[]",
  uiFlags: "",
};

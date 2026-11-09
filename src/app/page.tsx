import { listProducts, listCustomers, listInvoices, getSettings, getLicense } from "@/db/local";
import { DEFAULT_SETTINGS, type Customer, type Invoice, type Product, type StoreSettings } from "@/lib/types";
import type { LicenseState } from "@/db/local";
import DesktopApp from "@/components/DesktopApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let productRows: Product[] = [];
  let customerRows: Customer[] = [];
  let invoiceRows: Invoice[] = [];
  let settings: StoreSettings = DEFAULT_SETTINGS;
  let license: LicenseState | null = null;

  try {
    productRows = listProducts() as unknown as Product[];
    customerRows = listCustomers() as unknown as Customer[];
    invoiceRows = listInvoices() as unknown as Invoice[];
    settings = getSettings();
    license = getLicense();
  } catch {
    // تبقى الواجهة قابلة للتحميل وتعيد المحاولة عبر الـ API إذا تعذر فتح الملف لحظياً.
  }

  return (
    <DesktopApp
      initialProducts={productRows}
      initialCustomers={customerRows}
      initialInvoices={invoiceRows}
      initialSettings={settings}
      initialLicense={license}
    />
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BadgeCheck, BarChart3, Barcode as BarcodeIcon, BookOpen, Boxes,
  Calculator, ChevronLeft, ClipboardList, Clock3, CreditCard, Database, FileSearch,
  Camera, FileText, GraduationCap, Headset, HelpCircle, Home, Info, KeyRound, LogOut, Minus,
  NotebookPen, Package, PackageSearch, Palette, Pencil, Phone, Printer, Save, Settings,
  ShoppingBasket, ShoppingCart, SlidersHorizontal, Square, Star, Tags, Users, Wallet,
  Warehouse, Wifi, X, type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { dateTime, money, num } from "@/lib/format";
import {
  fontStack, getThemeKey, getThemeVars, MODULE_LABELS, parseCustomModules,
  parseUiFlags, parseVisibleModules, type CustomModule, type UiFlags,
} from "@/lib/appearance";
import {
  DEFAULT_SETTINGS, type Customer, type InstallmentsData, type Invoice, type Product,
  type ReportsData, type ScreenKey, type StoreSettings, type SupportTicket,
} from "@/lib/types";
import { SUPPORT, TEL_URL, whatsappUrl } from "@/lib/support";
import type { LicenseState } from "@/db/local";
import LoginScreen from "@/components/LoginScreen";
import LicenseGate from "@/components/LicenseGate";
import PriceCheck from "@/components/PriceCheck";
import PhoneScanDialog from "@/components/PhoneScanDialog";
import InstallmentsScreen from "@/components/InstallmentsScreen";
import PosScreen from "@/components/PosScreen";
import InventoryScreen from "@/components/InventoryScreen";
import CustomersScreen from "@/components/CustomersScreen";
import ReportsScreen from "@/components/ReportsScreen";
import SettingsScreen from "@/components/SettingsScreen";
import BackupScreen from "@/components/BackupScreen";
import SupportScreen from "@/components/SupportScreen";
import InfoScreen from "@/components/InfoScreen";
import StatementsScreen from "@/components/StatementsScreen";
import LabelsScreen from "@/components/LabelsScreen";
import InvoicePreviewScreen from "@/components/InvoicePreviewScreen";
import CustomizationScreen from "@/components/CustomizationScreen";

type Props = {
  initialProducts: Product[];
  initialCustomers: Customer[];
  initialInvoices: Invoice[];
  initialSettings: StoreSettings;
  initialLicense: LicenseState | null;
};

type ToastState = { message: string; error: boolean } | null;
type TileKey = ScreenKey | "exit";

const MODULE_ICONS: Record<ScreenKey, LucideIcon> = {
  home: Home, sales: ShoppingCart, purchases: Package, inventory: Warehouse,
  labels: BarcodeIcon, pricecheck: PackageSearch, reports: BarChart3, customers: Users, settings: Settings,
  backup: Database, support: Headset, about: Info, help: HelpCircle,
  statements: Wallet, installments: CreditCard, preview: FileSearch, customize: SlidersHorizontal,
};

const CUSTOM_ICONS: Record<string, LucideIcon> = {
  NotebookPen, Pencil, BookOpen, Boxes, Star, ClipboardList, GraduationCap,
  Printer, Calculator, FileText, Tags, Palette,
};

const NAV_ORDER: ScreenKey[] = [
  "home", "sales", "purchases", "inventory", "pricecheck", "labels", "reports", "statements", "installments",
  "preview", "customers", "backup", "support", "settings", "customize", "help",
];

const TILE_DEFS: { key: TileKey; label: string; icon: LucideIcon; color: string }[] = [
  { key: "settings", label: "الإعدادات", icon: Settings, color: "linear-gradient(#2f9cef,#0754a8)" },
  { key: "reports", label: "التقارير", icon: BarChart3, color: "linear-gradient(#f6a14a,#d9531e)" },
  { key: "inventory", label: "المخازن", icon: Warehouse, color: "linear-gradient(#3b92e8,#0b4b9d)" },
  { key: "purchases", label: "المشتريات", icon: Package, color: "linear-gradient(#f5bb54,#c87912)" },
  { key: "sales", label: "المبيعات", icon: ShoppingCart, color: "linear-gradient(#48bd6b,#13873c)" },
  { key: "labels", label: "ملصقات الباركود", icon: BarcodeIcon, color: "linear-gradient(#64748b,#334155)" },
  { key: "pricecheck", label: "استعلام سعر", icon: PackageSearch, color: "linear-gradient(#28b8c4,#0b7285)" },
  { key: "statements", label: "كشف حساب", icon: Wallet, color: "linear-gradient(#38b6a8,#0d766e)" },
  { key: "installments", label: "التقسيط", icon: CreditCard, color: "linear-gradient(#f59e0b,#c2410c)" },
  { key: "preview", label: "معاينة الفواتير", icon: FileSearch, color: "linear-gradient(#a37ae6,#6335a8)" },
  { key: "customers", label: "العملاء", icon: Users, color: "linear-gradient(#f3a75f,#c66b1d)" },
  { key: "backup", label: "النسخ الاحتياطي", icon: Database, color: "linear-gradient(#5bca8c,#128649)" },
  { key: "support", label: "الدعم الفني", icon: Headset, color: "linear-gradient(#4595e2,#0b408a)" },
  { key: "customize", label: "تخصيص البرنامج", icon: SlidersHorizontal, color: "linear-gradient(#627fa8,#243d63)" },
  { key: "about", label: "معلومات عن البرنامج", icon: Info, color: "linear-gradient(#38a7ec,#0b5eae)" },
  { key: "help", label: "المساعدة", icon: HelpCircle, color: "linear-gradient(#f0c04a,#b77c0b)" },
  { key: "exit", label: "خروج", icon: LogOut, color: "linear-gradient(#ef6565,#b51010)" },
];

const SCREEN_TITLES: Record<ScreenKey, { title: string; sub: string; icon: LucideIcon }> = {
  home: { title: "الشاشة الرئيسية", sub: "الجمال للأدوات المدرسية والمكتبية", icon: Home },
  sales: { title: "شاشة المبيعات", sub: "نقطة البيع وفواتير العملاء", icon: ShoppingCart },
  purchases: { title: "شاشة المشتريات", sub: "تسجيل فواتير الموردين وتحديث المخزون", icon: Package },
  inventory: { title: "المخازن والأصناف", sub: "إدارة الأدوات المدرسية والمكتبية", icon: Warehouse },
  labels: { title: "ملصقات الباركود", sub: "تصميم وطباعة ملصقات الأسعار والباركود", icon: BarcodeIcon },
  pricecheck: { title: "استعلام الأسعار", sub: "معرفة سعر صنف بالباركود أو الاسم — F6", icon: PackageSearch },
  reports: { title: "التقارير والإحصائيات", sub: "ملخص الأداء المالي والمخزون", icon: BarChart3 },
  customers: { title: "العملاء", sub: "بيانات المكتبات والمدارس والأرصدة", icon: Users },
  settings: { title: "الإعدادات", sub: "البيانات، تصميم الفواتير، الثيمات والتخصيص", icon: Settings },
  backup: { title: "النسخ الاحتياطي", sub: "تصدير واستعادة قاعدة البيانات", icon: Database },
  support: { title: "الدعم الفني", sub: "التواصل مع فريق الدعم", icon: Headset },
  about: { title: "معلومات عن البرنامج", sub: "الإصدار والمميزات", icon: Info },
  help: { title: "المساعدة ودليل التشغيل", sub: "الاختصارات، الاقتراحات وتجهيز ملف EXE", icon: HelpCircle },
  statements: { title: "كشف حساب العملاء", sub: "الفواتير، المتحصلات والأرصدة", icon: Wallet },
  installments: { title: "التقسيط", sub: "عملاء القسط بدون ميعاد ومتابعة دفعاتهم", icon: CreditCard },
  preview: { title: "معاينة الفواتير", sub: "معاينة التصميم النهائي قبل الطباعة", icon: FileSearch },
  customize: { title: "تخصيص البرنامج", sub: "إخفاء وإضافة وحذف الوحدات وعناصر الواجهة", icon: SlidersHorizontal },
};

function CustomIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = CUSTOM_ICONS[name] ?? Star;
  return <Icon size={size} strokeWidth={2.2} />;
}

function HomeScreen({
  onNavigate, onCustomClick, stats, settings, flags, visibleModules, customModules,
}: {
  onNavigate: (screen: TileKey) => void;
  onCustomClick: (module: CustomModule) => void;
  stats: ReportsData | null;
  settings: StoreSettings;
  flags: UiFlags;
  visibleModules: ScreenKey[];
  customModules: CustomModule[];
}) {
  const builtinTiles = TILE_DEFS.filter((tile) => tile.key === "exit" || visibleModules.includes(tile.key as ScreenKey));

  return (
    <div className="home-screen">
      <div className="hero">
        <div className="hero-speed" />
        <ShoppingCart className="hero-cart" size={98} strokeWidth={2.4} />
        <div className="hero-text">
          <div className="hero-small">برنامج</div>
          <div className="hero-big">الجمال</div>
          {flags.showHeroSlogan && <div className="hero-slogan">إدارة احترافية .. لمكتبة وأدوات مدرسية أكثر نجاحاً</div>}
        </div>
        {flags.showSeal && <div className="hero-seal"><img className="hero-seal-mark" src="/images/algamal-mark.svg" alt="" />برنامج<br />الجمال<br />الاختيار الأفضل</div>}
      </div>

      <div className="home-tiles">
        {builtinTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button key={tile.key} className="tile" onClick={() => onNavigate(tile.key)}>
              <span className="tile-icon" style={{ background: tile.color }}><Icon size={30} strokeWidth={2.2} /></span>
              <span className="tile-label">{tile.label}</span>
            </button>
          );
        })}
        {customModules.map((module) => (
          <button key={module.id} className="tile" onClick={() => onCustomClick(module)}>
            <span className="tile-icon" style={{ background: `linear-gradient(${module.color}, #173a63)` }}><CustomIcon name={module.icon} size={30} /></span>
            <span className="tile-label">{module.label}</span>
          </button>
        ))}
      </div>

      <div className="home-footer">
        <div className="footer-slogan">مع الجمال للأدوات المدرسية<br />إدارة أسهل .. ونجاح أكبر</div>
        {flags.showFooterPhone ? (
          <div className="footer-phone">
            <span className="phone-circle"><Phone size={25} fill="white" /></span>
            <a className="phone-number" href={whatsappUrl()} target="_blank" rel="noreferrer" title={`اضغط لمراسلة ${SUPPORT.designer} على واتساب`} style={{ textDecoration: "none", whiteSpace: "nowrap" }}>{SUPPORT.phone}</a>
          </div>
        ) : (
          <div className="footer-slogan" style={{ zIndex: 2, textAlign: "center" }}>كل احتياجات المدرسة<br />في مكان واحد</div>
        )}
        <div className="footer-features">
          <div><span>✔</span> سهل الاستخدام</div>
          <div><span>✔</span> دعم فني مجاني — <b>{SUPPORT.designer}</b></div>
          <div><span>✔</span> مناسب للمكتبات والأدوات المدرسية</div>
        </div>
        {flags.showHomeStats && (
          <div className="footer-badge">
            <BadgeCheck size={34} color="#d89a10" />
            <div>مبيعات اليوم<br /><b>{money(stats?.salesTotal ?? 0, settings.currency)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DesktopApp({ initialProducts, initialCustomers, initialInvoices, initialSettings, initialLicense }: Props) {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings ?? DEFAULT_SETTINGS);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [clock, setClock] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(true);
  const [exitOpen, setExitOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [customModal, setCustomModal] = useState<CustomModule | null>(null);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<number | null>(null);
  const [salesInvoiceId, setSalesInvoiceId] = useState<number | null>(null);
  const [installments, setInstallments] = useState<InstallmentsData | null>(null);
  const [localDbPath, setLocalDbPath] = useState("");
  const [license, setLicense] = useState<LicenseState | null>(initialLicense);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("المدير");
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [lastScanCode, setLastScanCode] = useState("");

  // مثال حقيقي على استخدام window.db (IPC → العملية الرئيسية → SQLite)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (typeof window === "undefined" || !window.db) return;
      void window.db.getInfo().then((result) => {
        if (active && result.ok) setLocalDbPath(result.data.path);
      }).catch(() => undefined);
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleModules = useMemo(() => parseVisibleModules(settings.visibleModules), [settings.visibleModules]);
  const customModules = useMemo(() => parseCustomModules(settings.customModules), [settings.customModules]);
  const flags = useMemo(() => parseUiFlags(settings.uiFlags), [settings.uiFlags]);
  const themeStyle = {
    ...getThemeVars(settings),
    fontFamily: fontStack(settings.appFont),
  } as CSSProperties;
  const themeKey = getThemeKey(settings.theme);

  const showToast = useCallback((message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [productData, customerData, invoiceData, settingsData, reportData, ticketData, installmentsData, licenseData] = await Promise.all([
        api<{ products: Product[] }>("/api/products"),
        api<{ customers: Customer[] }>("/api/customers"),
        api<{ invoices: Invoice[] }>("/api/invoices"),
        api<{ settings: StoreSettings }>("/api/settings"),
        api<ReportsData>("/api/reports"),
        api<{ tickets: SupportTicket[] }>("/api/tickets"),
        api<InstallmentsData>("/api/installments"),
        api<{ license: LicenseState }>("/api/license"),
      ]);
      setProducts(productData.products);
      setCustomers(customerData.customers);
      setInvoices(invoiceData.invoices);
      setSettings(settingsData.settings);
      setReports(reportData);
      setTickets(ticketData.tickets);
      setInstallments(installmentsData);
      setLicense(licenseData.license);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذر تحميل بيانات قاعدة البيانات", true);
    }
  }, [showToast]);

  useEffect(() => {
    const update = () => setClock(dateTime(new Date()));
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  // F6 = استعلام سريع عن السعر من أي شاشة (حتى أثناء تحرير فاتورة).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "F6") { event.preventDefault(); setPriceCheckOpen((value) => !value); }
      if (event.key === "F7") { event.preventDefault(); setPhoneScanOpen((value) => !value); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback((target: TileKey) => {
    if (target === "exit") { setExitOpen(true); return; }
    // استعلام السعر نافذة عائمة فوق الشاشة الحالية — لا تُغلق الفاتورة المفتوحة.
    if (target === "pricecheck") { setPriceCheckOpen(true); setMinimized(false); return; }
    if (!visibleModules.includes(target)) {
      showToast("هذه الشاشة مخفية حالياً — فعّلها من «تخصيص البرنامج»", true);
      return;
    }
    setScreen(target);
    setMinimized(false);
  }, [visibleModules, showToast]);

  const openStatement = useCallback((customerId: number | null) => {
    setStatementCustomerId(customerId);
    setScreen("statements");
    setMinimized(false);
  }, []);

  const openPreview = useCallback((invoiceId: number | null) => {
    setPreviewInvoiceId(invoiceId);
    setScreen("preview");
    setMinimized(false);
  }, []);

  // الرجوع من «معاينة الفواتير» إلى شاشة المبيعات مع نفس الفاتورة المختارة.
  const backToInvoice = useCallback((invoice: Invoice | null) => {
    setSalesInvoiceId(invoice?.id ?? null);
    setScreen(invoice && invoice.type === "purchase" ? "purchases" : "sales");
    setMinimized(false);
  }, []);

  const handleMaximize = () => {
    setMaximized((value) => !value);
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen?.().catch(() => undefined);
  };

  const handleClose = () => {
    setLocked(true);
    setExitOpen(false);
    try { window.close(); } catch { /* Browser may refuse programmatic close. */ }
  };

  const handleLogin = useCallback((name: string) => {
    setUserName(name.trim() || "المدير");
    setLoggedIn(true);
    setWelcomeVisible(true);
    setTimeout(() => setWelcomeVisible(false), 4200);
  }, []);

  const handleActivated = useCallback((next: LicenseState) => {
    setLicense(next);
    setLicenseDialogOpen(false);
    showToast("🎉 تم تفعيل النسخة الكاملة بنجاح — شكراً لثقتك في الجمال");
    void refresh();
  }, [showToast, refresh]);

  // شاشة البداية تظهر على الشاشة كاملة قبل أي شيء آخر.
  if (!loggedIn && !locked) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onExit={handleClose}
        license={license}
        defaultName="المدير"
        fontFamily={fontStack(settings.appFont)}
      />
    );
  }

  const HeadIcon = SCREEN_TITLES[screen].icon;
  const common = { onRefresh: refresh, onToast: showToast, settings };

  const renderScreen = () => {
    switch (screen) {
      case "home":
        return <HomeScreen onNavigate={navigate} onCustomClick={setCustomModal} stats={reports} settings={settings} flags={flags} visibleModules={visibleModules} customModules={customModules} />;
      case "sales":
      case "purchases":
        return (
          <PosScreen
            key={`${screen}-${salesInvoiceId ?? "new"}`}
            mode={screen === "sales" ? "sale" : "purchase"}
            products={products}
            customers={customers}
            invoices={invoices}
            uiFlags={flags}
            initialInvoiceId={salesInvoiceId}
            onNewInvoice={() => setSalesInvoiceId(null)}
            onPhoneScan={() => setPhoneScanOpen(true)}
            onPriceCheck={() => setPriceCheckOpen(true)}
            onScanned={setLastScanCode}
            {...common}
          />
        );
      case "inventory":
        return <InventoryScreen products={products} {...common} />;
      case "customers":
        return <CustomersScreen customers={customers} invoices={invoices} onOpenStatement={openStatement} {...common} />;
      case "reports":
        return <ReportsScreen reports={reports} invoices={invoices} onOpenPreview={openPreview} {...common} />;
      case "settings":
        return <SettingsScreen onNavigate={(target) => navigate(target)} {...common} />;
      case "backup":
        return <BackupScreen products={products} customers={customers} invoices={invoices} {...common} />;
      case "support":
        return <SupportScreen tickets={tickets} {...common} />;
      case "about":
        return <InfoScreen variant="about" onNavigate={navigate} />;
      case "help":
        return <InfoScreen variant="help" onNavigate={navigate} />;
      case "statements":
        return <StatementsScreen key={statementCustomerId ?? "all"} customers={customers} initialCustomerId={statementCustomerId} onNavigate={(target) => navigate(target)} {...common} />;
      case "installments":
        return <InstallmentsScreen installments={installments} customers={customers} onNavigate={(target) => navigate(target)} {...common} />;
      case "labels":
        return <LabelsScreen products={products} {...common} />;
      case "preview":
        return <InvoicePreviewScreen key={previewInvoiceId ?? "all"} invoices={invoices} customers={customers} initialInvoiceId={previewInvoiceId} onNavigate={(target) => navigate(target)} onBackToInvoice={backToInvoice} {...common} />;
      case "customize":
        return <CustomizationScreen onNavigate={(target) => navigate(target)} {...common} />;
      default:
        return null;
    }
  };

  if (locked) {
    return (
      <div className="app-root" data-theme={themeKey} style={themeStyle}>
        <div className="titlebar">
          <div className="titlebar-title"><span className="titlebar-icon"><img src="/images/algamal-mark.svg" alt="أيقونة البرنامج" /></span> {settings.storeName} - {settings.subtitle}</div>
          <div className="win-controls"><button className="win-btn close" onClick={() => setLocked(false)}><X size={13} /></button></div>
        </div>
        <div className="minimized">
          <div className="minimized-message">تم إنهاء الجلسة<br /><button className="btn blue" style={{ marginTop: 18 }} onClick={() => setLocked(false)}>العودة للبرنامج</button></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app-root ${maximized ? "maximized" : ""}`}
      data-theme={themeKey}
      data-shape={settings.buttonShape}
      data-btsize={settings.buttonSize}
      data-motion={flags.motionOff ? "off" : "on"}
      style={themeStyle}
    >
      {license && license.limited && !license.expired && (
        <div className="trial-bar">
          <BadgeCheck size={14} />
          <span>نسخة تجريبية — متبقي <b>{license.daysLeft} يوم</b> من {license.trialDays} يوم · تعرض <b>{license.trialProductLimit} صنفاً</b> فقط</span>
          <div className="spacer" />
          <button className="btn small green" onClick={() => setLicenseDialogOpen(true)}><KeyRound size={13} /> تفعيل النسخة الكاملة</button>
        </div>
      )}

      <div className="titlebar">
        <div className="titlebar-title">
          <span className="titlebar-icon"><img src="/images/algamal-mark.svg" alt="أيقونة البرنامج" /></span>
          {settings.storeName} - {settings.subtitle}
          <span style={{ color: "#6f8299", fontWeight: 400 }}> | {userName}</span>
        </div>
        <div className="win-controls">
          <button className="win-btn" title="تصغير" onClick={() => setMinimized(true)}><Minus size={14} /></button>
          <button className="win-btn" title="تكبير / استعادة" onClick={handleMaximize}><Square size={11} /></button>
          <button className="win-btn close" title="إغلاق" onClick={() => setExitOpen(true)}><X size={14} /></button>
        </div>
      </div>

      {minimized ? (
        <div className="minimized">
          <div className="minimized-message">تم تصغير البرنامج إلى شريط المهام</div>
          <div className="taskbar">
            <button onClick={() => setMinimized(false)}>الجمال للأدوات المدرسية — استعادة</button>
            <span style={{ color: "#dceaff", fontSize: 12 }}>{clock}</span>
          </div>
        </div>
      ) : (
        <div className="app-body">
          <main className="workspace">
            <div className="screen-head">
              <div className="head-right">
                <span className="head-icon"><HeadIcon size={19} /></span>
                <div>
                  <div className="head-title">{SCREEN_TITLES[screen].title}</div>
                  <div className="head-sub">{SCREEN_TITLES[screen].sub}</div>
                </div>
              </div>
              <div className="head-actions">
                {flags.showClock && <span className="head-chip"><Clock3 size={13} /> {clock || "—"}</span>}
                {flags.showDbStatus && <span className="head-chip"><Wifi size={13} /> SQLite <b>متصلة</b></span>}
                {screen !== "home" && <button className="btn small" onClick={() => navigate("home")}><ChevronLeft size={14} /> الرئيسية</button>}
                <button className="btn small blue" onClick={() => navigate("sales")}><ShoppingBasket size={14} /> مبيعات جديدة</button>
                <button className="btn small" title="استعلام سعر (F6)" onClick={() => setPriceCheckOpen(true)}><PackageSearch size={14} /> استعلام سعر <small style={{ opacity: .7 }}>F6</small></button>
                <button className="btn small" title="ربط كاميرا الموبايل (F7)" onClick={() => setPhoneScanOpen(true)}><Camera size={14} /> كاميرا</button>
                <button className="btn small" onClick={() => navigate("preview")}><FileSearch size={14} /> معاينة الفواتير</button>
                <span className="avatar" title={`المستخدم: ${userName}`}>👨‍💼</span>
              </div>
            </div>

            <div className={`work-area ${screen === "home" || screen === "sales" || screen === "purchases" ? "flush" : ""}`}>
              {renderScreen()}
            </div>
          </main>

          <aside className="sidebar">
            <div className="side-logo"><img className="side-logo-mark" src="/images/algamal-mark.svg" alt="شعار الجمال" /><strong>الجمال</strong><span>للأدوات المدرسية والمكتبية</span></div>
            {NAV_ORDER.filter((key) => visibleModules.includes(key)).map((key) => {
              const Icon = MODULE_ICONS[key];
              return <button key={key} className={`side-btn ${screen === key ? "active" : ""}`} onClick={() => navigate(key)}><span>{MODULE_LABELS[key]}</span><Icon size={22} /></button>;
            })}
            <div className="side-separator" />
            {visibleModules.includes("about") && <button className="side-btn" onClick={() => navigate("about")}><span>عن البرنامج</span><Info size={22} /></button>}
            {flags.showSidebarNote && (
              <div className="side-note">
                <b>{SUPPORT.title} · {SUPPORT.designer}</b><br />
                <a href={TEL_URL} dir="ltr" style={{ display: "inline-block", marginTop: 3, color: "#ffe68a", fontWeight: 900, textDecoration: "none" }}>{SUPPORT.phone}</a><br />
                عدد الأصناف: {products.length}<br />
                فواتير محفوظة: {invoices.length}<br />
                المبيعات: {money(num(reports?.salesTotal), settings.currency)}
              </div>
            )}
          </aside>
        </div>
      )}

      {flags.showStatusBar && (
        <div className="statusbar">
          <span className="status-item"><span className="status-dot" /><img className="app-brand-mark" src="/images/algamal-mark.svg" alt="" /> جاهز للعمل</span>
          <span className="status-item">المستخدم: {userName}</span>
          <span className="status-item">{license?.activated ? "النسخة: كاملة ✔" : "النسخة: تجريبية"}</span>
          <span className="status-item grow" title={localDbPath || undefined}>
            قاعدة بيانات SQLite محلية (algamal.db) متصلة — {settings.storeName}
            {localDbPath && <small style={{ color: "#607b9b", fontWeight: 600 }}> | {localDbPath}</small>}
          </span>
          <span className="status-item"><Save size={12} style={{ verticalAlign: "middle" }} /> الإصدار 3.0.0</span>
          {flags.showClock && <span className="status-item" dir="ltr">{clock || "--:--"}</span>}
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} onClick={() => setToast(null)}>
          {toast.error ? <X size={18} /> : <BadgeCheck size={19} />} {toast.message}
        </div>
      )}

      {exitOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 430 }}>
            <div className="modal-head"><span>تأكيد الخروج</span><button className="btn small" onClick={() => setExitOpen(false)}><X size={13} /></button></div>
            <div className="modal-body" style={{ textAlign: "center", fontSize: 15, fontWeight: 800, lineHeight: 2 }}>
              <LogOut size={42} color="#c91414" style={{ marginBottom: 6 }} />
              <div>هل تريد إغلاق برنامج الجمال؟</div>
              <div style={{ fontSize: 12, color: "#667c94", fontWeight: 500 }}>سيتم حفظ جميع الفواتير تلقائياً في قاعدة البيانات.</div>
            </div>
            <div className="modal-foot" style={{ justifyContent: "center" }}>
              <button className="btn red" onClick={handleClose}><LogOut size={14} /> نعم، إغلاق</button>
              <button className="btn" onClick={() => setExitOpen(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {customModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 500 }}>
            <div className="modal-head"><span>{customModal.label}</span><button className="btn small" onClick={() => setCustomModal(null)}><X size={13} /></button></div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <span className="custom-icon-preview" style={{ background: customModal.color }}><CustomIcon name={customModal.icon} size={20} /></span>
                <div><b style={{ fontSize: 16 }}>{customModal.label}</b><div style={{ fontSize: 11, color: "#6b7e93" }}>اختصار مخصص يفتح: {MODULE_LABELS[customModal.target]}</div></div>
              </div>
              <div className="info-box">{customModal.content || "لا يوجد محتوى إضافي لهذا الاختصار. يمكنك تعديله من شاشة تخصيص البرنامج."}</div>
            </div>
            <div className="modal-foot">
              <button className="btn blue" onClick={() => { navigate(customModal.target); setCustomModal(null); }}>فتح {MODULE_LABELS[customModal.target]}</button>
              <button className="btn" onClick={() => navigate("customize")}>تعديل الاختصارات</button>
              <button className="btn" onClick={() => setCustomModal(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {welcomeVisible && (
        <div className="welcome-toast" onClick={() => setWelcomeVisible(false)}>
          <img src="/images/algamal-mark.svg" alt="" />
          <div>
            <b>مرحباً {userName} 👋</b>
            <span>أهلاً بك في «الجمال للأدوات المدرسية» — نتمنى لك يوماً مليئاً بالبيعات الناجحة.<br />لأي مساعدة: {SUPPORT.designer} · <span dir="ltr">{SUPPORT.phone}</span></span>
          </div>
        </div>
      )}

      {priceCheckOpen && (
        <PriceCheck
          onClose={() => setPriceCheckOpen(false)}
          currency={settings.currency}
          storeName={settings.storeName}
        />
      )}
      {phoneScanOpen && (
        <PhoneScanDialog
          onClose={() => setPhoneScanOpen(false)}
          onToast={showToast}
          lastCode={lastScanCode}
        />
      )}

      {license && license.expired && (
        <LicenseGate license={license} onActivated={handleActivated} onExit={handleClose} blocking />
      )}
      {licenseDialogOpen && license && (
        <LicenseGate
          license={license}
          onActivated={handleActivated}
          onExit={handleClose}
          onClose={() => setLicenseDialogOpen(false)}
        />
      )}
    </div>
  );
}

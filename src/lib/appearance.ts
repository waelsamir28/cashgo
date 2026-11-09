import type { ScreenKey, StoreSettings } from "@/lib/types";

export type ThemeKey = "blue" | "red" | "green" | "purple" | "night";

export type ThemePreset = {
  key: ThemeKey;
  label: string;
  description: string;
  primary: string;
  dark: string;
  deep: string;
  accent: string;
  accentDark: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "blue",
    label: "أزرق كلاسيكي",
    description: "نفس طابع الشاشة الأصلية",
    primary: "#1a67bd", dark: "#0a4194", deep: "#062c6c",
    accent: "#d91414", accentDark: "#a90909",
  },
  {
    key: "red",
    label: "أحمر مميز",
    description: "هوية جريئة للمكتبات",
    primary: "#d33b32", dark: "#a51d1d", deep: "#6d0f0f",
    accent: "#0b4fa2", accentDark: "#07366f",
  },
  {
    key: "green",
    label: "أخضر زمردي",
    description: "مريح للعين في الوردية الطويلة",
    primary: "#159c67", dark: "#0b6f4b", deep: "#06432f",
    accent: "#d97706", accentDark: "#a45304",
  },
  {
    key: "purple",
    label: "بنفسجي عصري",
    description: "مظهر حديث للأدوات المدرسية",
    primary: "#7b4bc4", dark: "#5a2f9e", deep: "#36196c",
    accent: "#e11d48", accentDark: "#a30d32",
  },
  {
    key: "night",
    label: "ليلي داكن",
    description: "تقليل الإضاءة مع الحفاظ على التباين",
    primary: "#334155", dark: "#1e293b", deep: "#0f172a",
    accent: "#38bdf8", accentDark: "#0284c7",
  },
];

export function getThemeKey(value?: string): ThemeKey {
  return THEME_PRESETS.find((theme) => theme.key === value)?.key ?? "blue";
}

export function getThemePreset(value?: string): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.key === getThemeKey(value)) ?? THEME_PRESETS[0];
}

function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const factor = 1 - amount;
  const parts = [0, 2, 4].map((index) => {
    const channel = Math.round(parseInt(clean.slice(index, index + 2), 16) * factor);
    return Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0");
  });
  return `#${parts.join("")}`;
}

export function getThemeVars(settings: StoreSettings): Record<string, string> {
  const preset = getThemePreset(settings.theme);
  const primary = settings.customPrimary || preset.primary;
  const accent = settings.customAccent || preset.accent;
  return {
    "--theme-primary": primary,
    "--theme-dark": settings.customPrimary ? shade(primary, 0.25) : preset.dark,
    "--theme-deep": settings.customPrimary ? shade(primary, 0.5) : preset.deep,
    "--theme-accent": accent,
    "--theme-accent-dark": settings.customAccent ? shade(accent, 0.3) : preset.accentDark,
  };
}

export type InvoiceDesign = {
  header: string;
  subtitle: string;
  accent: string;
  tableHeader: string;
  logoUrl: string;
  showLogo: boolean;
  showBarcode: boolean;
  showTax: boolean;
  showBalance: boolean;
  paper: "A4" | "thermal";
  fontSize: number;
  footer: string;
  phone: string;
  address: string;
  taxNumber: string;
  currency: string;
  template: "classic" | "modern" | "minimal";
};

export function toBool(value: string | undefined, fallback = true): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1" || value === "on";
}

export function getInvoiceDesign(settings: StoreSettings): InvoiceDesign {
  return {
    header: settings.invoiceHeader || settings.storeName,
    subtitle: settings.invoiceSubtitle || settings.subtitle,
    accent: settings.invoiceAccent || "#0b4fa2",
    tableHeader: settings.invoiceTableHeader || "#e4f0fc",
    logoUrl: settings.invoiceLogoUrl || "",
    showLogo: toBool(settings.invoiceShowLogo),
    showBarcode: toBool(settings.invoiceShowBarcode),
    showTax: toBool(settings.invoiceShowTax),
    showBalance: toBool(settings.invoiceShowBalance),
    paper: settings.invoicePaper === "thermal" ? "thermal" : "A4",
    fontSize: Math.max(9, Math.min(18, Number(settings.invoiceFontSize) || 12)),
    footer: settings.invoiceFooter || settings.footer,
    template: settings.invoiceTemplate === "modern" || settings.invoiceTemplate === "minimal" ? settings.invoiceTemplate : "classic",
    phone: settings.phone,
    address: settings.address,
    taxNumber: settings.taxNumber,
    currency: settings.currency,
  };
}

export type UiFlags = {
  showHeroSlogan: boolean;
  showFooterPhone: boolean;
  showSeal: boolean;
  showSidebarNote: boolean;
  showStatusBar: boolean;
  showClock: boolean;
  showDbStatus: boolean;
  showProductImage: boolean;
  showQuickTotals: boolean;
  showHomeStats: boolean;
  motionOff: boolean;
  soundOn: boolean;
  productSelectSound: boolean;
};

export const DEFAULT_UI_FLAGS: UiFlags = {
  showHeroSlogan: true,
  showFooterPhone: true,
  showSeal: true,
  showSidebarNote: true,
  showStatusBar: true,
  showClock: true,
  showDbStatus: true,
  showProductImage: true,
  showQuickTotals: true,
  showHomeStats: true,
  motionOff: false,
  soundOn: true,
  productSelectSound: true,
};

export type FontOption = { key: string; label: string; family: string };

export const FONT_OPTIONS: FontOption[] = [
  { key: "", label: "Tahoma (الافتراضي)", family: 'Tahoma, "Segoe UI", Arial, sans-serif' },
  { key: "Cairo", label: "كايرو Cairo", family: '"Cairo", Tahoma, sans-serif' },
  { key: "Tajawal", label: "تجوال Tajawal", family: '"Tajawal", Tahoma, sans-serif' },
  { key: "Almarai", label: "المراي Almarai", family: '"Almarai", Tahoma, sans-serif' },
  { key: "NotoKufiArabic", label: "كويفي Noto Kufi", family: '"Noto Kufi Arabic", Tahoma, sans-serif' },
  { key: "IBMPlexSansArabic", label: "IBM Plex Arabic", family: '"IBM Plex Sans Arabic", Tahoma, sans-serif' },
];

export function fontStack(value?: string): string {
  return FONT_OPTIONS.find((font) => font.key === value)?.family ?? FONT_OPTIONS[0].family;
}

export const SHAPE_OPTIONS = [
  { key: "sharp", label: "حادة", hint: "حواف مستقيمة 0px" },
  { key: "soft", label: "ناعمة", hint: "حواف 4px (الافتراضي)" },
  { key: "round", label: "دائرية", hint: "حواف مستديرة 10px" },
];

export const SIZE_OPTIONS = [
  { key: "small", label: "صغيرة" },
  { key: "normal", label: "عادية" },
  { key: "large", label: "كبيرة" },
];

export const TEMPLATE_OPTIONS = [
  { key: "classic", label: "كلاسيكي", hint: "رأس أزرق وجدول تقليدي" },
  { key: "modern", label: "عصري", hint: "شريط ملون وبطاقات أنيقة" },
  { key: "minimal", label: "بسيط", hint: "أبيض وأسود نظيف" },
];

export const ALL_MODULES: ScreenKey[] = [
  "home", "sales", "purchases", "inventory", "labels", "pricecheck", "reports", "customers",
  "settings", "backup", "support", "about", "help", "statements", "installments", "preview", "customize",
];

export const LOCKED_MODULES: ScreenKey[] = ["home", "settings", "help", "customize"];

export const MODULE_LABELS: Record<ScreenKey, string> = {
  home: "الرئيسية",
  sales: "المبيعات",
  purchases: "المشتريات",
  inventory: "المخازن",
  labels: "ملصقات الباركود",
  pricecheck: "استعلام الأسعار",
  reports: "التقارير",
  customers: "العملاء",
  settings: "الإعدادات",
  backup: "النسخ الاحتياطي",
  support: "الدعم الفني",
  about: "معلومات عن البرنامج",
  help: "المساعدة",
  statements: "كشف حساب",
  installments: "التقسيط",
  preview: "معاينة الفواتير",
  customize: "تخصيص البرنامج",
};

export type CustomModule = {
  id: string;
  label: string;
  target: ScreenKey;
  icon: string;
  color: string;
  content: string;
};

export const CUSTOM_ICON_OPTIONS = [
  "NotebookPen", "Pencil", "BookOpen", "Boxes", "Star", "ClipboardList",
  "GraduationCap", "Printer", "Calculator", "FileText", "Tags", "Palette",
];

export function parseVisibleModules(value?: string): ScreenKey[] {
  if (!value) return [...ALL_MODULES];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [...ALL_MODULES];
    const selected = parsed.filter((item): item is ScreenKey => ALL_MODULES.includes(item as ScreenKey));
    return Array.from(new Set([...LOCKED_MODULES, ...selected]));
  } catch {
    return [...ALL_MODULES];
  }
}

export function parseCustomModules(value?: string): CustomModule[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CustomModule =>
      Boolean(item && typeof item === "object" && (item as CustomModule).label));
  } catch {
    return [];
  }
}

export function parseUiFlags(value?: string): UiFlags {
  if (!value) return { ...DEFAULT_UI_FLAGS };
  try {
    const parsed = JSON.parse(value) as Partial<UiFlags>;
    return { ...DEFAULT_UI_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_UI_FLAGS };
  }
}

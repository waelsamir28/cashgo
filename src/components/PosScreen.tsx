"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FilePlus2,
  LayoutGrid,
  PackageSearch,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  UserPlus,
  Bell,
  X,
  Eye,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { fmt, num, round, shortDate } from "@/lib/format";
import type { UiFlags } from "@/lib/appearance";
import CustomSelect from "@/components/CustomSelect";
import InvoiceSheet from "@/components/InvoiceSheet";
import type { Customer, Invoice, Product, StoreSettings } from "@/lib/types";

type Props = {
  mode: "sale" | "purchase";
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  settings: StoreSettings;
  uiFlags: UiFlags;
  initialInvoiceId?: number | null;
  onNewInvoice?: () => void;
  onPhoneScan?: () => void;
  onPriceCheck?: () => void;
  onScanned?: (code: string) => void;
  onRefresh: () => Promise<void> | void;
  onToast: (message: string, error?: boolean) => void;
};

type CartLine = {
  key: string;
  productId: number | null;
  productCode: string;
  productName: string;
  barcode: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  stock: number;
};

import type { SheetInvoice } from "@/components/InvoiceSheet";

const key = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function PosScreen({ mode, products, customers, invoices, settings, uiFlags, initialInvoiceId, onNewInvoice, onPhoneScan, onPriceCheck, onScanned, onRefresh, onToast }: Props) {
  const isSale = mode === "sale";
  const [items, setItems] = useState<CartLine[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("1001");
  const [reviewInvoice, setReviewInvoice] = useState<Invoice | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", customerType: "عادي" });
  const [localCustomer, setLocalCustomer] = useState<Customer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerCategory, setPickerCategory] = useState("الكل");

  // نغمة قصيرة جداً عند اختيار أي صنف (قائمة / باركود / الشاشة العائمة).
  const playSelectSound = useCallback(() => {
    if (!uiFlags.soundOn || !uiFlags.productSelectSound) return;
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1180, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
      setTimeout(() => void ctx.close(), 300);
    } catch {
      /* الصوت غير متاح في بعض البيئات — نتجاهل بأمان */
    }
  }, [uiFlags.soundOn, uiFlags.productSelectSound]);

  const beep = useCallback((ok: boolean) => {
    if (!uiFlags.soundOn) return;
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
      setTimeout(() => void ctx.close(), 400);
    } catch {
      /* audio not available */
    }
  }, [uiFlags.soundOn]);

  const pickerProducts = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchCategory = pickerCategory === "الكل" || product.category === pickerCategory;
      const matchQuery = !q || [product.name, product.code, product.barcode].some((value) => value.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });
  }, [products, pickerQuery, pickerCategory]);
  const [barcode, setBarcode] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [quantity, setQuantity] = useState("1");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [paymentType, setPaymentType] = useState("نقدي");
  const [discountText, setDiscountText] = useState("0");
  const [paidText, setPaidText] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeTax, setIncludeTax] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [creditMode, setCreditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [printSheet, setPrintSheet] = useState<SheetInvoice | null>(null);
  const [printBalance, setPrintBalance] = useState<number | undefined>(undefined);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // يمنع استبدال رقم الفاتورة برقم جديدة عند الرجوع من شاشة المعاينة.
  const reviewModeRef = useRef(Boolean(initialInvoiceId));

  const defaultCustomer = useMemo(
    () => customers.find((customer) => customer.name.includes("نقدي")) ?? customers[0],
    [customers],
  );

  const selectedCustomer = customers.find((customer) => customer.id === Number(customerId)) ?? localCustomer ?? defaultCustomer;

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      onToast("اكتب اسم العميل أولاً", true);
      return;
    }
    try {
      const result = await api<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: newCustomer.name, phone: newCustomer.phone, customerType: newCustomer.customerType, balance: 0 }),
      });
      setLocalCustomer(result.customer);
      setCustomerId(result.customer.id);
      setAddCustomerOpen(false);
      setNewCustomer({ name: "", phone: "", customerType: "عادي" });
      onToast(`تمت إضافة ${isSale ? "العميل" : "المورد"} ${result.customer.name} واختياره في الفاتورة`);
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر إضافة العميل", true);
    }
  };
  const categories = useMemo(() => ["الكل", ...Array.from(new Set(products.map((product) => product.category)))], [products]);

  const filteredProducts = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchCategory = category === "الكل" || product.category === category;
      const matchQuery = !query || [product.name, product.code, product.barcode, product.category].some((value) => value.toLowerCase().includes(query));
      return matchCategory && matchQuery;
    });
  }, [products, catalogQuery, category]);

  const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.price - item.discount, 0));
  const discount = round(num(discountText));
  const tax = includeTax ? round(subtotal * (num(settings.defaultTax) / 100)) : 0;
  const total = round(subtotal - discount + tax);
  const paid = creditMode ? 0 : paidText.trim() === "" ? total : round(num(paidText));
  const remaining = round(Math.max(0, total - paid));

  const fetchNextNumber = useCallback(async () => {
    if (reviewModeRef.current) return;
    try {
      const data = await api<{ invoiceNo: string }>("/api/invoices/next");
      if (reviewModeRef.current) return;
      setInvoiceNo(data.invoiceNo);
    } catch {
      if (!reviewModeRef.current) setInvoiceNo(`100${Date.now().toString().slice(-4)}`);
    }
  }, []);

  const newInvoice = useCallback(() => {
    reviewModeRef.current = false;
    setReviewInvoice(null);
    onNewInvoice?.();
    setItems([]);
    setBarcode("");
    setCatalogQuery("");
    setQuantity("1");
    setSelectedProduct(null);
    setDiscountText("0");
    setPaidText("");
    setNotes("");
    setIncludeTax(false);
    setCreditMode(false);
    setPaymentType("نقدي");
    void fetchNextNumber();
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, [fetchNextNumber, onNewInvoice]);

  // الرجوع من «معاينة الفواتير»: نُحمّل نفس الفاتورة للمراجعة داخل شاشة المبيعات.
  useEffect(() => {
    if (!initialInvoiceId) return;
    let active = true;
    api<{ invoice: Invoice }>(`/api/invoices/${initialInvoiceId}`)
      .then((data) => {
        if (!active || !data.invoice) return;
        const invoice = data.invoice;
        reviewModeRef.current = true;
        setReviewInvoice(invoice);
        setInvoiceNo(invoice.invoiceNo);
        setCustomerId(invoice.customerId ?? "");
        setPaymentType(invoice.paymentType);
        setDiscountText(String(invoice.discount));
        setPaidText(String(invoice.paid));
        setNotes(invoice.notes);
        setItems((invoice.items ?? []).map((item) => ({
          key: key(), productId: item.productId, productCode: item.productCode,
          productName: item.productName, barcode: item.barcode, unit: item.unit,
          quantity: item.quantity, price: item.price, discount: item.discount, stock: 0,
        })));
        onToast(`تم الرجوع للفاتورة رقم ${invoice.invoiceNo} — وضع المراجعة`);
      })
      .catch(() => onToast("تعذر تحميل بيانات الفاتورة", true));
    return () => { active = false; };
  }, [initialInvoiceId, onToast]);

  useEffect(() => {
    void fetchNextNumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!customerId && defaultCustomer) setCustomerId(defaultCustomer.id);
  }, [defaultCustomer, customerId]);

  const addProduct = useCallback((product: Product, qty = 1) => {
    const amount = Math.max(1, num(qty) || 1);
    setSelectedProduct(product);
    playSelectSound();
    setItems((current) => {
      const index = current.findIndex((item) => item.productId === product.id);
      if (index >= 0) {
        const copy = [...current];
        copy[index] = { ...copy[index], quantity: round(copy[index].quantity + amount) };
        return copy;
      }
      return [
        ...current,
        {
          key: key(),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          barcode: product.barcode,
          unit: product.unit,
          quantity: amount,
          price: isSale ? product.salePrice : product.purchasePrice,
          discount: 0,
          stock: product.quantity,
        },
      ];
    });
  }, [isSale, playSelectSound]);

  // استقبال الباركودات القادمة من كاميرا الموبايل عبر الواي فاي وإضافتها للفاتورة المفتوحة.
  useEffect(() => {
    if (!onScanned) return;
    let active = true;
    const poll = async () => {
      try {
        const data = await fetch("/api/scan/poll?target=pos", { cache: "no-store" }).then((r) => r.json());
        if (!active || reviewInvoice) return;
        for (const entry of (data.codes ?? []) as { code: string }[]) {
          const code = entry.code.toLowerCase();
          const product = products.find((item) =>
            item.barcode?.toLowerCase() === code || item.code?.toLowerCase() === code);
          onScanned(entry.code);
          if (product) addProduct(product, num(quantity));
          else onToast(`الباركود ${entry.code} غير موجود في الأصناف`, true);
        }
      } catch { /* الشبكة المحلية قد تنقطع لحظياً */ }
    };
    const timer = setInterval(() => { void poll(); }, 800);
    return () => { active = false; clearInterval(timer); };
  }, [products, addProduct, onScanned, onToast, reviewInvoice, quantity]);

  const handleBarcode = () => {
    const value = barcode.trim();
    if (!value) {
      searchRef.current?.focus();
      return;
    }
    const lower = value.toLowerCase();
    const exact = products.find((product) => product.barcode.toLowerCase() === lower || product.code.toLowerCase() === lower);
    if (exact) {
      addProduct(exact, num(quantity));
      setBarcode("");
      return;
    }
    const matches = products.filter((product) => product.name.toLowerCase().includes(lower));
    if (matches.length === 1) {
      addProduct(matches[0], num(quantity));
      setBarcode("");
    } else {
      setCatalogQuery(value);
      onToast(matches.length ? "تم عرض نتائج البحث — اختر الصنف من القائمة" : "لم يتم العثور على صنف مطابق", matches.length === 0);
    }
  };

  const updateLine = (lineKey: string, patch: Partial<CartLine>) => {
    setItems((current) => current.map((item) => (item.key === lineKey ? { ...item, ...patch } : item)));
  };

  const doPrint = useCallback((sheet: SheetInvoice, balance?: number) => {
    setPrintSheet(sheet);
    setPrintBalance(balance);
    setTimeout(() => {
      document.body.classList.add("print-mode");
      window.print();
      setTimeout(() => document.body.classList.remove("print-mode"), 800);
    }, 80);
  }, []);

  const buildCartSheet = useCallback((invoiceNoOverride?: string): SheetInvoice => ({
    invoiceNo: invoiceNoOverride ?? invoiceNo,
    type: mode,
    customerName: selectedCustomer?.name ?? (isSale ? "عميل نقدي" : "مورد نقدي"),
    dateText: date,
    paymentType,
    status: remaining > 0 ? "آجل" : "محفوظة",
    subtotal: round(subtotal - discount),
    discount,
    tax,
    total,
    paid,
    remaining,
    notes,
    items: items.map((item) => ({
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount,
    })),
  }), [invoiceNo, mode, selectedCustomer, isSale, date, paymentType, remaining, subtotal, discount, tax, total, paid, notes, items]);

  const handlePrintCart = useCallback(() => {
    if (items.length === 0) {
      onToast("لا توجد أصناف في الفاتورة — أضف أصنافاً أولاً ثم اطبعها", true);
      return;
    }
    doPrint(buildCartSheet(), selectedCustomer?.balance);
  }, [items.length, onToast, doPrint, buildCartSheet, selectedCustomer]);

  const handlePrintDetail = (invoice: Invoice) => {
    const owner = customers.find((customer) => customer.id === invoice.customerId)
      ?? customers.find((customer) => customer.name === invoice.customerName);
    doPrint({
      invoiceNo: invoice.invoiceNo,
      type: invoice.type === "sale" ? "sale" : "purchase",
      customerName: invoice.customerName,
      dateText: shortDate(invoice.createdAt),
      paymentType: invoice.paymentType,
      status: invoice.status,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      paid: invoice.paid,
      remaining: invoice.remaining,
      notes: invoice.notes,
      items: (invoice.items ?? []).map((item) => ({
        productName: item.productName,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
      })),
    }, owner?.balance);
  };

  const saveInvoice = useCallback(async () => {
    if (reviewInvoice) {
      onToast("هذه فاتورة محفوظة للمراجعة فقط — اضغط «جديد F2» لبدء فاتورة أخرى", true);
      return;
    }
    if (items.length === 0) {
      onToast("أضف أصنافاً إلى الفاتورة قبل الحفظ", true);
      return;
    }
    setBusy(true);
    const payload = {
      invoiceNo,
      type: mode,
      customerId: selectedCustomer?.id ?? null,
      customerName: selectedCustomer?.name ?? (isSale ? "عميل نقدي" : "مورد نقدي"),
      paymentType,
      discount,
      tax,
      paid,
      notes,
      items: items.map((item) => ({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        barcode: item.barcode,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
      })),
    };
    try {
      const result = await api<{ invoice: Invoice }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      beep(true);
      onToast(`تم حفظ الفاتورة رقم ${result.invoice.invoiceNo} بنجاح`);
      if (autoPrint) {
        setTimeout(() => doPrint(buildCartSheet(result.invoice.invoiceNo), selectedCustomer?.balance), 60);
      }
      await onRefresh();
      setItems([]);
      setSelectedProduct(null);
      setDiscountText("0");
      setPaidText("");
      setNotes("");
      setBarcode("");
      void fetchNextNumber();
    } catch (error) {
      beep(false);
      onToast(error instanceof Error ? error.message : "تعذر حفظ الفاتورة", true);
    } finally {
      setBusy(false);
    }
  }, [items, invoiceNo, mode, selectedCustomer, isSale, paymentType, discount, tax, paid, notes, onRefresh, onToast, fetchNextNumber, autoPrint, beep, buildCartSheet, doPrint, reviewInvoice]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); newInvoice(); }
      if (event.key === "F3") { event.preventDefault(); setPickerOpen((value) => !value); }
      if (event.key === "F4") { event.preventDefault(); void saveInvoice(); }
      if (event.key === "F8") { event.preventDefault(); handlePrintCart(); }
      if (event.key === "Escape" && pickerOpen) setPickerOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [newInvoice, saveInvoice, pickerOpen, handlePrintCart]);

  const modeInvoices = invoices.filter((invoice) => invoice.type === mode);

  const viewInvoiceById = async (id: number) => {
    try {
      const data = await api<{ invoice: Invoice }>(`/api/invoices/${id}`);
      setViewInvoice(data.invoice);
      setListOpen(true);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر عرض الفاتورة", true);
    }
  };

  const deleteInvoice = async (id: number) => {
    if (!window.confirm("هل تريد حذف الفاتورة وإرجاع الكميات للمخزون؟")) return;
    try {
      await api(`/api/invoices/${id}`, { method: "DELETE" });
      setViewInvoice(null);
      onToast("تم حذف الفاتورة وإرجاع الكميات للمخزون");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر حذف الفاتورة", true);
    }
  };

  const stepInvoice = (direction: number) => {
    if (modeInvoices.length === 0) return;
    const currentIndex = modeInvoices.findIndex((invoice) => invoice.invoiceNo === invoiceNo);
    const nextIndex = (currentIndex + direction + modeInvoices.length) % modeInvoices.length;
    const target = modeInvoices[nextIndex < 0 ? 0 : nextIndex];
    if (target) void viewInvoiceById(target.id);
  };

  return (
    <div className="pos-screen">
      {reviewInvoice && (
        <div className="review-banner">
          <img src="/images/algamal-mark.svg" alt="" />
          <span>
            <b>فاتورة محفوظة رقم {reviewInvoice.invoiceNo}</b> — وضع المراجعة فقط، لا يمكن إعادة حفظها لتجنّب خصم المخزون مرتين.
          </span>
          <button className="btn small green" onClick={newInvoice}><FilePlus2 size={13} /> فاتورة جديدة (F2)</button>
          <button className="btn small" onClick={() => setListOpen(true)}><Eye size={13} /> كل الفواتير</button>
        </div>
      )}
      <div className="pos-toolbar">
        <div className="pos-user">
          <span className="avatar">👨‍💼</span>
          <span>المدير<br />{settings.storeName}</span>
        </div>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Bell size={22} color="#24568c" />
          <b style={{ position: "absolute", top: -7, right: -8, background: "#e01414", color: "#fff", borderRadius: 8, fontSize: 9, padding: "1px 4px" }}>1</b>
        </span>
        <span className="toolbar-sep" />
        <button className="btn icon" title="اختيار أصناف (F3)" onClick={() => setPickerOpen(true)}><LayoutGrid size={17} /></button>
        <button className="btn icon blue" title="ربط كاميرا الموبايل بالواي فاي (F7)" onClick={onPhoneScan}><Camera size={17} /></button>
        <button className="btn icon" title="استعلام سعر صنف (F6)" onClick={onPriceCheck}><PackageSearch size={17} /></button>
        <button className="btn icon" title="طباعة الفاتورة الحالية (F8)" onClick={handlePrintCart}><Printer size={17} /></button>
        <button className="btn icon red" title="حذف الصنف المحدد أو تفريغ الفاتورة" onClick={() => selectedProduct ? setItems((current) => current.filter((item) => item.productId !== selectedProduct.id)) : setItems([])}>
          <Trash2 size={16} />
        </button>
        <span className="toolbar-sep" />
        <button className="btn icon" title="الفاتورة الأولى" onClick={() => modeInvoices[0] && void viewInvoiceById(modeInvoices[0].id)}><ChevronsRight size={17} /></button>
        <button className="btn icon" title="السابقة" onClick={() => stepInvoice(1)}><ChevronRight size={17} /></button>
        <input className="invoice-no" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} aria-label="رقم الفاتورة" />
        <button className="btn icon" title="التالية" onClick={() => stepInvoice(-1)}><ChevronLeft size={17} /></button>
        <button className="btn icon" title="الأخيرة" onClick={() => modeInvoices[modeInvoices.length - 1] && void viewInvoiceById(modeInvoices[modeInvoices.length - 1].id)}><ChevronsLeft size={17} /></button>
        <button className="btn icon" title="بحث (Ctrl+F)" onClick={() => searchRef.current?.focus()}><Search size={17} /></button>
        <button className="btn" title="فواتير محفوظة" onClick={() => setListOpen(true)}><ArrowLeft size={14} /> راجع</button>
        <div className="spacer" />
        <button className="btn tall" onClick={newInvoice}><FilePlus2 size={15} /> جديد <small style={{ opacity: .7 }}>F2</small></button>
        <button className="btn green tall" disabled={busy} onClick={() => void saveInvoice()}><Save size={18} /> {busy ? "جارٍ الحفظ..." : "حفظ"} <small style={{ opacity: .8 }}>F4</small></button>
      </div>

      <div className="pos-top">
        <div className="customer-box panel">
          <div className="cb-row cb-row-a">
            <div>
              <label className="label">الكود</label>
              <span className="field readonly field-yellow" style={{ display: "block", textAlign: "center" }}>{selectedCustomer?.code ?? "10001"}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div className="cb-head">
                <label className="label" style={{ margin: 0 }}>{isSale ? "اسم العميل" : "اسم المورد"}</label>
                <button className="btn small green" title={`إضافة ${isSale ? "عميل" : "مورد"} جديد`} onClick={() => setAddCustomerOpen(true)}><UserPlus size={13} /> إضافة</button>
              </div>
              <CustomSelect
                className="cselect-yellow"
                value={String(customerId)}
                onChange={(value) => setCustomerId(Number(value))}
                placeholder={isSale ? "اختر العميل" : "اختر المورد"}
                options={[
                  ...(localCustomer && !customers.some((customer) => customer.id === localCustomer.id)
                    ? [{ value: String(localCustomer.id), label: `${localCustomer.name} (جديد)`, hint: localCustomer.code }]
                    : []),
                  ...customers.map((customer) => ({ value: String(customer.id), label: customer.name, hint: customer.code })),
                ]}
              />
            </div>
            <div>
              <label className="label">رصيد العميل</label>
              <input className="field readonly" readOnly value={fmt(selectedCustomer?.balance ?? 0, 2)} />
            </div>
          </div>
          <div className="cb-row cb-row-b">
            <div>
              <label className="label">طريقة الدفع</label>
              <CustomSelect
                value={paymentType}
                onChange={setPaymentType}
                options={[
                  { value: "نقدي", label: "نقدي CN" },
                  { value: "آجل", label: "آجل" },
                  { value: "قسط", label: "قسط (بدون ميعاد)" },
                  { value: "شبكة", label: "شبكة / بطاقة" },
                ]}
              />
            </div>
            <div>
              <label className="label">التاريخ</label>
              <input type="date" className="field" value={date} onChange={(event) => setDate(event.target.value)} dir="ltr" />
            </div>
            <div className="cb-count">
              <label className="label">فاتورة رقم</label>
              <span className="cb-count-value">{modeInvoices.length + 1}</span>
            </div>
          </div>
        </div>

        <div className="toggles-box panel">
          <div className="quick-amounts" style={{ display: uiFlags.showQuickTotals ? undefined : "none" }}>
            <div className="qa"><small>الإجمالي</small><b>{fmt(subtotal, 2)}</b></div>
            <div className="qa"><small>الخصم</small><b>{fmt(discount, 2)}</b></div>
            <div className="qa"><small>الضريبة</small><b>{fmt(tax, 2)}</b></div>
            <div className="qa qa-total"><small>الصافي</small><b>{fmt(total, 2)}</b></div>
          </div>
          <div className="toggle-grid">
            <div className="toggle-item"><span>بيع آجل</span><button className={`switch ${creditMode ? "on" : ""}`} onClick={() => { setCreditMode(!creditMode); setPaymentType(creditMode ? "نقدي" : "آجل"); }} aria-label="أجل" /></div>
            <div className="toggle-item"><span>تطبيق الضريبة</span><button className={`switch ${includeTax ? "on" : ""}`} onClick={() => setIncludeTax(!includeTax)} aria-label="ضريبة" /></div>
            <div className="toggle-item"><span>صورة الصنف</span><button className={`switch ${showImage ? "on" : ""}`} onClick={() => setShowImage(!showImage)} aria-label="صورة الصنف" /></div>
            <div className="toggle-item"><span>طباعة تلقائية</span><button className={`switch ${autoPrint ? "on" : ""}`} onClick={() => setAutoPrint(!autoPrint)} aria-label="طباعة تلقائية" /></div>
          </div>
          <input className="field" placeholder="ملاحظات الفاتورة..." value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>

      <div className="pos-entry">
        <div className="pe-2">
          <label className="label">كود الصنف / الباركود</label>
          <input
            ref={barcodeRef}
            className="accent-input"
            value={barcode}
            placeholder="امسح الباركود أو اكتب الكود ثم Enter"
            onChange={(event) => setBarcode(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") handleBarcode(); }}
          />
        </div>
        <div className="pe-2"><label className="label">اسم الصنف</label><input className="readonly" readOnly value={selectedProduct?.name ?? ""} /></div>
        <div><label className="label">السعر</label><input className="readonly" readOnly value={selectedProduct ? fmt(isSale ? selectedProduct.salePrice : selectedProduct.purchasePrice) : "0.000"} /></div>
        <div className="pe-1"><label className="label">الكمية</label><input value={quantity} onChange={(event) => setQuantity(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleBarcode(); }} /></div>
        <div className="pe-1"><label className="label">الوحدة</label><input className="readonly" readOnly value={selectedProduct?.unit ?? ""} /></div>
        <div>
          <label className="label">فلترة بالمجموعة</label>
          <CustomSelect
            value={category}
            onChange={setCategory}
            options={categories.map((item) => ({ value: item, label: item === "الكل" ? "كل المجموعات" : item }))}
          />
        </div>
        <div className="pe-1"><label className="label">القيمة</label><div className="blue-total">{fmt(total)}</div></div>
      </div>

      <div className="pos-middle" style={{ gridTemplateColumns: uiFlags.showProductImage ? undefined : "1fr" }}>
        <div className="pos-catalog panel">
          <div className="catalog-search">
            <PackageSearch size={18} color="#0b59a8" />
            <input ref={searchRef} placeholder="بحث باسم الصنف / الكود / الباركود" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} />
            <span className="head-chip">عدد الأصناف: {filteredProducts.length}</span>
            <button className="btn small blue" onClick={handleBarcode}><Search size={13} /> بحث</button>
          </div>
          <div className="scroll-table">
            <table className="win-table">
              <thead><tr><th>الكود</th><th>اسم الصنف</th><th>السعر</th><th>الكمية</th><th>الوحدة</th><th>الباركود</th></tr></thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={selectedProduct?.id === product.id ? "selected" : product.quantity <= product.minQuantity ? "alert" : ""} onClick={() => addProduct(product, 1)} onDoubleClick={() => addProduct(product, num(quantity))}>
                    <td>{product.code}</td><td className="right">{product.name}</td>
                    <td>{fmt(isSale ? product.salePrice : product.purchasePrice, 2)}</td>
                    <td style={{ color: product.quantity <= product.minQuantity ? "#c00" : undefined }}>{fmt(product.quantity, 0)}</td>
                    <td>{product.unit}</td><td dir="ltr">{product.barcode || "N/A"}</td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && <tr><td colSpan={6} className="empty-row">لا توجد أصناف مطابقة</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pos-preview panel" style={{ display: uiFlags.showProductImage ? undefined : "none" }}>
          <div className="panel-head"><span>صورة الصنف</span><span className="head-chip">{selectedProduct?.code ?? "—"}</span></div>
          <div className={`preview-stage ${selectedProduct && showImage ? "selected" : ""}`}>
            {selectedProduct && showImage ? (
              <div>
                <span className="big-icon">📦</span>
                {selectedProduct.name}
                <div>السعر: {fmt(isSale ? selectedProduct.salePrice : selectedProduct.purchasePrice)} {settings.currency}</div>
                <div className="price">المتوفر: {fmt(selectedProduct.quantity, 0)} {selectedProduct.unit}</div>
              </div>
            ) : "صورة الصنف"}
          </div>
        </div>
      </div>

      <div className="pos-items panel">
        <div className="panel-head">
          <span>أصناف {isSale ? "فاتورة المبيعات" : "فاتورة المشتريات"} — {items.length} صنف</span>
          <span className="head-chip">اضغط على أي صنف في القائمة لإضافته — F2 جديد / F4 حفظ / F8 طباعة</span>
        </div>
        <div className="scroll-table">
          <table className="win-table pos-cart">
            <thead><tr><th className="c-idx">م</th><th className="c-code">الكود</th><th>اسم الصنف</th><th className="c-unit">الوحدة</th><th className="c-qty">الكمية</th><th className="c-price">السعر</th><th className="c-disc">الخصم</th><th className="c-val">القيمة</th><th className="c-del">حذف</th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.key} className={selectedProduct?.id === item.productId ? "selected" : ""}>
                  <td>{index + 1}</td><td>{item.productCode}</td><td className="right">{item.productName}</td><td>{item.unit}</td>
                  <td><input type="number" min="0" step="0.001" value={item.quantity} onChange={(event) => updateLine(item.key, { quantity: Math.max(0, num(event.target.value)) })} /></td>
                  <td><input type="number" min="0" step="0.001" value={item.price} onChange={(event) => updateLine(item.key, { price: Math.max(0, num(event.target.value)) })} /></td>
                  <td><input type="number" min="0" step="0.001" value={item.discount} onChange={(event) => updateLine(item.key, { discount: Math.max(0, num(event.target.value)) })} /></td>
                  <td><b>{fmt(item.quantity * item.price - item.discount)}</b></td>
                  <td><button className="btn small red" onClick={() => setItems((current) => current.filter((line) => line.key !== item.key))}><X size={12} /></button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={9} className="empty-row">لا توجد أصناف في الفاتورة — امسح باركود الصنف أو اختره من القائمة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pos-totals">
        <div className="total-cell grand-total">الإجمالي النهائي<b>{fmt(total)}</b></div>
        <div className="total-cell">إجمالي الأصناف<b>{fmt(subtotal)}</b></div>
        <div className="total-cell">الخصم<input value={discountText} onChange={(event) => setDiscountText(event.target.value)} /></div>
        <div className="total-cell">الضريبة<b>{fmt(tax)}</b></div>
        <div className="total-cell">الصافي<b>{fmt(total)}</b></div>
        <div className="total-cell">المدفوع<input value={creditMode ? "0" : paidText} onChange={(event) => setPaidText(event.target.value)} placeholder={fmt(total)} disabled={creditMode} /></div>
        <div className="total-cell">الباقي / الآجل<b>{fmt(remaining)}</b></div>
      </div>

      {listOpen && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <div className="modal-head">
              <span>{isSale ? "فواتير المبيعات السابقة" : "فواتير المشتريات السابقة"}</span>
              <button className="btn small" onClick={() => { setListOpen(false); setViewInvoice(null); }}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="table-wrap" style={{ maxHeight: 250 }}>
                <table className="win-table">
                  <thead><tr><th>رقم الفاتورة</th><th>العميل / المورد</th><th>التاريخ</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th><th>إجراء</th></tr></thead>
                  <tbody>
                    {modeInvoices.map((invoice) => (
                      <tr key={invoice.id} className={viewInvoice?.id === invoice.id ? "selected" : ""}>
                        <td>{invoice.invoiceNo}</td><td>{invoice.customerName}</td><td>{shortDate(invoice.createdAt)}</td>
                        <td>{fmt(invoice.total)}</td><td>{invoice.paymentType}</td><td>{invoice.status}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn small blue" onClick={() => void viewInvoiceById(invoice.id)}><Eye size={12} /> عرض</button>{" "}
                          <button className="btn small red" onClick={() => void deleteInvoice(invoice.id)}><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                    {modeInvoices.length === 0 && <tr><td colSpan={7} className="empty-row">لا توجد فواتير محفوظة بعد</td></tr>}
                  </tbody>
                </table>
              </div>
              {viewInvoice && (
                <div className="panel" style={{ marginTop: 12 }}>
                  <div className="panel-head"><span>تفاصيل الفاتورة {viewInvoice.invoiceNo}</span><span>{shortDate(viewInvoice.createdAt)}</span></div>
                  <div className="panel-body">
                    <table className="win-table">
                      <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>القيمة</th></tr></thead>
                      <tbody>
                        {(viewInvoice.items ?? []).map((item) => (
                          <tr key={item.id}><td className="right">{item.productName}</td><td>{fmt(item.quantity, 0)}</td><td>{fmt(item.price)}</td><td>{fmt(item.total)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", gap: 15, marginTop: 10, fontWeight: 900, color: "#0b4b96" }}>
                      <span>الإجمالي: {fmt(viewInvoice.subtotal)}</span><span>الخصم: {fmt(viewInvoice.discount)}</span>
                      <span>الضريبة: {fmt(viewInvoice.tax)}</span><span>الصافي: {fmt(viewInvoice.total)}</span>
                      <button className="btn small green" onClick={() => viewInvoice && handlePrintDetail(viewInvoice)}><Printer size={13} /> طباعة</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot"><button className="btn" onClick={() => { setListOpen(false); setViewInvoice(null); }}>إغلاق</button></div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="picker-overlay" onClick={() => setPickerOpen(false)}>
          <div className="picker-panel" onClick={(event) => event.stopPropagation()}>
            <div className="picker-head">
              <span><LayoutGrid size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} /> اختيار الأصناف — اضغط ضغطين على أي صنف لإضافته إلى الفاتورة</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="hint">F3 فتح/إغلاق · Esc إغلاق · تفضل الشاشة مفتوحة لاختيار أصناف أخرى</span>
                <button className="btn small" onClick={() => setPickerOpen(false)}><X size={13} /> إغلاق</button>
              </span>
            </div>
            <div className="picker-toolbar">
              <Search size={15} />
              <input
                placeholder="بحث بالاسم / الكود / الباركود — Enter لإضافة أول نتيجة"
                autoFocus
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && pickerProducts.length > 0) {
                    addProduct(pickerProducts[0], num(quantity));
                  }
                }}
                style={{ flex: 1 }}
              />
              <CustomSelect
                value={pickerCategory}
                onChange={setPickerCategory}
                options={categories.map((item) => ({ value: item, label: item === "الكل" ? "كل المجموعات" : item }))}
              />
              <span style={{ flex: "0 1 220px" }} />
              <span className="head-chip">{pickerProducts.length} صنف</span>
            </div>
            <div className="picker-table-wrap">
              <table className="win-table">
                <thead><tr><th>الكود</th><th>اسم الصنف</th><th>المجموعة</th><th>السعر</th><th>الكمية بالمخزن</th><th>الباركود</th><th>إضافة</th></tr></thead>
                <tbody>
                  {pickerProducts.slice(0, 120).map((product) => (
                    <tr key={product.id} className="pick-row" onDoubleClick={() => addProduct(product, num(quantity))}>
                      <td>{product.code}</td>
                      <td className="right"><b>{product.name}</b></td>
                      <td>{product.category}</td>
                      <td>{fmt(isSale ? product.salePrice : product.purchasePrice, 2)}</td>
                      <td style={{ color: product.quantity <= product.minQuantity ? "#c00" : undefined }}>{fmt(product.quantity, 0)}</td>
                      <td dir="ltr">{product.barcode || "N/A"}</td>
                      <td><button className="btn small blue" onClick={() => addProduct(product, num(quantity))}><Plus size={12} /> إضافة</button></td>
                    </tr>
                  ))}
                  {pickerProducts.length === 0 && <tr><td colSpan={7} className="empty-row">لا توجد أصناف مطابقة</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {addCustomerOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 430 }}>
            <div className="modal-head"><span>إضافة {isSale ? "عميل" : "مورد"} جديد</span><button className="btn small" onClick={() => setAddCustomerOpen(false)}><X size={14} /></button></div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div><label className="label">الاسم *</label><input className="field field-yellow" style={{ width: "100%" }} value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} placeholder={isSale ? "اسم العميل" : "اسم المورد"} /></div>
                <div><label className="label">رقم الهاتف</label><input className="field" style={{ width: "100%" }} dir="ltr" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} /></div>
                <div><label className="label">النوع</label><select className="field" style={{ width: "100%" }} value={newCustomer.customerType} onChange={(event) => setNewCustomer({ ...newCustomer, customerType: event.target.value })}><option>عادي</option><option>جملة</option><option>مدرسة</option><option>مورد</option></select></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn green" onClick={() => void saveNewCustomer()}><UserPlus size={15} /> حفظ واختيار في الفاتورة</button>
              <button className="btn" onClick={() => setAddCustomerOpen(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {printSheet && (
        <div className="pos-print-area">
          <InvoiceSheet
            settings={settings}
            customerBalance={printBalance}
            invoice={printSheet}
          />
        </div>
      )}
    </div>
  );
}

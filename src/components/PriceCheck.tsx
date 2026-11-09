"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Barcode as BarcodeIcon, ExternalLink, Monitor, PackageSearch, Search, X } from "lucide-react";
import { fmt } from "@/lib/format";
import Barcode from "@/components/Barcode";

type Product = {
  id: number; code: string; barcode: string; name: string; category: string;
  unit: string; salePrice: number; purchasePrice: number; quantity: number;
};

type Props = {
  onClose: () => void;
  currency: string;
  storeName: string;
};

export default function PriceCheck({ onClose, currency, storeName }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const search = useCallback(async (value: string) => {
    if (!value.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await fetch(`/api/price?q=${encodeURIComponent(value)}`).then((r) => r.json());
      setResults(data.products ?? []);
      setSelected(data.exact ?? data.products?.[0] ?? null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void search(query); }, 220);
    return () => clearTimeout(timer);
  }, [query, search]);

  // استقبال باركود الموبايل الموجّه لشاشة الأسعار (target=price)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const data = await fetch("/api/scan/poll?target=price").then((r) => r.json());
        const codes = data.codes ?? [];
        if (codes.length) {
          const code = codes[codes.length - 1].code;
          setQuery(code);
          void search(code);
        }
      } catch { /* تجاهل */ }
    }, 900);
    return () => clearInterval(timer);
  }, [search]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <div className="price-modal">
        <div className="price-head">
          <span className="price-head-icon"><PackageSearch size={20} /></span>
          <div><b>استعلام سريع عن سعر صنف</b><small>F6 — تفتح فوق أي شاشة دون إغلاق الفاتورة · بالباركود / الكود / الاسم</small></div>
          <div style={{ flex: 1 }} />
          <button className="btn small blue" onClick={() => window.open("/price-check?display=1", "_blank")}><Monitor size={14} /> عرض على شاشة العملاء</button>
          <button className="btn small" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="price-body">
          <div className="price-search">
            <Search size={20} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="امسح الباركود أو اكتب اسم الصنف / الكود…"
            />
            {loading && <span className="price-loading">جارٍ البحث…</span>}
          </div>

          <div className="price-content">
            <div className="price-result-card">
              {selected ? (
                <>
                  <div className="pr-kicker">{selected.category}</div>
                  <div className="pr-name">{selected.name}</div>
                  <div className="pr-price">{fmt(selected.salePrice, 2)} <small>{currency}</small></div>
                  <div className="pr-meta">
                    <span>الكود: <b dir="ltr">{selected.code}</b></span>
                    <span>الوحدة: <b>{selected.unit}</b></span>
                    <span>المتوفر: <b>{fmt(selected.quantity, 0)}</b></span>
                  </div>
                  <div className="pr-barcode"><Barcode value={selected.barcode || selected.code} width={230} height={44} fontSize={11} /></div>
                </>
              ) : (
                <div className="pr-empty">
                  <BarcodeIcon size={54} />
                  <b>وجّه قارئ الباركود أو اكتب اسم الصنف</b>
                  <span>سيظهر السعر هنا فوراً بشكل واضح للعميل</span>
                </div>
              )}
            </div>

            <div className="price-list">
              <div className="panel-head"><span>نتائج البحث</span><span className="head-chip">{results.length}</span></div>
              <div className="price-list-scroll">
                {results.map((product) => (
                  <button key={product.id} className={`price-row ${selected?.id === product.id ? "active" : ""}`} onClick={() => setSelected(product)}>
                    <span className="right"><b>{product.name}</b><small>{product.category} · {product.code}</small></span>
                    <span className="price-row-price">{fmt(product.salePrice, 2)} {currency}</span>
                  </button>
                ))}
                {!loading && query && results.length === 0 && <div className="empty-row">لا يوجد صنف مطابق</div>}
                {!query && <div className="empty-row">ابدأ بالبحث عن صنف</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="price-foot">
          <span>{storeName} · الأسعار شاملة المتاح في المخزون</span>
          <button className="btn small green" onClick={() => window.open("/price-check?display=1", "_blank")}><ExternalLink size={13} /> شاشة العملاء</button>
        </div>
      </div>
    </div>
  );
}

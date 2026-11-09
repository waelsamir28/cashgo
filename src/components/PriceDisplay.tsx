"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { Barcode as BarcodeIcon, PackageSearch } from "lucide-react";
import { fmt } from "@/lib/format";
import Barcode from "@/components/Barcode";
import { SUPPORT } from "@/lib/support";

type Product = {
  id: number; code: string; barcode: string; name: string;
  category: string; unit: string; salePrice: number; quantity: number;
};

export default function PriceDisplay() {
  const [display, setDisplay] = useState(false);
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [clock, setClock] = useState("");
  const [storeName, setStoreName] = useState("الجمال للأدوات المدرسية");
  const [currency, setCurrency] = useState("ج.م");

  useEffect(() => {
    let clockTimer: ReturnType<typeof setInterval> | null = null;
    const boot = setTimeout(() => {
      setDisplay(new URLSearchParams(window.location.search).get("display") === "1");
      const tick = () => setClock(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
      tick();
      clockTimer = setInterval(tick, 30000);
      void fetch("/api/settings").then((r) => r.json()).then((d) => {
        if (d.settings) { setStoreName(d.settings.storeName); setCurrency(d.settings.currency); }
      }).catch(() => undefined);
    }, 0);
    return () => { clearTimeout(boot); if (clockTimer) clearInterval(clockTimer); };
  }, []);

  const lookup = useCallback(async (value: string) => {
    if (!value.trim()) return;
    try {
      const data = await fetch(`/api/price?q=${encodeURIComponent(value)}`).then((r) => r.json());
      setProduct(data.exact ?? data.products?.[0] ?? null);
    } catch { /* تجاهل */ }
  }, []);

  // الباركود القادم من موبايل الزبون/الموظف (target=display أو target=price)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        for (const target of ["display", "price"]) {
          const data = await fetch(`/api/scan/poll?target=${target}`).then((r) => r.json());
          const codes = data.codes ?? [];
          if (codes.length) {
            const code = codes[codes.length - 1].code;
            setQuery(code);
            void lookup(code);
          }
        }
      } catch { /* تجاهل */ }
    }, 800);
    return () => clearInterval(timer);
  }, [lookup]);

  return (
    <div className={`pd-screen ${display ? "pd-display" : ""}`}>
      <header className="pd-head">
        <img src="/images/algamal-mark.svg" alt="" />
        <div><b>{storeName}</b><small>استعلام عن الأسعار بالباركود</small></div>
        <span className="pd-clock">{clock}</span>
      </header>

      {!display && (
        <div className="pd-search">
          <PackageSearch size={22} />
          <input value={query} dir="auto" placeholder="امسح الباركود أو اكتب اسم الصنف / الكود" onChange={(event) => { setQuery(event.target.value); void lookup(event.target.value); }} />
        </div>
      )}

      <main className="pd-main">
        {product ? (
          <>
            <div className="pd-category">{product.category}</div>
            <h1 className="pd-name">{product.name}</h1>
            <div className="pd-price">{fmt(product.salePrice, 2)} <span>{currency}</span></div>
            <div className="pd-meta">
              <span>الوحدة: {product.unit}</span>
              <span>الكود: <b dir="ltr">{product.code}</b></span>
              <span>متوفر: {fmt(product.quantity, 0)}</span>
            </div>
            <div className="pd-barcode"><Barcode value={product.barcode || product.code} width={300} height={54} fontSize={13} /></div>
          </>
        ) : (
          <div className="pd-idle">
            <BarcodeIcon size={86} />
            <h2>أهلاً بك 👋</h2>
            <p>امسح باركود الصنف أو اكتب اسمه ليظهر السعر فوراً</p>
          </div>
        )}
      </main>

      <footer className="pd-foot">
        <span>أسعارنا واضحة دائماً · شكراً لزيارتكم</span>
        <span>الدعم: {SUPPORT.designer} · <b dir="ltr">{SUPPORT.phone}</b></span>
      </footer>
    </div>
  );
}

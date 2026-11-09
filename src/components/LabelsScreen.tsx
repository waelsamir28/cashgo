"use client";

import { useMemo, useState } from "react";
import { Barcode as BarcodeIcon, LayoutTemplate, Plus, Printer, RefreshCw, Search, Trash2, X } from "lucide-react";
import { fmt } from "@/lib/format";
import Barcode from "@/components/Barcode";
import type { Product, StoreSettings } from "@/lib/types";

type Props = {
  products: Product[];
  settings: StoreSettings;
  onToast: (message: string, error?: boolean) => void;
};

type BatchItem = { product: Product; qty: number };

const SIZES = [
  { key: "s30", label: "صغير 30 × 20 مم", w: 30, h: 20, px: 108 },
  { key: "s40", label: "متوسط 40 × 25 مم", w: 40, h: 25, px: 132 },
  { key: "s50", label: "كبير 50 × 30 مم", w: 50, h: 30, px: 158 },
  { key: "s60", label: "خارجي 60 × 40 مم", w: 60, h: 40, px: 182 },
];

export default function LabelsScreen({ products, settings, onToast }: Props) {
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [size, setSize] = useState("s40");
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [fontScale, setFontScale] = useState("normal");

  const sizeInfo = SIZES.find((item) => item.key === size) ?? SIZES[1];
  const totalLabels = batch.reduce((sum, item) => sum + item.qty, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => !q || [product.name, product.code, product.barcode].some((value) => value.toLowerCase().includes(q)));
  }, [products, query]);

  const addToBatch = (product: Product) => {
    setBatch((current) => {
      const index = current.findIndex((item) => item.product.id === product.id);
      if (index >= 0) {
        const copy = [...current];
        copy[index] = { ...copy[index], qty: copy[index].qty + 1 };
        return copy;
      }
      return [...current, { product, qty: 1 }];
    });
  };

  const cells = useMemo(() => {
    const result: Product[] = [];
    for (const item of batch) {
      for (let i = 0; i < item.qty; i++) result.push(item.product);
    }
    return result.slice(0, 200);
  }, [batch]);

  const nameFont = fontScale === "small" ? 9 : fontScale === "large" ? 14 : 11;
  const priceFont = fontScale === "small" ? 10 : fontScale === "large" ? 16 : 12;

  const print = () => {
    if (batch.length === 0) {
      onToast("أضف أصنافاً إلى مجموعة الملصقات أولاً", true);
      return;
    }
    document.body.classList.add("print-mode");
    window.print();
    setTimeout(() => document.body.classList.remove("print-mode"), 800);
    onToast(`جاري إرسال ${totalLabels} ملصق إلى الطابعة`);
  };

  return (
    <div>
      <h2 className="page-title"><BarcodeIcon size={20} style={{ verticalAlign: "middle", marginLeft: 6 }} /> صناعة ملصقات الباركود</h2>
      <p className="page-desc">اختر الأصناف وحدد كمية الملصقات، راجع المعاينة المباشرة ثم اطبع — الباركود EAN-13 قابل للمسح حقيقياً.</p>

      <div className="statement-layout">
        <div className="label-side">
          <div className="panel">
            <div className="panel-head"><span>اختيار الأصناف</span><span className="head-chip">{filtered.length}</span></div>
            <div className="panel-body" style={{ padding: 8 }}>
              <div className="field-row" style={{ marginBottom: 8 }}>
                <Search size={15} />
                <input placeholder="اسم / كود / باركود" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="picker-table-wrap" style={{ maxHeight: 210 }}>
              <table className="win-table">
                <thead><tr><th>الصنف</th><th>السعر</th><th>كمية</th></tr></thead>
                <tbody>
                  {filtered.slice(0, 40).map((product) => (
                    <tr key={product.id} className="pick-row" onDoubleClick={() => addToBatch(product)}>
                      <td className="right">{product.name}</td>
                      <td>{fmt(product.salePrice, 2)}</td>
                      <td><button className="btn small blue" onClick={() => addToBatch(product)}><Plus size={12} /> إضافة</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span>مجموعة الطباعة</span>
              <span className="head-chip">{totalLabels} ملصق</span>
            </div>
            <div className="panel-body" style={{ padding: 8 }}>
              {batch.map((item) => (
                <div key={item.product.id} className="custom-module-row" style={{ marginBottom: 5 }}>
                  <span style={{ flex: 1 }}><b>{item.product.name}</b><br /><small dir="ltr">{item.product.barcode || item.product.code}</small></span>
                  <input
                    type="number" min="1" max="200"
                    className="field"
                    style={{ width: 64, textAlign: "center" }}
                    value={item.qty}
                    onChange={(event) => {
                      const qty = Math.max(1, Math.min(200, Number(event.target.value) || 1));
                      setBatch((current) => current.map((row) => (row.product.id === item.product.id ? { ...row, qty } : row)));
                    }}
                  />
                  <button className="btn small red" onClick={() => setBatch((current) => current.filter((row) => row.product.id !== item.product.id))}><X size={12} /></button>
                </div>
              ))}
              {batch.length === 0 && <div className="empty-row">اضغط «إضافة» أو ضغطين على صنف لإدراجه في الطباعة</div>}
              {batch.length > 0 && <button className="btn small" style={{ width: "100%", marginTop: 6 }} onClick={() => setBatch([])}><Trash2 size={12} /> تفريغ المجموعة</button>}
            </div>
          </div>
        </div>

        <div>
          <div className="label-actions">
            <div className="panel" style={{ marginBottom: 10 }}>
              <div className="panel-head"><span>إعدادات الملصق</span><LayoutTemplate size={16} /></div>
              <div className="panel-body">
                <div className="form-grid three">
                  <div>
                    <label className="label">حجم الملصق</label>
                    <select className="field" style={{ width: "100%" }} value={size} onChange={(event) => setSize(event.target.value)}>
                      {SIZES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">حجم الخط</label>
                    <select className="field" style={{ width: "100%" }} value={fontScale} onChange={(event) => setFontScale(event.target.value)}>
                      <option value="small">صغير</option><option value="normal">عادي</option><option value="large">كبير</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">عناصر الملصق</label>
                    <div style={{ display: "flex", gap: 10, fontSize: 11, fontWeight: 800, alignItems: "end", paddingBottom: 4 }}>
                      <label><input type="checkbox" checked={showName} onChange={() => setShowName(!showName)} style={{ minHeight: 0, verticalAlign: "middle", marginLeft: 4 }} />اسم</label>
                      <label><input type="checkbox" checked={showPrice} onChange={() => setShowPrice(!showPrice)} style={{ minHeight: 0, verticalAlign: "middle", marginLeft: 4 }} />سعر</label>
                      <label><input type="checkbox" checked={showCode} onChange={() => setShowCode(!showCode)} style={{ minHeight: 0, verticalAlign: "middle", marginLeft: 4 }} />كود</label>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 11, alignItems: "center" }}>
                  <button className="btn green tall" onClick={print}><Printer size={16} /> طباعة {totalLabels > 0 ? `${totalLabels} ملصق` : "الملصقات"}</button>
                  <span className="head-chip">معاينة: {Math.min(cells.length, 200)} ملصق (حد المعاينة 200)</span>
                  <button className="btn small" onClick={() => { setQuery(""); }}><RefreshCw size={13} /> تحديث القائمة</button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><span>معاينة الملصقات</span><span className="head-chip">{sizeInfo.label}</span></div>
              <div className="panel-body">
                <div className="label-sheet label-printable">
                  <div className="label-cells">
                    {cells.map((product, index) => (
                      <div key={`${product.id}-${index}`} className="label-cell" style={{ width: `${sizeInfo.w}mm`, height: `${sizeInfo.h}mm` }}>
                        <Barcode value={product.barcode || product.code} width={sizeInfo.px} height={Math.max(14, sizeInfo.h * 0.42)} showText={false} />
                        {showName && <div className="l-name" style={{ fontSize: nameFont }}>{product.name}</div>}
                        {showPrice && <div className="l-price" style={{ fontSize: priceFont }}>{fmt(product.salePrice, 2)} {settings.currency}</div>}
                        {showCode && <div className="l-code">{product.code}</div>}
                      </div>
                    ))}
                  </div>
                  {cells.length === 0 && <div className="empty-row">لا توجد ملصقات بعد — أضف أصنافاً من القائمة الجانبية</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

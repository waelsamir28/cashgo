"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FolderPlus, Layers, Pencil, PackagePlus, Save, Search, Tags, Trash2, Warehouse } from "lucide-react";
import { api, downloadFile } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import type { CategoryInfo, Product, StoreSettings } from "@/lib/types";

type Props = {
  products: Product[];
  settings: StoreSettings;
  onRefresh: () => Promise<void> | void;
  onToast: (message: string, error?: boolean) => void;
};

type Form = {
  id: number | null;
  code: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  quantity: string;
  minQuantity: string;
  taxRate: string;
  active: boolean;
};

const emptyForm: Form = {
  id: null, code: "", barcode: "", name: "", category: "عام", unit: "قطعة",
  purchasePrice: "0", salePrice: "0", quantity: "0", minQuantity: "5", taxRate: "0", active: true,
};

export default function InventoryScreen({ products, settings, onRefresh, onToast }: Props) {
  const [tab, setTab] = useState<"products" | "groups">("products");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<CategoryInfo[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [editingGroup, setEditingGroup] = useState<{ name: string; newName: string } | null>(null);

  const categories = useMemo(() => ["الكل", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filtered = products.filter((product) => {
    const matchCategory = category === "الكل" || product.category === category;
    const q = query.trim().toLowerCase();
    return matchCategory && (!q || [product.name, product.code, product.barcode].some((value) => value.toLowerCase().includes(q)));
  });

  const loadGroups = useCallback(async () => {
    try {
      const data = await api<{ categories: CategoryInfo[] }>("/api/categories");
      setGroups(data.categories);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر تحميل المجموعات", true);
    }
  }, [onToast]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadGroups(); }, 0);
    return () => clearTimeout(timer);
  }, [loadGroups]);

  const select = (product: Product) => {
    setTab("products");
    setForm({
      id: product.id, code: product.code, barcode: product.barcode, name: product.name,
      category: product.category, unit: product.unit, purchasePrice: String(product.purchasePrice),
      salePrice: String(product.salePrice), quantity: String(product.quantity),
      minQuantity: String(product.minQuantity), taxRate: String(product.taxRate), active: product.active,
    });
  };

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    if (!form.name.trim()) { onToast("اسم الصنف مطلوب", true); return; }
    setBusy(true);
    try {
      await api("/api/products", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          purchasePrice: Number(form.purchasePrice) || 0,
          salePrice: Number(form.salePrice) || 0,
          quantity: Number(form.quantity) || 0,
          minQuantity: Number(form.minQuantity) || 0,
          taxRate: Number(form.taxRate) || 0,
        }),
      });
      onToast(form.id ? "تم تعديل بيانات الصنف" : "تمت إضافة الصنف الجديد");
      setForm(emptyForm);
      await onRefresh();
      await loadGroups();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر حفظ الصنف", true);
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!form.id || !window.confirm("هل تريد حذف هذا الصنف نهائياً؟")) return;
    try {
      await api(`/api/products?id=${form.id}`, { method: "DELETE" });
      onToast("تم حذف الصنف");
      setForm(emptyForm);
      await onRefresh();
      await loadGroups();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر حذف الصنف", true);
    }
  };

  const addGroup = async () => {
    if (!newGroup.trim()) { onToast("اكتب اسم المجموعة الجديدة", true); return; }
    try {
      const data = await api<{ categories: CategoryInfo[] }>("/api/categories", { method: "POST", body: JSON.stringify({ name: newGroup.trim() }) });
      setGroups(data.categories);
      setNewGroup("");
      onToast("تمت إضافة المجموعة الجديدة — اختارها عند إضافة صنف");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر إضافة المجموعة", true);
    }
  };

  const renameGroup = async (name: string) => {
    if (!editingGroup) return;
    const newName = editingGroup.newName.trim();
    if (!newName || newName === name) { setEditingGroup(null); return; }
    try {
      const data = await api<{ categories: CategoryInfo[] }>("/api/categories", { method: "PATCH", body: JSON.stringify({ name, newName }) });
      setGroups(data.categories);
      setEditingGroup(null);
      onToast(`تم تغيير اسم المجموعة إلى «${newName}» وتحديث كل أصنافها`);
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر تغيير اسم المجموعة", true);
    }
  };

  const deleteGroup = async (group: CategoryInfo) => {
    if (group.count > 0) {
      const ok = window.confirm(`المجموعة «${group.name}» فيها ${group.count} صنف. سيتم نقلهم تلقائياً إلى المجموعة «عام». هل تريد المتابعة؟`);
      if (!ok) return;
    } else if (!window.confirm(`حذف المجموعة «${group.name}»؟`)) {
      return;
    }
    try {
      const params = new URLSearchParams({ name: group.name });
      if (group.count > 0) params.set("moveTo", "عام");
      const data = await api<{ categories: CategoryInfo[] }>(`/api/categories?${params.toString()}`, { method: "DELETE" });
      setGroups(data.categories);
      onToast(group.count > 0 ? "تم حذف المجموعة ونقل أصنافها إلى «عام»" : "تم حذف المجموعة");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر حذف المجموعة", true);
    }
  };

  const exportCsv = () => {
    const header = ["الكود", "الباركود", "اسم الصنف", "المجموعة", "الوحدة", "سعر الشراء", "سعر البيع", "الكمية", "حد الطلب"];
    const rows = products.map((product) => [product.code, product.barcode, product.name, product.category, product.unit, product.purchasePrice, product.salePrice, product.quantity, product.minQuantity]);
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile("algamal-products.csv", csv, "text/csv");
    onToast("تم تصدير قائمة الأصناف CSV");
  };

  const lowCount = products.filter((product) => product.quantity <= product.minQuantity).length;
  const stockValue = products.reduce((sum, product) => sum + product.quantity * product.purchasePrice, 0);

  return (
    <div>
      <h2 className="page-title"><Warehouse size={20} style={{ verticalAlign: "middle", marginLeft: 6 }} /> إدارة الأصناف والمجموعات</h2>
      <p className="page-desc">شوف كل الأصناف وعدّل فيها، ونظم مجموعاتك: إضافة، تغيير اسم، وحذف — والتغييرات تنعكس فوراً في الفواتير والبحث.</p>

      <div className="settings-tabs">
        <button className={`settings-tab ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}><PackagePlus size={15} style={{ verticalAlign: "middle", marginLeft: 5 }} /> كل الأصناف ({products.length})</button>
        <button className={`settings-tab ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}><Tags size={15} style={{ verticalAlign: "middle", marginLeft: 5 }} /> المجموعات ({groups.length})</button>
      </div>

      {tab === "products" && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="k">إجمالي الأصناف</div><div className="v">{products.length}</div></div>
            <div className="stat-card"><div className="k">أصناف ناقصة</div><div className="v red">{lowCount}</div></div>
            <div className="stat-card"><div className="k">قيمة المخزون (تكلفة)</div><div className="v">{fmt(stockValue, 2)} {settings.currency}</div></div>
            <div className="stat-card"><div className="k">المجموعات</div><div className="v">{categories.length - 1}</div></div>
          </div>

          <div className="two-col wide-left">
            <div className="panel">
              <div className="panel-head">
                <span>كل الأصناف — اضغط أي صف لتعديله</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <Search size={15} />
                  <input placeholder="بحث سريع..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 170 }} />
                  <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ width: 140 }}>
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <button className="btn small" onClick={exportCsv}><Download size={13} /> CSV</button>
                </div>
              </div>
              <div className="table-wrap" style={{ maxHeight: 430 }}>
                <table className="win-table">
                  <thead><tr><th>م</th><th>الكود</th><th>اسم الصنف</th><th>المجموعة</th><th>الوحدة</th><th>شراء</th><th>بيع</th><th>الكمية</th><th>الحد</th><th>الباركود</th></tr></thead>
                  <tbody>
                    {filtered.map((product, index) => (
                      <tr key={product.id} className={form.id === product.id ? "selected" : product.quantity <= product.minQuantity ? "alert" : ""} onClick={() => select(product)} style={{ cursor: "pointer" }}>
                        <td>{index + 1}</td><td>{product.code}</td><td className="right">{product.name}</td><td>{product.category}</td>
                        <td>{product.unit}</td><td>{fmt(product.purchasePrice, 2)}</td><td>{fmt(product.salePrice, 2)}</td>
                        <td><b>{fmt(product.quantity, 0)}</b></td><td>{fmt(product.minQuantity, 0)}</td><td dir="ltr">{product.barcode || "N/A"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={10} className="empty-row">لا توجد أصناف مطابقة</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><span>{form.id ? "تعديل صنف" : "إضافة صنف جديد"}</span><PackagePlus size={17} /></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div><label className="label">كود الصنف</label><input className="field" style={{ width: "100%" }} value={form.code} onChange={(event) => update({ code: event.target.value })} placeholder="يولد تلقائياً" /></div>
                  <div><label className="label">الباركود</label><input className="field" style={{ width: "100%" }} value={form.barcode} onChange={(event) => update({ barcode: event.target.value })} dir="ltr" /></div>
                  <div className="full"><label className="label">اسم الصنف *</label><input className="field" style={{ width: "100%" }} value={form.name} onChange={(event) => update({ name: event.target.value })} /></div>
                  <div>
                    <label className="label">المجموعة</label>
                    <select className="field" style={{ width: "100%" }} value={form.category} onChange={(event) => update({ category: event.target.value })}>
                      {categories.filter((item) => item !== "الكل").map((item) => <option key={item}>{item}</option>)}
                      {categories.every((item) => item === "الكل") && <option>عام</option>}
                    </select>
                  </div>
                  <div><label className="label">الوحدة</label><input className="field" style={{ width: "100%" }} value={form.unit} onChange={(event) => update({ unit: event.target.value })} /></div>
                  <div><label className="label">سعر الشراء</label><input type="number" className="field" style={{ width: "100%" }} value={form.purchasePrice} onChange={(event) => update({ purchasePrice: event.target.value })} /></div>
                  <div><label className="label">سعر البيع</label><input type="number" className="field" style={{ width: "100%" }} value={form.salePrice} onChange={(event) => update({ salePrice: event.target.value })} /></div>
                  <div><label className="label">الكمية الحالية</label><input type="number" className="field" style={{ width: "100%" }} value={form.quantity} onChange={(event) => update({ quantity: event.target.value })} /></div>
                  <div><label className="label">حد التنبيه</label><input type="number" className="field" style={{ width: "100%" }} value={form.minQuantity} onChange={(event) => update({ minQuantity: event.target.value })} /></div>
                  <div><label className="label">ضريبة %</label><input type="number" className="field" style={{ width: "100%" }} value={form.taxRate} onChange={(event) => update({ taxRate: event.target.value })} /></div>
                  <div className="full"><label className="label"><input type="checkbox" checked={form.active} onChange={(event) => update({ active: event.target.checked })} style={{ minHeight: 0, verticalAlign: "middle", marginLeft: 6 }} /> الصنف نشط ويظهر في شاشة المبيعات</label></div>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                  <button className="btn green" disabled={busy} onClick={() => void save()}><Save size={15} /> حفظ الصنف</button>
                  <button className="btn" onClick={() => setForm(emptyForm)}>جديد</button>
                  <button className="btn red" onClick={() => void remove()} disabled={!form.id}><Trash2 size={15} /> حذف</button>
                </div>
                <div className="info-box" style={{ marginTop: 14 }}>
                  المجموعات اللي تظهر هنا هي نفس مجموعات بند «المجموعات». عايز مجموعة جديدة؟ افتح التبويب الجوار واضغط إضافة مجموعة.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "groups" && (
        <div className="two-col" style={{ gridTemplateColumns: "1.35fr 1fr" }}>
          <div className="panel">
            <div className="panel-head"><span>مجموعات الأصناف</span><span className="head-chip">{groups.length} مجموعة</span></div>
            <div className="table-wrap" style={{ maxHeight: 470 }}>
              <table className="win-table">
                <thead><tr><th>م</th><th>اسم المجموعة</th><th>عدد الأصناف</th><th>قيمة المخزون</th><th>إجراءات</th></tr></thead>
                <tbody>
                  {groups.map((group, index) => (
                    <tr key={group.name}>
                      <td>{index + 1}</td>
                      <td className="right">
                        {editingGroup?.name === group.name ? (
                          <input
                            className="field"
                            style={{ width: 220, minWidth: 200 }}
                            value={editingGroup.newName}
                            autoFocus
                            onChange={(event) => setEditingGroup({ name: group.name, newName: event.target.value })}
                            onKeyDown={(event) => { if (event.key === "Enter") void renameGroup(group.name); if (event.key === "Escape") setEditingGroup(null); }}
                          />
                        ) : (
                          <b>{group.name}</b>
                        )}
                      </td>
                      <td><b>{group.count}</b></td>
                      <td>{fmt(group.stockValue, 2)} {settings.currency}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {editingGroup?.name === group.name ? (
                          <>
                            <button className="btn small blue" onClick={() => void renameGroup(group.name)}><Save size={12} /> حفظ</button>{" "}
                            <button className="btn small" onClick={() => setEditingGroup(null)}>إلغاء</button>
                          </>
                        ) : (
                          <>
                            <button className="btn small blue" onClick={() => setEditingGroup({ name: group.name, newName: group.name })}><Pencil size={12} /> تغيير الاسم</button>{" "}
                            <button className="btn small red" onClick={() => void deleteGroup(group)}><Trash2 size={12} /> حذف</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {groups.length === 0 && <tr><td colSpan={5} className="empty-row">لا توجد مجموعات بعد</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="panel-body">
              <div className="info-box">
                <b>تغيير الاسم:</b> يحدّث المجموعة وجميع أصنافها في نفس اللحظة. <b>الحذف:</b> لو المجموعة فيها أصناف يتم نقلها تلقائياً إلى «عام» حفاظاً على بياناتك.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>إضافة مجموعة جديدة</span><FolderPlus size={17} /></div>
            <div className="panel-body">
              <label className="label">اسم المجموعة</label>
              <input
                className="field"
                style={{ width: "100%" }}
                placeholder="مثال: كتب خارجية، حواسيب وملحقات، أدوات فنية..."
                value={newGroup}
                onChange={(event) => setNewGroup(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void addGroup(); }}
              />
              <button className="btn green" style={{ width: "100%", marginTop: 10 }} onClick={() => void addGroup()}><FolderPlus size={15} /> إضافة المجموعة</button>
              <div className="info-box" style={{ marginTop: 14 }}>
                <Layers size={14} style={{ verticalAlign: "middle", marginLeft: 5 }} />
                بعد إضافة المجموعة، اختارها من حقل «المجموعة» عند إضافة أو تعديل أي صنف. المجموعات تظهر تلقائياً في البحث والتصنيف بشاشة المبيعات.
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "#5e7187", lineHeight: 2 }}>
                <b>توزيع الأصناف الحالي:</b>
                {groups.filter((group) => group.count > 0).map((group) => (
                  <div key={group.name} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{group.name}</span><b>{group.count} صنف</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

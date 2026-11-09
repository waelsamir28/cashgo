"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Banknote, CreditCard, FilePlus2, Printer, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { dateTime, fmt, shortDate } from "@/lib/format";
import type { Customer, InstallmentsData, Payment, StoreSettings } from "@/lib/types";

type Props = {
  installments: InstallmentsData | null;
  customers: Customer[];
  settings: StoreSettings;
  onRefresh: () => Promise<void> | void;
  onToast: (message: string, error?: boolean) => void;
  onNavigate: (screen: "sales") => void;
};

function daysLabel(days: number) {
  if (days <= 0) return "النهاردة";
  if (days < 30) return `${days} يوم`;
  const months = Math.floor(days / 30);
  const rest = days % 30;
  return rest ? `${months} شهر و ${rest} يوم` : `${months} شهر`;
}

export default function InstallmentsScreen({ installments, customers, settings, onRefresh, onToast, onNavigate }: Props) {
  const [data, setData] = useState<InstallmentsData | null>(installments);
  const [selected, setSelected] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({
    amount: "", method: "نقدي", note: "", paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<InstallmentsData>("/api/installments");
      setData(result);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر تحميل بيانات التقسيط", true);
    }
  }, [onToast]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (installments) setData(installments);
  }, [installments]);

  useEffect(() => {
    let active = true;
    if (!selected) {
      const timer = setTimeout(() => { if (active) setPayments([]); }, 0);
      return () => { active = false; clearTimeout(timer); };
    }
    api<{ payments: Payment[] }>(`/api/payments?customerId=${selected}`)
      .then((result) => { if (active) setPayments(result.payments); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [selected]);

  const plans = data?.plans ?? [];
  const overdue = data?.overdue ?? [];
  const totalDebt = plans.reduce((sum, plan) => sum + plan.debt, 0);
  const selectedPlan = plans.find((plan) => plan.customerId === selected) ?? null;

  const addPayment = async () => {
    const amount = Number(form.amount);
    if (!selected) { onToast("اختر العميل من القائمة أولاً", true); return; }
    if (!amount || amount <= 0) { onToast("أدخل مبلغ الدفعة", true); return; }
    setBusy(true);
    try {
      await api("/api/payments", {
        method: "POST",
        body: JSON.stringify({ customerId: selected, amount, method: form.method, note: form.note || "قسط", paymentDate: form.paymentDate }),
      });
      onToast(`تم تسجيل دفعة ${fmt(amount, 2)} ${settings.currency} للعميل`);
      setForm({ amount: "", method: "نقدي", note: "", paymentDate: new Date().toISOString().slice(0, 10) });
      await onRefresh();
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر تسجيل الدفعة", true);
    } finally { setBusy(false); }
  };

  const deletePayment = async (id: number) => {
    if (!window.confirm("حذف هذه الدفعة وإرجاع المبلغ لمتبقي العميل؟")) return;
    try {
      await api(`/api/payments?id=${id}`, { method: "DELETE" });
      onToast("تم حذف الدفعة");
      await onRefresh();
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر حذف الدفعة", true);
    }
  };

  const print = () => {
    document.body.classList.add("print-mode");
    window.print();
    setTimeout(() => document.body.classList.remove("print-mode"), 800);
  };

  return (
    <div>
      <h2 className="page-title"><CreditCard size={20} style={{ verticalAlign: "middle", marginLeft: 6 }} /> نظام التقسيط (بدون ميعاد)</h2>
      <p className="page-desc">متابعة كل العملاء اللي شغالين قسط: عليهم كام، آخر دفعة كم ومتى، ومدى الفترة اللي مرّت بدون دفع — مع تنبيه لمن يتأخر شهرين.</p>

      <div className="stat-grid">
        <div className="stat-card"><div className="k">عملاء على القسط</div><div className="v">{plans.length}</div></div>
        <div className="stat-card"><div className="k">إجمالي المتبقي</div><div className="v red">{fmt(totalDebt, 2)} {settings.currency}</div></div>
        <div className="stat-card"><div className="k">تنبيهات (60 يوم+)</div><div className="v red">{overdue.length}</div></div>
        <div className="stat-card"><div className="k">فواتير قسط</div><div className="v">{plans.reduce((sum, plan) => sum + plan.invoiceCount, 0)}</div></div>
      </div>

      {overdue.length > 0 && (
        <div className="installment-alert" style={{ marginBottom: 12 }}>
          <AlertTriangle size={21} />
          <span>
            <b>تنبيه:</b> {overdue.map((plan) => `${plan.customerName} مدفعش بقاله ${plan.daysSincePayment} يوم (عليه ${fmt(plan.debt, 2)} ${settings.currency})`).join("   |   ")}
          </span>
        </div>
      )}

      <div className="statement-layout">
        <div className="statement-printable">
          <div className="panel">
            <div className="panel-head">
              <span>عملاء القسط</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="btn small" onClick={() => void load()}><RefreshCw size={13} /> تحديث</button>
                <button className="btn small" onClick={print}><Printer size={13} /> طباعة</button>
                <button className="btn small blue" onClick={() => onNavigate("sales")}><FilePlus2 size={13} /> فاتورة قسط جديدة</button>
              </span>
            </div>
            <div className="table-wrap" style={{ maxHeight: 470 }}>
              <table className="win-table">
                <thead>
                  <tr>
                    <th>العميل</th><th>الهاتف</th><th>عليه قسط بـ</th><th>إجمالي القسط</th><th>فواتير</th>
                    <th>دفع آخر مرة</th><th>تاريخ آخر دفعة</th><th>مدفعش بقاله</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr
                      key={plan.customerId}
                      className={selected === plan.customerId ? "selected" : plan.overdue ? "alert" : ""}
                      onClick={() => setSelected(plan.customerId)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="right"><b>{plan.customerName}</b></td>
                      <td dir="ltr">{plan.phone || "—"}</td>
                      <td><b>{fmt(plan.debt, 2)}</b></td>
                      <td>{fmt(plan.totalPlan, 2)}</td>
                      <td>{plan.invoiceCount}</td>
                      <td>{plan.lastPaymentAmount !== null ? fmt(plan.lastPaymentAmount, 2) : "— لسه ما دفعش"}</td>
                      <td>{plan.lastPaymentDate ? shortDate(plan.lastPaymentDate) : "—"}</td>
                      <td>
                        <b style={{ color: plan.daysSincePayment >= 60 ? "#c00" : plan.daysSincePayment >= 30 ? "#c77700" : "#128349" }}>
                          {daysLabel(plan.daysSincePayment)}
                        </b>
                      </td>
                      <td>{plan.overdue ? <span style={{ color: selected === plan.customerId ? "#fff" : "#c00", fontWeight: 900 }}>⚠ متأخر 60 يوم+</span> : <span style={{ color: selected === plan.customerId ? "#fff" : "#128349", fontWeight: 900 }}>عادي</span>}</td>
                    </tr>
                  ))}
                  {plans.length === 0 && <tr><td colSpan={9} className="empty-row">لا يوجد عملاء على القسط حالياً — اختر طريقة الدفع «قسط (بدون ميعاد)» عند البيع</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="panel-body">
              <div className="info-box">
                «مدفعش بقاله» محسوب من آخر دفعة، أو من تاريخ أول فاتورة قسط لو لسه ما دفعش. أي عميل يتأخر 60 يوم أو أكثر يظهر بأحمر هنا وعلى الشاشة الرئيسية.
              </div>
            </div>
          </div>
        </div>

        <div className="statement-side">
          <div className="panel">
            <div className="panel-head"><span>تسجيل دفعة</span><Banknote size={17} /></div>
            <div className="panel-body statement-card">
              <div className="info-box" style={{ marginBottom: 10 }}>
                {selectedPlan ? (
                  <>العميل: <b>{selectedPlan.customerName}</b><br />المتبقي: <b style={{ color: "#c00" }}>{fmt(selectedPlan.debt, 2)} {settings.currency}</b></>
                ) : "اضغط على عميل من القائمة لتسجيل دفعة له"}
              </div>
              <div><label className="label">المبلغ</label><input type="number" className="field" style={{ width: "100%" }} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} disabled={!selected} /></div>
              <div><label className="label">طريقة الدفع</label><select className="field" style={{ width: "100%" }} value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option>نقدي</option><option>تحويل بنكي</option><option>شبكة / بطاقة</option><option>شيك</option></select></div>
              <div><label className="label">التاريخ</label><input type="date" dir="ltr" className="field" style={{ width: "100%" }} value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></div>
              <div><label className="label">ملاحظة</label><input className="field" style={{ width: "100%" }} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="قسط – دفعة ..." /></div>
              <button className="btn green" disabled={!selected || busy} onClick={() => void addPayment()}><Banknote size={15} /> حفظ الدفعة</button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>سجل دفعات العميل</span><span className="head-chip">{payments.length}</span></div>
            <div className="panel-body" style={{ padding: 7 }}>
              {payments.map((payment) => (
                <div key={payment.id} className="custom-module-row" style={{ marginBottom: 5 }}>
                  <span>
                    <b>{fmt(payment.amount, 2)} {settings.currency}</b>
                    <br /><small>{dateTime(payment.paymentDate)} — {payment.method} {payment.note ? `— ${payment.note}` : ""}</small>
                  </span>
                  <button className="btn small red" onClick={() => void deletePayment(payment.id)}><Trash2 size={12} /></button>
                </div>
              ))}
              {payments.length === 0 && <div className="empty-row">{selected ? "لا توجد دفعات لهذا العميل" : "اختر عميلاً من القائمة"}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

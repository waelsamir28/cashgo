"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import {
  BadgeCheck, Clock3, Headset, LockKeyhole, MessageCircle, Phone, Send,
  ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { dateTime } from "@/lib/format";
import { SUPPORT, TEL_URL, whatsappUrl } from "@/lib/support";
import type { SupportTicket } from "@/lib/types";

type Props = {
  tickets: SupportTicket[];
  settings?: unknown;
  onRefresh: () => Promise<void> | void;
  onToast: (message: string, error?: boolean) => void;
};

export default function SupportScreen({ tickets, onRefresh, onToast }: Props) {
  const [form, setForm] = useState({ name: "", phone: "", subject: "استفسار عام", message: "" });
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await api("/api/tickets", { method: "POST", body: JSON.stringify(form) });
      onToast("تم إرسال رسالتك إلى الدعم الفني وحفظها في قاعدة البيانات");
      setForm({ name: "", phone: "", subject: "استفسار عام", message: "" });
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "تعذر إرسال الرسالة", true);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h2 className="page-title"><Headset size={20} style={{ verticalAlign: "middle", marginLeft: 6 }} /> الدعم الفني</h2>
      <p className="page-desc">تواصل مباشرة مع مصمم البرنامج، أو أرسل تذكرة من داخل البرنامج وسيتم حفظها ومتابعتها.</p>

      <div className="support-hero">
        <div className="support-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/images/algamal-mark.svg" alt="" style={{ width: 42, height: 42 }} />
            <div>
              <div className="s-kicker">تصميم وبرمجة ودعم فني</div>
              <div className="s-name">{SUPPORT.designer}</div>
              <div className="s-role">الجمال للأدوات المدرسية · دعم فني مجاني ومدى الحياة</div>
            </div>
          </div>

          <a className="support-phone" href={whatsappUrl()} target="_blank" rel="noreferrer" title={`اضغط لمراسلة ${SUPPORT.designer} على واتساب`}>
            <Phone size={20} /> {SUPPORT.phone}
          </a>

          <div className="support-buttons">
            <a className="btn green tall" href={whatsappUrl()} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> إرسال رسالة واتساب <Sparkles size={14} />
            </a>
            <a className="btn blue tall" href={TEL_URL}><Phone size={16} /> اتصال مباشر</a>
            <a
              className="btn tall"
              href={whatsappUrl("السلام عليكم م. وائل الجمال 👋\nأريد الاستفسار عن تفعيل النسخة الكاملة للبرنامج.")}
              target="_blank"
              rel="noreferrer"
            >
              <BadgeCheck size={16} /> طلب تفعيل
            </a>
          </div>

          <div className="support-locked" style={{ marginTop: 13 }}>
            <LockKeyhole size={13} style={{ verticalAlign: "middle", marginLeft: 5 }} />
            رقم الدعم واسم المصمم <b>ثابتان داخل البرنامج</b> ولا يتغيران بتغيير بيانات المحل أو أرقام الفواتير أو العملاء.
          </div>
        </div>

        <div className="support-facts">
          <div className="support-fact"><Clock3 size={15} style={{ verticalAlign: "middle" }} /><b>مواعيد الدعم</b><span>{SUPPORT.hours}</span></div>
          <div className="support-fact"><ShieldCheck size={15} style={{ verticalAlign: "middle" }} /><b>الدعم الفني</b><span>مجاني لجميع مستخدمي البرنامج</span></div>
          <div className="support-fact"><BadgeCheck size={15} style={{ verticalAlign: "middle" }} /><b>التفعيل</b><span>كلمة سر خاصة بالمصمم فقط</span></div>
          <div className="support-fact"><MessageCircle size={15} style={{ verticalAlign: "middle" }} /><b>واتساب</b><span>الضغط على الرقم يفتح محادثة جاهزة</span></div>
          <div className="support-fact"><Headset size={15} style={{ verticalAlign: "middle" }} /><b>التذاكر المسجلة</b><span>{tickets.length} رسالة محفوظة</span></div>
          <div className="support-fact"><Phone size={15} style={{ verticalAlign: "middle" }} /><b>رقم ثابت</b><span dir="ltr">{SUPPORT.phone}</span></div>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12, alignItems: "start" }}>
        <div className="panel">
          <div className="panel-head"><span>إرسال رسالة / تذكرة دعم</span><Send size={17} /></div>
          <div className="panel-body">
            <div className="form-grid">
              <div><label className="label">الاسم *</label><input className="field" style={{ width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">رقم الهاتف</label><input className="field" style={{ width: "100%" }} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="full">
                <label className="label">الموضوع</label>
                <select className="field" style={{ width: "100%" }} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option>استفسار عام</option><option>مشكلة في الفواتير</option><option>طلب ميزة جديدة</option>
                  <option>النسخ الاحتياطي</option><option>تفعيل النسخة / كلمة السر</option><option>تجهيز ملف EXE</option>
                </select>
              </div>
              <div className="full"><label className="label">الرسالة *</label><textarea className="field" style={{ width: "100%" }} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="اشرح المشكلة أو الطلب بالتفصيل..." /></div>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn green tall" disabled={busy} onClick={() => void send()}><Send size={15} /> إرسال التذكرة</button>
              <a className="btn blue tall" href={whatsappUrl()} target="_blank" rel="noreferrer"><MessageCircle size={15} /> أو عبر واتساب</a>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>سجل الرسائل والتذاكر</span><span className="head-chip">{tickets.length}</span></div>
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table className="win-table">
              <thead><tr><th>م</th><th>الاسم</th><th>الموضوع</th><th>الرسالة</th><th>التاريخ</th><th>الحالة</th></tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.id}</td><td>{ticket.name}</td><td>{ticket.subject}</td>
                    <td className="right">{ticket.message}</td><td>{dateTime(ticket.createdAt)}</td><td>{ticket.status}</td>
                  </tr>
                ))}
                {tickets.length === 0 && <tr><td colSpan={6} className="empty-row">لا توجد رسائل دعم حتى الآن</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="panel-body">
            <div className="info-box">
              للدعم السريع اضغط على رقم <b dir="ltr">{SUPPORT.phone}</b> في الأعلى — سيفتح واتساب برسالة جاهزة إلى <b>{SUPPORT.designer}</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Camera, Check, Copy, ExternalLink, Monitor, QrCode, RefreshCw, Smartphone, Wifi, X } from "lucide-react";

type Info = { port: number; addresses: string[]; mobileUrl: string | null; customerUrl: string; note: string };

type Props = {
  onClose: () => void;
  onToast: (message: string, error?: boolean) => void;
  lastCode?: string;
};

export default function PhoneScanDialog({ onClose, onToast, lastCode }: Props) {
  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState("");
  const [target, setTarget] = useState<"pos" | "price">("pos");

  const load = async () => {
    try {
      const data = await fetch("/api/scan/info").then((r) => r.json());
      setInfo(data);
      if (data.mobileUrl) {
        const QRCode = (await import("qrcode")).default;
        const url = `${data.mobileUrl}?target=${target}`;
        setQr(await QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: "#0b3f86", light: "#ffffff" } }));
      }
    } catch { onToast("تعذر قراءة عنوان الشبكة", true); }
  };

  useEffect(() => { void load(); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const url = info?.mobileUrl ? `${info.mobileUrl}?target=${target}` : "";
  const copy = () => {
    void navigator.clipboard?.writeText(url).then(() => onToast("تم نسخ رابط الموبايل")).catch(() => onToast("اكتب الرابط يدوياً من الشاشة", true));
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 760 }}>
        <div className="modal-head">
          <span><Camera size={16} style={{ verticalAlign: "middle", marginLeft: 6 }} /> ربط كاميرا الموبايل بالبرنامج عبر الواي فاي</span>
          <button className="btn small" onClick={onClose}><X size={13} /></button>
        </div>
        <div className="modal-body">
          <div className="phone-scan-grid">
            <div className="phone-qr">
              {qr ? <img src={qr} alt="QR لفتح صفحة الماسح على الموبايل" /> : <QrCode size={90} color="#9fb6cd" />}
              <b>امسح الكود بكاميرا الموبايل</b>
              <small>أو اكتب الرابط في متصفح الموبايل</small>
            </div>
            <div className="phone-info">
              <div className="info-box" style={{ marginBottom: 10 }}>
                <b><Wifi size={14} style={{ verticalAlign: "middle" }} /> نفس شبكة الواي فاي</b><br />
                الموبايل والكمبيوتر لازم يكونوا على نفس الراوتر. افتح المنفذ <b dir="ltr">{info?.port ?? 3210}</b> في جدار حماية ويندوز لو طلب.
              </div>

              <label className="label">الرابط (اضغط نسخ)</label>
              <div className="field-row" style={{ marginBottom: 10 }}>
                <input className="field" dir="ltr" readOnly value={url} style={{ flex: 1, direction: "ltr" }} />
                <button className="btn small blue" onClick={copy}><Copy size={13} /> نسخ</button>
              </div>

              <label className="label">الرمز يُرسل إلى</label>
              <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
                <button className={`btn small ${target === "pos" ? "green" : ""}`} onClick={() => setTarget("pos")}><Smartphone size={13} /> الفاتورة المفتوحة</button>
                <button className={`btn small ${target === "price" ? "green" : ""}`} onClick={() => setTarget("price")}><Monitor size={13} /> شاشة استعلام الأسعار</button>
                <button className="btn small" onClick={() => void load()}><RefreshCw size={13} /></button>
              </div>

              <div className="phone-steps">
                <div><b>1</b> امسح QR أو افتح الرابط على الموبايل</div>
                <div><b>2</b> اضغط «التقاط باركود بالكاميرا» ووجّهها للصنف</div>
                <div><b>3</b> الرمز يظهر في البرنامج ويُضاف للفاتورة تلقائياً</div>
              </div>

              <div className={`phone-live ${lastCode ? "got" : ""}`}>
                {lastCode ? <><Check size={15} /> آخر رمز مستلم: <b dir="ltr">{lastCode}</b></> : "⏳ في انتظار أول باركود من الموبايل…"}
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                <button className="btn blue small" onClick={() => window.open(url, "_blank")}><ExternalLink size={13} /> فتح الماسح على هذا الجهاز</button>
                <span className="head-chip">عناوين الشبكة: <b dir="ltr">{info?.addresses.join(", ") || "—"}</b></span>
              </div>
            </div>
          </div>

          <div className="info-box" style={{ marginTop: 12 }}>
            <b>ملاحظة تقنية مهمة:</b> متصفحات الموبايل بتسمح بالتقاط صورة من الكاميرا على رابط محلي عادي، لكن <b>المسح المستمر بالفيديو</b> بيحتاج HTTPS. علشان كده الصفحة بتستخدم «التقاط صورة» (شغالة على أي موبايل بدون شهادات).
            ولو عايز مسح فوري متواصل بدون ضغط زر: قارئ باركود <b>USB أو Bluetooth</b> بيشتغل كلوحة مفاتيح مباشرة في خانة الباركود — وهو الأسرع في الكاشير.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

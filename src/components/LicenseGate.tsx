"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { BadgeCheck, Clock3, Copy, KeyRound, LockKeyhole, LogOut, MessageCircle, Package, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { SUPPORT, activationWhatsappUrl } from "@/lib/support";
import type { LicenseState } from "@/db/local";

type Props = {
  license: LicenseState;
  onActivated: (license: LicenseState) => void;
  onExit: () => void;
  /** true = شاشة حجب كاملة بعد انتهاء التجربة، false = نافذة تفعيل من الشريط */
  blocking?: boolean;
  onClose?: () => void;
};

export default function LicenseGate({ license, onActivated, onExit, blocking = false, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    if (!password.trim()) { setError("أدخل كلمة سر التفعيل"); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ ok: boolean; license: LicenseState }>("/api/license", {
        method: "POST",
        body: JSON.stringify({ action: "activate", password: password.trim() }),
      });
      onActivated(result.license);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر التفعيل");
    } finally {
      setBusy(false);
    }
  };

  const copyId = () => {
    void navigator.clipboard?.writeText(license.installId).catch(() => undefined);
  };

  return (
    <div className={blocking ? "license-overlay" : "modal-backdrop"}>
      <div className="license-card">
        <div className="license-head">
          <img src="/images/algamal-mark.svg" alt="" />
          <div>
            <b>{blocking ? "انتهت الفترة التجريبية" : "تفعيل النسخة الكاملة"}</b>
            <span>{blocking ? "فعّل البرنامج لمتابعة العمل" : "أدخل كلمة السر التي تحصل عليها من مصمم البرنامج"}</span>
          </div>
          {!blocking && onClose && <button className="btn small" onClick={onClose}><X size={13} /></button>}
        </div>

        <div className="license-body">
          <div className="license-stats">
            <div><Clock3 size={16} /><span>مدة التجربة</span><b>{license.trialDays} أيام</b></div>
            <div><Package size={16} /><span>أصناف النسخة التجريبية</span><b>{license.trialProductLimit} صنف</b></div>
            <div><BadgeCheck size={16} /><span>الأيام المتبقية</span><b style={{ color: license.expired ? "#c00" : undefined }}>{license.daysLeft} يوم</b></div>
          </div>

          <div className="license-device">
            <div>
              <small>كود الجهاز (أرسله لم. وائل الجمال عند طلب التفعيل)</small>
              <code dir="ltr">{license.installId}</code>
            </div>
            <button className="btn small" onClick={copyId}><Copy size={12} /> نسخ</button>
          </div>

          <label className="label" style={{ marginTop: 12 }}>كلمة سر التفعيل</label>
          <div className="license-pass">
            <KeyRound size={16} />
            <input
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter") void activate(); }}
              placeholder="••••••••••••"
              autoFocus={!blocking}
            />
          </div>
          {error && <div className="license-error"><LockKeyhole size={14} /> {error}</div>}

          <div className="license-actions">
            <button className="btn green tall" disabled={busy} onClick={() => void activate()}>
              <BadgeCheck size={16} /> {busy ? "جارٍ التفعيل..." : "تفعيل البرنامج"}
            </button>
            <a className="btn blue tall" href={activationWhatsappUrl(license.installId)} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> اطلب كلمة السر واتساب
            </a>
            <button className="btn tall" onClick={onExit}><LogOut size={15} /> خروج</button>
          </div>

          <div className="license-note">
            الدعم والتفعيل: <b>{SUPPORT.designer}</b> · <span dir="ltr">{SUPPORT.phone}</span>
            <br />بعد التفعيل: كل الأصناف، بلا حد زمني، وبدون أي رسائل تجريبية.
          </div>
        </div>
      </div>
    </div>
  );
}

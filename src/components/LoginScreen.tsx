"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import {
  ArrowLeft, BadgeCheck, Boxes, Headset, LogIn, LogOut, MessageCircle,
  Phone, ShieldCheck, Sparkles, Tags,
} from "lucide-react";
import { SUPPORT, whatsappUrl } from "@/lib/support";
import { LICENSE_CONFIG } from "@/lib/license-config";
import type { LicenseState } from "@/db/local";

type Props = {
  onLogin: (name: string) => void;
  onExit: () => void;
  license: LicenseState | null;
  defaultName?: string;
  fontFamily?: string;
};

export default function LoginScreen({ onLogin, onExit, license, defaultName = "المدير", fontFamily }: Props) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("algamal.lastUser");
        if (saved) setName(saved);
      } catch { /* localStorage قد يكون معطلاً */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = () => {
    const finalName = name.trim() || defaultName;
    try { window.localStorage.setItem("algamal.lastUser", finalName); } catch { /* تجاهل */ }
    onLogin(finalName);
  };

  return (
    <div className="auth-screen" style={fontFamily ? { fontFamily } : undefined}>
      <div className="auth-topbar">
        <div className="auth-top-right">
          <img src="/images/algamal-mark.svg" alt="" />
          <b>الجمال</b><span>للأدوات المدرسية والمكتبية</span>
        </div>
        <div className="auth-top-left">
          <span className="auth-secure"><ShieldCheck size={14} /> نظام محلي آمن · بياناتك على جهازك</span>
          <a href={whatsappUrl()} target="_blank" rel="noreferrer"><Phone size={13} /> <span dir="ltr">{SUPPORT.phone}</span></a>
        </div>
      </div>

      <div className="auth-main">
        {/* ===== الجانب الأيمن: الهوية ===== */}
        <section className="auth-brand">
          <div className="auth-brand-inner">
            <img className="auth-brand-mark" src="/images/algamal-mark.svg" alt="شعار الجمال" />
            <div className="auth-eyebrow">مرحباً بك في</div>
            <h1 className="auth-brand-title">الجمال<span>. </span></h1>
            <div className="auth-brand-sub">نظام إدارة متكامل للمكتبات والأدوات المدرسية</div>
            <div className="auth-ribbon">إدارة احترافية .. لمحل تجاري أكثر نجاحاً</div>

            <div className="auth-features">
              <div><Boxes size={18} /><span><b>كل الأصناف في مكان واحد</b><small>كتب · كراسات · أقلام · قرطاسية</small></span></div>
              <div><Tags size={18} /><span><b>فواتير وباركود فوري</b><small>بيع، شراء، ملصقات وتقارير</small></span></div>
              <div><BadgeCheck size={18} /><span><b>جاهز للعمل بدون إنترنت</b><small>قاعدة بيانات محلية سريعة</small></span></div>
            </div>

            <div className="auth-brand-foot">
              <span>الإصدار {LICENSE_CONFIG.appVersion}</span>
              <span className={license?.activated ? "lic-ok" : "lic-trial"}>
                {license?.activated ? "✓ النسخة مفعّلة بالكامل" : `نسخة تجريبية · متبقي ${license?.daysLeft ?? LICENSE_CONFIG.trialDays} يوم`}
              </span>
            </div>
          </div>
        </section>

        {/* ===== الجانب الأيسر: الدخول ===== */}
        <section className="auth-panel">
          <div className="auth-welcome">
            <Sparkles size={17} />
            <div>
              <b>أهلاً وسهلاً بك 👋</b>
              <span>يسعدنا انضمامك لعائلة «الجمال» — يوم مليء بالبيعات الناجحة.</span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-icon"><img src="/images/algamal-mark.svg" alt="" /></div>
            <div className="auth-card-head">
              <h2>تسجيل الدخول</h2>
              <p>اكتب اسمك للبدء — بدون كلمة مرور</p>
            </div>

            <label htmlFor="auth-name">اسم المستخدم</label>
            <div className="auth-input">
              <input
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
                placeholder={defaultName}
                autoFocus
              />
            </div>

            <div className="auth-actions">
              <button className="btn green tall auth-enter" onClick={submit}><LogIn size={17} /> دخول للبرنامج <ArrowLeft size={14} /></button>
              <button className="btn tall" onClick={onExit}><LogOut size={16} /> خروج</button>
            </div>

            <div className="auth-hint">سيظهر اسمك في شريط الحالة والفواتير</div>
          </div>

          <div className="auth-mini">
            <span>💡 اختصارات سريعة بعد الدخول</span>
            <div><b>F3</b> كل الأصناف · <b>F6</b> استعلام سعر · <b>F7</b> كاميرا الموبايل · <b>F8</b> طباعة</div>
          </div>
        </section>
      </div>

      <footer className="auth-footer">
        <div className="auth-ad">
          <Headset size={19} />
          <div>
            <b>{SUPPORT.title} · {SUPPORT.designer}</b>
            <span>للاستفسار والدعم والتفعيل — {SUPPORT.hours}</span>
          </div>
          <a className="auth-phone" href={whatsappUrl()} target="_blank" rel="noreferrer" title={`مراسلة ${SUPPORT.designer} على واتساب`}>
            <Phone size={16} /> <span dir="ltr">{SUPPORT.phone}</span>
          </a>
          <a className="auth-wa" href={whatsappUrl()} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> تواصل واتساب <ArrowLeft size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}

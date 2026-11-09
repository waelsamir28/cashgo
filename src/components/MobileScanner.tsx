"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Keyboard, Loader2, RefreshCw, Send, Smartphone, Wifi, X } from "lucide-react";

type Found = { name: string; salePrice: number; code: string; barcode: string; quantity: number };
type Status = { text: string; kind: "idle" | "ok" | "error" | "busy" };

export default function MobileScanner() {
  const [status, setStatus] = useState<Status>({ text: "جاهز — اضغط «التقاط باركود»", kind: "idle" });
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<Found | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [continuous, setContinuous] = useState(false);
  const [secure, setSecure] = useState(false);
  const [target, setTarget] = useState<"pos" | "price">("pos");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setSecure(typeof window !== "undefined" && window.isSecureContext);
    const value = new URLSearchParams(window.location.search).get("target");
    if (value === "price" || value === "pos") setTarget(value);
  }, []);

  const beep = (ok: boolean) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = ok ? 900 : 240;
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.21);
      setTimeout(() => void ctx.close(), 350);
    } catch { /* تجاهل */ }
  };

  const submit = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setStatus({ text: "جارٍ إرسال الرمز للبرنامج…", kind: "busy" });
    try {
      const push = await fetch("/api/scan/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, source: "phone", target }),
      });
      if (!push.ok) throw new Error("تعذر الاتصال بالبرنامج");
      const price = await fetch(`/api/price?q=${encodeURIComponent(code)}`).then((r) => r.json());
      const found: Found | null = price.exact ?? price.products?.[0] ?? null;
      setLast(found);
      setHistory((prev) => [code, ...prev].slice(0, 8));
      setStatus({ text: found ? `✔ تم الإرسال: ${found.name}` : "✔ تم الإرسال (الصنف غير موجود في الأصناف)", kind: found ? "ok" : "error" });
      beep(Boolean(found));
      navigator.vibrate?.(found ? 60 : [40, 40, 40]);
      setManual("");
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "تعذر الإرسال — تأكد من الواي فاي", kind: "error" });
      beep(false);
    } finally {
      busyRef.current = false;
    }
  }, [target]);

  const handleImage = async (file?: File) => {
    if (!file) return;
    setStatus({ text: "جارٍ قراءة الباركود من الصورة…", kind: "busy" });
    try {
      const url = URL.createObjectURL(file);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("تعذر فتح الصورة"));
        image.src = url;
      });
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      let decoded: string | null = null;
      try {
        const result = await reader.decodeFromImageElement(image);
        decoded = result.getText();
      } catch {
        // محاولة ثانية بعد تكبير/تحسين التباين عبر canvas
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = image.naturalWidth * scale;
        canvas.height = image.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const enhanced = new Image();
          await new Promise<void>((resolve) => { enhanced.onload = () => resolve(); enhanced.src = canvas.toDataURL(); });
          try {
            const result = await reader.decodeFromImageElement(enhanced);
            decoded = result.getText();
          } catch { /* لا نتيجة */ }
        }
      }
      URL.revokeObjectURL(url);
      if (!decoded) {
        setStatus({ text: "لم أتمكن من قراءة الباركود — قرّب الكاميرا أكثر أو اكتب الكود يدوياً", kind: "error" });
        beep(false);
        return;
      }
      await submit(decoded);
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "تعذر قراءة الصورة", kind: "error" });
      beep(false);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const stopContinuous = useCallback(() => {
    try { controlsRef.current?.stop(); } catch { /* تجاهل */ }
    controlsRef.current = null;
    setContinuous(false);
    setStatus({ text: "تم إيقاف المسح المستمر", kind: "idle" });
  }, []);

  const startContinuous = async () => {
    setStatus({ text: "جارٍ تشغيل الكاميرا…", kind: "busy" });
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, controls) => {
        if (!result || busyRef.current) return;
        const text = result.getText();
        void submit(text);
        // نتجاهل الإطارات المتكررة لنفس الرمز لثانية
        busyRef.current = true;
        setTimeout(() => { busyRef.current = false; }, 900);
        void controls;
      });
      controlsRef.current = controls as unknown as { stop: () => void };
      setContinuous(true);
      setStatus({ text: "المسح المستمر شغال — وجّه الكاميرا للباركود", kind: "ok" });
    } catch {
      setStatus({ text: "المسح المستمر يحتاج اتصالاً آمناً (HTTPS) — استخدم زر «التقاط باركود»", kind: "error" });
      setContinuous(false);
    }
  };

  useEffect(() => () => { try { controlsRef.current?.stop(); } catch { /* تجاهل */ } }, []);

  return (
    <div className="m-scan">
      <header className="m-head">
        <span className="m-logo">ج</span>
        <div><b>قارئ باركود الجمال</b><small>موبايل ← {target === "price" ? "شاشة الأسعار" : "الفاتورة المفتوحة"} عبر الواي فاي</small></div>
        <span className="m-live"><Wifi size={14} /> متصل</span>
      </header>

      <main className="m-body">
        <div className={`m-status ${status.kind}`}>
          {status.kind === "busy" ? <Loader2 size={16} className="spin" /> : status.kind === "ok" ? <Check size={16} /> : status.kind === "error" ? <X size={16} /> : <Smartphone size={16} />}
          {status.text}
        </div>

        {last && (
          <div className="m-result">
            <small>آخر صنف تم إرساله</small>
            <b>{last.name}</b>
            <div className="m-price">{last.salePrice.toFixed(2)} <span>ج.م</span></div>
            <small dir="ltr">{last.barcode || last.code}</small>
          </div>
        )}

        {continuous && <video ref={videoRef} className="m-video" muted playsInline />}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => void handleImage(event.target.files?.[0])}
          style={{ display: "none" }}
        />

        <button className="m-capture" onClick={() => fileRef.current?.click()}>
          <Camera size={26} />
          <span>التقاط باركود بالكاميرا</span>
          <small>تفتح كاميرا الموبايل وتُرسل الرمز للفاتورة المفتوحة</small>
        </button>

        {secure && (
          <button className="m-secondary" onClick={continuous ? stopContinuous : startContinuous}>
            {continuous ? <><X size={16} /> إيقاف المسح المستمر</> : <><RefreshCw size={16} /> مسح مستمر بالكاميرا</>}
          </button>
        )}

        <div className="m-manual">
          <label><Keyboard size={15} /> أو اكتب الباركود / كود الصنف يدوياً</label>
          <div className="m-row">
            <input
              value={manual}
              dir="ltr"
              placeholder="6223002001001"
              onChange={(event) => setManual(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void submit(manual); }}
            />
            <button onClick={() => void submit(manual)}><Send size={18} /></button>
          </div>
        </div>

        {history.length > 0 && (
          <div className="m-history">
            <b>آخر الرموز</b>
            {history.map((item, index) => <span key={`${item}-${index}`} dir="ltr">{item}</span>)}
          </div>
        )}

        <div className="m-tip">
          💡 لو الكاميرا مش بتفتح: تأكد إن الموبايل والكمبيوتر على <b>نفس الواي فاي</b>، وإن جدار حماية ويندوز مسمّح للمنفذ 3210.
        </div>
      </main>
    </div>
  );
}

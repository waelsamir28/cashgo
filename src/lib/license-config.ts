/**
 * إعدادات النسخة التجريبية — عدّل الأرقام هنا بسهولة ثم أعد بناء الـ EXE.
 * لا توجد كلمة سر plaintext هنا: فقط بصمة SHA256 (التحقق يتم في السيرفر /api/license).
 */
export const LICENSE_CONFIG = {
  trialDays: 10,
  trialProductLimit: 25,
  // بصمة SHA256 لكلمة السر الافتراضية: WaelGamal@2026
  // يمكن استبدال كلمة السر بسهولة عبر متغير البيئة ALGAMAL_ACTIVATION_PASSWORD
  // (دون الحاجة لحساب بصمة جديدة).
  secretHash: "24ce2f1479430a24204907d69c85796dc7ff9cf0109476df944a192e4e0df0bf",
  appVersion: "3.0.0",
} as const;

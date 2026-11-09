/**
 * بيانات الدعم الفني — خاصة بمصمم البرنامج ولا يمكن تغييرها من إعدادات العميل.
 * هذا الملف هو المصدر الوحيد لرقم الدعم في كل شاشات البرنامج.
 * رقم المحل (settings.phone) يظهر في الفواتير فقط، أما الدعم فثابت هنا دائماً.
 */
export const SUPPORT = {
  designer: "م. وائل الجمال",
  title: "الدعم الفني",
  phone: "01222355769",
  // الرقم بصيغة واتساب الدولية: نحذف الصفر ونسبق بـ 20 (مصر)
  whatsappNumber: "201222355769",
  whatsappMessage: "السلام عليكم م. وائل الجمال 👋\nأحتاج مساعدة بخصوص «الجمال للأدوات المدرسية» (دعم فني / تفعيل النسخة).",
  hours: "يومياً 9 صباحاً – 11 مساءً",
} as const;

export function whatsappUrl(message: string = SUPPORT.whatsappMessage): string {
  return `https://wa.me/${SUPPORT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function activationWhatsappUrl(installId: string): string {
  return whatsappUrl(
    `السلام عليكم م. وائل الجمال 👋\nأريد تفعيل «الجمال للأدوات المدرسية».\nكود الجهاز: ${installId}`,
  );
}

export const TEL_URL = `tel:${SUPPORT.phone}`;

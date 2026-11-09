import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // نحمّل better-sqlite3 وقت التشغيل عبر createRequire من مجلد التطبيق،
  // فلا نحتاج externalization وقت البناء (الذي يولّد أسماء aliases لا تُحل داخل حزمة EXE).
  serverExternalPackages: [],
};

export default nextConfig;

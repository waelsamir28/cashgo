import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";

const googleFonts = (
  <link
    href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&family=Almarai:wght@300;400;700;800&family=Noto+Kufi+Arabic:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap"
    rel="stylesheet"
  />
);

export const metadata: Metadata = {
  title: "الجمال للأدوات المدرسية | نظام إدارة المكتبات والقرطاسية",
  description: "نظام عربي لإدارة مبيعات ومشتريات ومخزون المكتبات والأدوات المدرسية، مع الفواتير والعملاء والتقارير والباركود.",
  icons: {
    icon: [
      { url: "/images/algamal-mark.svg", type: "image/svg+xml" },
      { url: "/images/app-icon.png", sizes: "any" },
    ],
    shortcut: "/images/app-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {googleFonts}
      </head>
      <body>{children}</body>
    </html>
  );
}

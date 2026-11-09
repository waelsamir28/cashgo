"use client";
/* eslint-disable @next/next/no-img-element */

import { fmt } from "@/lib/format";
import { getInvoiceDesign, type InvoiceDesign } from "@/lib/appearance";
import Barcode from "@/components/Barcode";
import type { StoreSettings } from "@/lib/types";

export type SheetItem = {
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
};

export type SheetInvoice = {
  invoiceNo: string;
  type: "sale" | "purchase";
  customerName: string;
  dateText: string;
  paymentType?: string;
  status?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  remaining: number;
  notes?: string;
  items: SheetItem[];
};

type Props = {
  invoice: SheetInvoice;
  settings: StoreSettings;
  customerBalance?: number;
};

const ACCENT_FALLBACK = "#0b4fa2";

export default function InvoiceSheet({ invoice, settings, customerBalance }: Props) {
  const design: InvoiceDesign = getInvoiceDesign(settings);
  const accent = design.template === "minimal" ? "#222" : design.accent || ACCENT_FALLBACK;
  const sheetStyle = {
    "--invoice-accent": accent,
    "--invoice-table": design.template === "minimal" ? "transparent" : design.tableHeader,
    fontSize: `${design.fontSize}px`,
  } as React.CSSProperties;
  const isSale = invoice.type === "sale";

  if (design.template === "modern") {
    return (
      <div className={`invoice-sheet modern ${design.paper === "thermal" ? "thermal" : "a4"}`} style={sheetStyle}>
        <div className="inv-head-modern">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {design.showLogo && <img className="t-logo" src={design.logoUrl || "/images/app-icon.png"} alt="شعار المحل" />}
            <div>
              <div className="t-title">{design.header}</div>
              <div className="t-sub">{design.subtitle}</div>
            </div>
          </div>
          <div className="t-contact">
            <div>{design.address}</div>
            <div dir="ltr">{design.phone}</div>
            {design.showTax && design.taxNumber && <div>ر.ض: {design.taxNumber}</div>}
          </div>
        </div>

        <div className="inv-meta-modern">
          <div>رقم الفاتورة<b>{invoice.invoiceNo}</b></div>
          <div>التاريخ<b>{invoice.dateText}</b></div>
          <div>{isSale ? "العميل" : "المورد"}<b>{invoice.customerName}</b></div>
          {invoice.paymentType && <div>الدفع<b>{invoice.paymentType}</b></div>}
          {invoice.status && <div>الحالة<b>{invoice.status}</b></div>}
          <div>{isSale ? "العملة" : "نوع الفاتورة"}<b>{isSale ? design.currency : "مشتريات"}</b></div>
        </div>

        <table className="invoice-sheet-table">
          <thead><tr><th>م</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>القيمة</th></tr></thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td style={{ textAlign: "right" }}>{item.productName}</td>
                <td>{item.unit}</td>
                <td>{fmt(item.quantity, 0)}</td>
                <td>{fmt(item.price, 2)}</td>
                <td>{fmt(item.discount, 2)}</td>
                <td>{fmt(item.quantity * item.price - item.discount, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-total-card">
          <div className="tc-lines">
            <div>الإجمالي: {fmt(invoice.subtotal, 2)} {design.currency}</div>
            <div>الخصم: {fmt(invoice.discount, 2)} {design.currency}</div>
            {design.showTax && <div>الضريبة: {fmt(invoice.tax, 2)} {design.currency}</div>}
            <div>المدفوع: {fmt(invoice.paid, 2)} {design.currency}</div>
            <div>المتبقي: {fmt(invoice.remaining, 2)} {design.currency}</div>
            {design.showBalance && <div>رصيد {isSale ? "العميل" : "المورد"}: {fmt(customerBalance ?? invoice.remaining, 2)} {design.currency}</div>}
          </div>
          <div className="tc-main">
            <span style={{ fontSize: 11 }}>الصافي النهائي</span>
            <span className="big">{fmt(invoice.total, 2)} {design.currency}</span>
          </div>
        </div>

        {invoice.notes && <div style={{ marginTop: 10, fontSize: 11, color: "#566b83" }}>ملاحظات: {invoice.notes}</div>}
        {design.showBarcode && (
          <div style={{ marginTop: 14 }}>
            <Barcode value={invoice.invoiceNo} width={design.paper === "thermal" ? 130 : 200} height={34} fontSize={10} color="#111" />
          </div>
        )}
        <div className="invoice-sheet-footer">{design.footer}</div>
      </div>
    );
  }

  if (design.template === "minimal") {
    return (
      <div className={`invoice-sheet minimal ${design.paper === "thermal" ? "thermal" : "a4"}`} style={sheetStyle}>
        <div className="inv-head-minimal">
          <div className="t-title">{design.header}</div>
          <div className="t-sub">{design.subtitle}</div>
          <div style={{ fontSize: 10.5, marginTop: 5, color: "#555" }}>
            {design.address} — <span dir="ltr">{design.phone}</span>
            {design.showTax && design.taxNumber ? ` — ر.ض: ${design.taxNumber}` : ""}
          </div>
        </div>

        <div className="inv-meta-minimal">
          <span>فاتورة {isSale ? "مبيعات" : "مشتريات"} رقم: <b>{invoice.invoiceNo}</b></span>
          <span>التاريخ: <b>{invoice.dateText}</b></span>
          <span>{isSale ? "العميل" : "المورد"}: <b>{invoice.customerName}</b></span>
          {invoice.paymentType && <span>الدفع: {invoice.paymentType}</span>}
        </div>

        <table className="invoice-sheet-table">
          <thead><tr><th>م</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>القيمة</th></tr></thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td style={{ textAlign: "right" }}>{item.productName}</td>
                <td>{fmt(item.quantity, 0)}</td>
                <td>{fmt(item.price, 2)}</td>
                <td>{fmt(item.discount, 2)}</td>
                <td>{fmt(item.quantity * item.price - item.discount, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-total-minimal">
          <div className="line"><span>الإجمالي</span><span>{fmt(invoice.subtotal, 2)} {design.currency}</span></div>
          <div className="line"><span>الخصم</span><span>{fmt(invoice.discount, 2)} {design.currency}</span></div>
          {design.showTax && <div className="line"><span>الضريبة</span><span>{fmt(invoice.tax, 2)} {design.currency}</span></div>}
          <div className="line"><span>المدفوع</span><span>{fmt(invoice.paid, 2)} {design.currency}</span></div>
          <div className="line"><span>المتبقي</span><span>{fmt(invoice.remaining, 2)} {design.currency}</span></div>
          {design.showBalance && <div className="line"><span>رصيد {isSale ? "العميل" : "المورد"}</span><span>{fmt(customerBalance ?? invoice.remaining, 2)} {design.currency}</span></div>}
          <div className="line" style={{ fontWeight: 900, fontSize: 15, borderTop: "2px solid #222" }}>
            <span>الصافي النهائي</span><span>{fmt(invoice.total, 2)} {design.currency}</span>
          </div>
        </div>

        {invoice.notes && <div style={{ marginTop: 10, fontSize: 11, color: "#444" }}>ملاحظات: {invoice.notes}</div>}
        {design.showBarcode && (
          <div style={{ marginTop: 12 }}>
            <Barcode value={invoice.invoiceNo} width={design.paper === "thermal" ? 120 : 180} height={30} fontSize={10} color="#111" />
          </div>
        )}
        <div className="invoice-sheet-footer">{design.footer}</div>
      </div>
    );
  }

  return (
    <div className={`invoice-sheet ${design.paper === "thermal" ? "thermal" : "a4"}`} style={sheetStyle}>
      <div className="invoice-sheet-head">
        <div className="invoice-sheet-brand">
          {design.showLogo && <img className="invoice-sheet-logo" src={design.logoUrl || "/images/app-icon.png"} alt="شعار المحل" />}
          <div>
            <div className="invoice-sheet-title">{design.header}</div>
            <div className="invoice-sheet-sub">{design.subtitle}</div>
          </div>
        </div>
        <div className="invoice-sheet-contact">
          <div>{design.address}</div>
          <div dir="ltr">{design.phone}</div>
          {design.showTax && design.taxNumber && <div>ر.ض: {design.taxNumber}</div>}
        </div>
      </div>

      <div className="invoice-sheet-meta">
        <span>رقم الفاتورة: <b>{invoice.invoiceNo}</b></span>
        <span>التاريخ: <b>{invoice.dateText}</b></span>
        <span>{isSale ? "العميل" : "المورد"}: <b>{invoice.customerName}</b></span>
        {invoice.paymentType && <span>الدفع: <b>{invoice.paymentType}</b></span>}
        {invoice.status && <span>الحالة: <b>{invoice.status}</b></span>}
      </div>

      <table className="invoice-sheet-table">
        <thead><tr><th>م</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>القيمة</th></tr></thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td style={{ textAlign: "right" }}>{item.productName}</td>
              <td>{item.unit}</td>
              <td>{fmt(item.quantity, 0)}</td>
              <td>{fmt(item.price, 2)}</td>
              <td>{fmt(item.discount, 2)}</td>
              <td>{fmt(item.quantity * item.price - item.discount, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 14 }}>
        <div style={{ fontSize: 11, lineHeight: 2, color: "#566b83" }}>
          <div>الإجمالي: {fmt(invoice.subtotal, 2)} {design.currency}</div>
          <div>الخصم: {fmt(invoice.discount, 2)} {design.currency}</div>
          {design.showTax && <div>الضريبة: {fmt(invoice.tax, 2)} {design.currency}</div>}
          <div>المدفوع: {fmt(invoice.paid, 2)} {design.currency}</div>
          <div>المتبقي: {fmt(invoice.remaining, 2)} {design.currency}</div>
          {design.showBalance && <div>رصيد {isSale ? "العميل" : "المورد"}: {fmt(customerBalance ?? invoice.remaining, 2)} {design.currency}</div>}
        </div>
        <div className="invoice-sheet-total">الصافي: {fmt(invoice.total, 2)} {design.currency}</div>
      </div>

      {design.showBarcode && (
        <div style={{ marginTop: 14 }}>
          <Barcode value={invoice.invoiceNo} width={design.paper === "thermal" ? 130 : 210} height={36} fontSize={10} color="#111" />
        </div>
      )}
      {invoice.notes && <div style={{ marginTop: 10, fontSize: 11, color: "#566b83" }}>ملاحظات: {invoice.notes}</div>}
      <div className="invoice-sheet-footer">{design.footer}</div>
    </div>
  );
}

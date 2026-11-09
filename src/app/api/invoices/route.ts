import { listInvoices, createInvoice, type InvoiceInput } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get("type") ?? undefined;
    return Response.json({ invoices: await listInvoices(type) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<InvoiceInput>(request);
    if (!body.items || body.items.length === 0) return badRequest("لا يمكن حفظ فاتورة بدون أصناف");
    return Response.json({ invoice: await createInvoice(body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ الفاتورة";
    return Response.json({ error: message }, { status: 400 });
  }
}

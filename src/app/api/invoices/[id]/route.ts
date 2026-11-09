import { getInvoice, deleteInvoice } from "@/db/local";
import { badRequest, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const id = Number((await params).id);
    if (!id) return badRequest("رقم الفاتورة غير صحيح");
    return Response.json({ invoice: await getInvoice(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر عرض الفاتورة";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const id = Number((await params).id);
    if (!id) return badRequest("رقم الفاتورة غير صحيح");
    await deleteInvoice(id);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

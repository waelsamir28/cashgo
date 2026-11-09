import { listPayments, insertPayment, deletePayment } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const customerId = Number(new URL(request.url).searchParams.get("customerId")) || undefined;
    return Response.json({ payments: await listPayments(customerId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    return Response.json({ payment: await insertPayment(body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تسجيل الدفعة";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return badRequest("رقم الدفعة غير صحيح");
    await deletePayment(id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حذف الدفعة";
    return Response.json({ error: message }, { status: 400 });
  }
}

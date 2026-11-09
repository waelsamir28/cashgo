import { getStatement } from "@/db/local";
import { badRequest, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = Number(url.searchParams.get("customerId"));
    if (!customerId) return badRequest("اختر العميل أولاً");
    return Response.json(await getStatement(customerId, url.searchParams.get("from") ?? "", url.searchParams.get("to") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحميل كشف الحساب";
    return Response.json({ error: message }, { status: 400 });
  }
}

import { pushScan } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ code?: string; source?: string; target?: string }>(request);
    const code = String(body.code ?? "").trim();
    if (!code) return badRequest("الرمز فارغ");
    return Response.json(pushScan(code, body.source ?? "phone", body.target ?? "pos"), { status: 201 });
  } catch (error) { return errorResponse(error); }
}

// يسمح للموبايل بالوصول عبر الشبكة المحلية حتى مع وجود CORS مختلف.
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

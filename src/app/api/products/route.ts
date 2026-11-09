import { listProducts, insertProduct, updateProduct, deleteProduct, getLicense } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown> & { id?: number; name?: string };

export async function GET() {
  try { return Response.json({ products: await listProducts(), license: await getLicense() }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!String(body.name ?? "").trim()) return badRequest("اسم الصنف مطلوب");
    return Response.json({ product: await insertProduct(body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ الصنف";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson<Body>(request);
    if (!body.id) return badRequest("رقم الصنف غير صحيح");
    return Response.json({ product: await updateProduct(body) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return badRequest("رقم الصنف غير صحيح");
    await deleteProduct(id);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

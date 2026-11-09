import { listCategories, insertCategory, renameCategory, deleteCategory } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ categories: await listCategories() }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<{ name?: string }>(request);
    const name = String(body.name ?? "").trim();
    if (!name) return badRequest("اكتب اسم المجموعة أولاً");
    return Response.json({ ok: true, categories: await insertCategory(name) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson<{ name?: string; newName?: string }>(request);
    const name = String(body.name ?? "").trim();
    const newName = String(body.newName ?? "").trim();
    if (!name || !newName) return badRequest("اسم المجموعة الجديد مطلوب");
    return Response.json({ ok: true, categories: name === newName ? await listCategories() : await renameCategory(name, newName) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const name = String(url.searchParams.get("name") ?? "").trim();
    const moveTo = String(url.searchParams.get("moveTo") ?? "").trim();
    if (!name) return badRequest("اسم المجموعة مطلوب");
    return Response.json({ ok: true, categories: await deleteCategory(name, moveTo) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حذف المجموعة";
    return Response.json({ error: message }, { status: 400 });
  }
}

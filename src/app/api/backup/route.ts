import { exportBackup, restoreBackup, getSettings } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json(exportBackup()); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    if (!body || typeof body !== "object") return badRequest("ملف النسخة الاحتياطية غير صالح");
    const restored = restoreBackup(body);
    return Response.json({ ok: true, restored, settings: getSettings() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استعادة النسخة";
    return Response.json({ error: message }, { status: 400 });
  }
}

import { createHash } from "node:crypto";
import { getLicense, activateLicense, setTrialPolicy } from "@/db/local";
import { LICENSE_CONFIG } from "@/lib/license-config";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** التحقق يتم هنا فقط (server-side) — كلمة السر لا تُرسل للواجهة ولا تُخزن في قاعدة البيانات. */
function isValidPassword(input: string): boolean {
  const override = process.env.ALGAMAL_ACTIVATION_PASSWORD;
  if (override && input === override) return true;
  const hash = createHash("sha256").update(input).digest("hex");
  return hash === LICENSE_CONFIG.secretHash;
}

export async function GET() {
  try {
    return Response.json({ license: await getLicense(), version: LICENSE_CONFIG.appVersion });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<{ action?: string; password?: string; days?: number; productLimit?: number }>(request);
    const password = String(body.password ?? "").trim();
    if (!password) return badRequest("أدخل كلمة سر التفعيل");
    if (!isValidPassword(password)) {
      return Response.json({ error: "كلمة سر التفعيل غير صحيحة — تواصل مع م. وائل الجمال" }, { status: 401 });
    }
    if (body.action === "policy") {
      return Response.json({ ok: true, license: await setTrialPolicy(Number(body.days) || 10, Number(body.productLimit) || 25) });
    }
    return Response.json({ ok: true, license: await activateLicense() });
  } catch (error) {
    return errorResponse(error);
  }
}

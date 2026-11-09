import { healthCheck } from "@/db/local";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await healthCheck();
    return Response.json({ ok: true, engine: "postgresql", database: "neon" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

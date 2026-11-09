import { healthCheck } from "@/db/local";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    healthCheck();
    return Response.json({ ok: true, engine: "sqlite", database: "algamal.db" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

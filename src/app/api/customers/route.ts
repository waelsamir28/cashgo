import { listCustomers, insertCustomer } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ customers: await listCustomers() }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    if (!String(body.name ?? "").trim()) return badRequest("اسم العميل مطلوب");
    return Response.json({ customer: await insertCustomer(body) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

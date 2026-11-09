import { listTickets, insertTicket } from "@/db/local";
import { badRequest, errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ tickets: listTickets() }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const name = String(body.name ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!name || !subject || !message) return badRequest("برجاء إكمال الاسم والموضوع والرسالة");
    return Response.json({ ticket: insertTicket(body) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

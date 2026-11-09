import { getInstallments } from "@/db/local";
import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json(getInstallments()); }
  catch (error) { return errorResponse(error); }
}

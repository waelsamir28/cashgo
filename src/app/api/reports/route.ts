import { getReports } from "@/db/local";
import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json(getReports()); }
  catch (error) { return errorResponse(error); }
}

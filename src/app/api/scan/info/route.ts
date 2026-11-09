import { scanInfo } from "@/lib/network";
import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json(scanInfo()); }
  catch (error) { return errorResponse(error); }
}

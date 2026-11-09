import { pollScans } from "@/db/local";
import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const target = new URL(request.url).searchParams.get("target") ?? "pos";
    return Response.json({ codes: pollScans(target) });
  } catch (error) { return errorResponse(error); }
}

import { getSettings, updateSettings } from "@/db/local";
import { errorResponse, readJson } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ settings: getSettings() }); }
  catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    return Response.json({ settings: updateSettings(body) });
  } catch (error) { return errorResponse(error); }
}

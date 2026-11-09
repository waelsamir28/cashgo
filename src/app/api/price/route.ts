import { searchProducts, findProductByCode } from "@/db/local";
import { errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (!query.trim()) return Response.json({ products: [], exact: null });
    return Response.json({
      products: await searchProducts(query),
      exact: (await findProductByCode(query)) ?? null,
    });
  } catch (error) { return errorResponse(error); }
}

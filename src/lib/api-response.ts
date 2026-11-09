export function errorResponse(error: unknown, fallback = "حدث خطأ غير متوقع") {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message || fallback }, { status: 500 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

// CORS, JSON responses and admin auth for the Worker's HTTP endpoints.

const ALLOWED_ORIGINS = new Set([
  "https://unfit.cards",
  "http://localhost:3000",
  "http://localhost:3001",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":
      origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://unfit.cards",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Constant-time bearer check. An unset or empty token rejects everything. */
export function isAuthorized(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  const given = request.headers.get("Authorization") ?? "";
  const expected = `Bearer ${token}`;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

/** decodeURIComponent that reports malformed input as null instead of throwing. */
export function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}


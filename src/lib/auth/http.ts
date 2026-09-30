import "server-only";
import { NextRequest, NextResponse } from "next/server";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}
export async function readBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 100_000) throw new Error("Permintaan terlalu besar.");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Permintaan tidak valid.");
  return parsed as Record<string, unknown>;
}

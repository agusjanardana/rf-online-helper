import { type NextRequest } from "next/server";
import { database } from "@/src/lib/supabase/server";
import { sessionHash } from "@/src/lib/auth/session";
import { json, sameOrigin, readBody } from "@/src/lib/auth/http";

async function dispatch(operation: string, payload: Record<string, unknown>) {
  const hash = await sessionHash();
  if (!hash) return json({ error: "Silakan login sebagai pengurus." }, 401);
  const { data, error } = await database().rpc("staff_gateway", {
    token_hash: hash,
    operation,
    payload,
  });
  if (error)
    return json(
      { error: error.message },
      error.code === "28000" ? 401 : error.code === "42501" ? 403 : 400,
    );
  return json(data);
}
export async function GET(request: NextRequest) {
  const op = request.nextUrl.searchParams.get("operation") ?? "guilds";
  if (!["guilds", "guild", "raid"].includes(op))
    return json({ error: "Not found" }, 404);
  try {
    return await dispatch(op, {
      guild_id: request.nextUrl.searchParams.get("guild_id"),
      raid_id: request.nextUrl.searchParams.get("raid_id"),
    });
  } catch {
    return json(
      { error: "Database belum tersedia. Periksa konfigurasi Supabase." },
      503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak valid." }, 403);
  try {
    return await dispatch("command", await readBody(request));
  } catch {
    return json(
      { error: "Permintaan gagal. Periksa konfigurasi database." },
      400,
    );
  }
}

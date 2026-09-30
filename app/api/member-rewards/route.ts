import { type NextRequest } from "next/server";
import { database, databaseConfigurationError } from "@/src/lib/supabase/server";
import { json, sameOrigin, readBody } from "@/src/lib/auth/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak valid." }, 403);
  const configurationError = databaseConfigurationError();
  if (configurationError) return json({ error: configurationError }, 503);
  let input: Record<string, unknown>;
  try {
    input = await readBody(request);
  } catch {
    return json({ error: "Permintaan pencarian tidak valid." }, 400);
  }
  try {
    const { data, error } = await database().rpc("lookup_member_rewards", {
      character_name: input.character_name,
      server_name: input.server_name,
      guild_name: input.guild_name,
      page_offset: input.page_offset ?? 0,
    });
    if (error)
      return json(
        {
          error: "Data belum bisa dimuat. Periksa nama atau hubungi pengurus.",
        },
        400,
      );
    return json(data);
  } catch {
    return json(
      {
        error:
          "Database belum dapat dihubungi. Coba lagi atau minta pengurus memeriksa koneksi database.",
      },
      503,
    );
  }
}

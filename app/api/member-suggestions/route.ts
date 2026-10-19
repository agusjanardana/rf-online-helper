import { type NextRequest } from "next/server";
import { database, databaseConfigurationError } from "@/src/lib/supabase/server";
import { json, sameOrigin, readBody } from "@/src/lib/auth/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({error: "Origin tidak valid."},403);
  let input: Record<string,unknown>;
  try { input = await readBody(request); } catch { return json({error:"Permintaan tidak valid."},400); }
  const args = {server_name:input.server_name,guild_name:input.guild_name,name_query:input.name_query};
  if (Object.values(args).some(v => typeof v !== "string" || !v.trim() || v.trim().length > 80)) return json({error:"Nama, server, dan guild wajib diisi (maksimal 80 karakter)."},400);
  const config = databaseConfigurationError();
  if (config) return json({error:config},503);
  try {
    const {data,error} = await database().rpc("member_suggestions",args);
    if (error || !Array.isArray(data)) return json({error:"Saran nama belum tersedia. Nama tetap dapat diketik manual."},503);
    return json(data);
  } catch { return json({error:"Saran nama gagal dimuat. Coba ketik ulang atau isi nama secara manual."},503); }
}

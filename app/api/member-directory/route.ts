import {
  database,
  databaseConfigurationError,
} from "@/src/lib/supabase/server";
import { json } from "@/src/lib/auth/http";

export async function GET() {
  const configurationError = databaseConfigurationError();
  if (configurationError) return json({ error: configurationError }, 503);
  try {
    const { data, error } = await database().rpc("member_directory");
    if (error || !Array.isArray(data))
      return json(
        {
          error:
            error?.code === "PGRST202" || error?.code === "42883"
              ? "Daftar server dan guild belum tersedia. Pengurus perlu menerapkan migration 005 (member_directory) di Supabase."
              : "Daftar server dan guild gagal dimuat. Coba lagi atau hubungi pengurus.",
        },
        503,
      );
    return json(data);
  } catch {
    return json(
      { error: "Daftar server dan guild gagal dimuat. Coba lagi." },
      503,
    );
  }
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

export function databaseConfigurationError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || url.includes("your-project"))
    return "Isi NEXT_PUBLIC_SUPABASE_URL di .env.local dengan Project URL API Supabase (https://<project-ref>.supabase.co).";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL harus berupa Project URL API (https://<project-ref>.supabase.co), bukan alamat koneksi PostgreSQL. Perbaiki .env.local lalu restart aplikasi.";
  }
  if (!key || key.includes("your-service-role"))
    return "Isi SUPABASE_SERVICE_ROLE_KEY di .env.local dengan service_role atau server secret key Supabase, lalu restart aplikasi.";
  if (key.startsWith("sb_publishable_"))
    return "SUPABASE_SERVICE_ROLE_KEY membutuhkan service_role atau server secret key, bukan publishable key.";
  return null;
}
export function databaseConfigured() {
  return databaseConfigurationError() === null;
}
export function database() {
  const error = databaseConfigurationError();
  if (error) throw new Error(error);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

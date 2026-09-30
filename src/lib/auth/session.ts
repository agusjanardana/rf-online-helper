import "server-only";
import { cookies } from "next/headers";
import { database, databaseConfigured } from "@/src/lib/supabase/server";
import { tokenHash } from "./password";

export const SESSION_COOKIE = "rf_staff_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export interface StaffUser {
  id: string;
  username: string;
}
export async function sessionHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? tokenHash(token) : null;
}
export async function currentUser(): Promise<StaffUser | null> {
  if (!databaseConfigured()) return null;
  const hash = await sessionHash();
  if (!hash) return null;
  const { data, error } = await database().rpc("staff_auth", {
    operation: "user",
    payload: { token_hash: hash },
  });
  if (error)
    throw new Error("Database login belum siap. Jalankan migration terbaru.");
  return data as StaffUser | null;
}

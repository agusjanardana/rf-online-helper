import { type NextRequest } from "next/server";
import { database } from "@/src/lib/supabase/server";
import {
  hashPassword,
  normalizeUsername,
  sessionToken,
  tokenHash,
  validatePassword,
  verifyPassword,
} from "@/src/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  sessionHash,
} from "@/src/lib/auth/session";
import { json, sameOrigin, readBody } from "@/src/lib/auth/http";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak valid." }, 403);
  const { action } = await params;
  if (!["login", "register", "logout"].includes(action))
    return json({ error: "Not found" }, 404);
  try {
    const db = database();
    if (action === "logout") {
      const hash = await sessionHash();
      if (hash) {
        const { error } = await db.rpc("staff_auth", {
          operation: "logout",
          payload: { token_hash: hash },
        });
        if (error) return json({ error: "Gagal keluar. Coba lagi." }, 503);
      }
      const response = json({ ok: true });
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    const input = await readBody(request);
    const username = normalizeUsername(input.username);
    const password = validatePassword(input.password);
    // Vercel overwrites this header. Other deployments share a conservative bucket
    // unless their trusted reverse proxy supplies a stable client IP.
    const ip = process.env.VERCEL
      ? (request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ??
        "unknown")
      : "local";
    const buckets = [
      tokenHash(`auth:username:${username}`),
      tokenHash(`auth:ip:${ip}`),
    ];
    for (const bucket of buckets) {
      const { data, error } = await db.rpc("staff_auth", {
        operation: "attempt",
        payload: { bucket },
      });
      if (error)
        return json(
          { error: "Database login belum siap. Jalankan migration terbaru." },
          503,
        );
      if (!data.allowed)
        return json(
          { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
          429,
        );
    }
    const token = sessionToken();
    let result;
    if (action === "register") {
      result = await db.rpc("staff_auth", {
        operation: "register",
        payload: {
          username,
          password_hash: await hashPassword(password),
          token_hash: tokenHash(token),
        },
      });
      if (result.error?.code === "23505")
        return json({ error: "Username sudah dipakai." }, 409);
    } else {
      const credentials = await db.rpc("staff_auth", {
        operation: "credentials",
        payload: { username },
      });
      if (credentials.error)
        return json({ error: "Login belum tersedia. Coba lagi nanti." }, 503);
      if (
        !(await verifyPassword(
          password,
          credentials.data?.password_hash ?? null,
        ))
      )
        return json({ error: "Username atau password salah." }, 401);
      result = await db.rpc("staff_auth", {
        operation: "session",
        payload: {
          account_id: credentials.data.id,
          token_hash: tokenHash(token),
        },
      });
    }
    if (result.error)
      return json(
        { error: "Gagal menyimpan akun atau sesi. Coba lagi nanti." },
        503,
      );
    const response = json({ user: result.data });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Permintaan tidak valid.",
      },
      400,
    );
  }
}

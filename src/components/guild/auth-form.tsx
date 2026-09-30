"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/guild-api";
import { ActionForm, Field, useWords, value } from "./ui";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "login" | "register";
  nextPath?: string;
}) {
  const w = useWords();
  const router = useRouter();
  const title =
    mode === "login"
      ? w("Login pengurus", "Officer sign in")
      : w("Daftar pengurus", "Officer registration");
  return (
    <section className="guild-shell guild-auth panel">
      <span className="eyebrow">RF NEXT GUILDS</span>
      <h1>{title}</h1>
      <p>
        {w(
          "Cukup username dan password untuk mengelola guild. Setelah daftar, kamu langsung masuk.",
          "Use a username and password to manage your guild. Registration signs you in immediately.",
        )}
      </p>
      <ActionForm
        submit={title}
        onSubmit={async (data) => {
          await api(`/api/auth/${mode}`, {
            username: value(data, "username"),
            password: String(data.get("password") ?? ""),
          });
          const next = new URLSearchParams(window.location.search).get("next");
          router.push(
            next && /^\/invites\/[a-f0-9]{64}$/.test(next) ? next : "/guilds",
          );
          router.refresh();
        }}
      >
        <Field label="Username">
          <input
            name="username"
            aria-label="Username"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_]{3,32}"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <small>
            {w(
              "3–32 karakter: huruf, angka, atau underscore.",
              "3–32 characters: letters, numbers, or underscore.",
            )}
          </small>
        </Field>
        <Field label="Password">
          <input
            name="password"
            aria-label="Password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          <small>{w("Minimal 8 karakter.", "At least 8 characters.")}</small>
        </Field>
      </ActionForm>
      <p>
        <Link href="/member">
          {w(
            "Member? Cek pembagian tanpa login →",
            "Member? Check rewards without signing in →",
          )}
        </Link>
      </p>
      <div className="guild-links">
        <Link
          href={
            nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"
          }
        >
          {w("Masuk", "Sign in")}
        </Link>
        <Link
          href={
            nextPath
              ? `/register?next=${encodeURIComponent(nextPath)}`
              : "/register"
          }
        >
          {w("Daftar pengurus", "Register as officer")}
        </Link>
      </div>
    </section>
  );
}

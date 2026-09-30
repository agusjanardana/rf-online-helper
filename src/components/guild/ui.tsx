"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { useLanguage } from "@/src/components/i18n/language-provider";

export function useWords() {
  const { locale } = useLanguage();
  return (id: string, en: string) => (locale === "id" ? id : en);
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="guild-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function ActionForm({
  children,
  submit,
  onSubmit,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  submit: string;
  onSubmit: (data: FormData) => Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const w = useWords();
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await onSubmit(data);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={`guild-form ${className}`} onSubmit={handle}>
      <fieldset disabled={busy || disabled}>
        {children}
        <button className="guild-button" type="submit">
          {busy ? w("Memproses…", "Working…") : submit}
        </button>
      </fieldset>
      {error && (
        <p className="guild-error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="guild-success" role="status">
          {w("Berhasil disimpan.", "Saved successfully.")}
        </p>
      )}
    </form>
  );
}
export function SetupNotice() {
  const w = useWords();
  return (
    <section className="guild-shell panel">
      <span className="eyebrow">SUPABASE SETUP</span>
      <h1>{w("Hubungkan Supabase", "Connect Supabase")}</h1>
      <p>
        {w(
          "Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local, jalankan migration, lalu restart aplikasi.",
          "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, apply the migration, then restart the app.",
        )}
      </p>
      <p>
        {w(
          "Panduan lengkap: docs/supabase-setup.md. Kalkulator publik tetap dapat digunakan.",
          "Full guide: docs/supabase-setup.md. Public calculators remain available.",
        )}
      </p>
    </section>
  );
}
export const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const numberValue = (data: FormData, key: string) =>
  Number(value(data, key));

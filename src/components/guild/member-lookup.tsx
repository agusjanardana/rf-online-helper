"use client";

import { ListPagination, useListPage } from "./list-pagination";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  Users,
  Gem,
  Coins,
  ChevronDown,
} from "lucide-react";
import { RewardFormula } from "./reward-formula";
import { SearchSelect } from "./search-select";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/src/lib/guild-api";
import { Field, useWords, value } from "./ui";

type Search = {
  character_name: string;
  server_name: string;
  guild_name: string;
};
type Reward = {
  is_searched: boolean;
  character_name: string;
  cp: number;
  tier: number;
  weight: number;
  diamond: number;
  idr: number;
  diamond_paid: boolean;
  idr_paid: boolean;
  diamond_paid_at: string | null;
  idr_paid_at: string | null;
};
type Result =
  | { status: "not_found" | "ambiguous" }
  | {
      status: "found";
      character_name: string;
      server_name: string;
      guild_name: string;
      members: {
        character_name: string;
        cp: number | null;
        active: boolean;
        is_officer: boolean;
        is_searched: boolean;
      }[];
      raids: { raid_name: string; raid_date: string; participants: Reward[] }[];
      has_more: boolean;
    };

export function MemberLookup() {
  const w = useWords();
  const [result, setResult] = useState<Result | null>(null);
  const rosterPage = useListPage(
    result?.status === "found" ? result.members : [],
  );
  const [search, setSearch] = useState<Search | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [directory, setDirectory] = useState<
    { server: string; guild: string }[]
  >([]);
  const [directoryBusy, setDirectoryBusy] = useState(true);
  const [directoryError, setDirectoryError] = useState("");
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [server, setServer] = useState("");
  const [guild, setGuild] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<{ server: string; guild: string }[]>("/api/member-directory")
      .then((data) => {
        if (!cancelled) setDirectory(data);
      })
      .catch((error) => {
        if (!cancelled)
          setDirectoryError(
            error instanceof Error ? error.message : "Request failed",
          );
      })
      .finally(() => {
        if (!cancelled) setDirectoryBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [directoryAttempt]);
  const servers = [...new Set(directory.map((row) => row.server))];
  const guilds = [
    ...new Set(
      directory.filter((row) => row.server === server).map((row) => row.guild),
    ),
  ];
  async function lookup(query: Search, pageOffset: number) {
    setBusy(true);
    setError("");
    setResult(null);
    rosterPage.setPage(0);
    try {
      const data = await api<Result>("/api/member-rewards", {
        ...query,
        page_offset: pageOffset,
      });
      if (!data || !["found", "not_found", "ambiguous"].includes(data.status))
        throw new Error(
          w(
            "Hasil pencarian tidak valid. Silakan coba lagi.",
            "Invalid search response. Please try again.",
          ),
        );
      if (
        data.status === "found" &&
        (!Array.isArray(data.members) ||
          !Array.isArray(data.raids) ||
          data.raids.some((raid) => !Array.isArray(raid.participants)))
      )
        throw new Error(
          w(
            "Format pembagian database belum diperbarui. Pengurus perlu menerapkan migration 004 (guild_reward_transparency) di Supabase.",
            "The database reward format is outdated. An officer must apply migration 004 (guild_reward_transparency) in Supabase.",
          ),
        );
      setResult(data);
      setSearch(query);
      setOffset(pageOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !servers.includes(server) || !guilds.includes(guild)) return;
    const data = new FormData(event.currentTarget);
    await lookup(
      {
        character_name: value(data, "character"),
        server_name: server,
        guild_name: guild,
      },
      0,
    );
  }
  function payment(amount: number, paid: boolean, at: string | null) {
    return (
      <>
        <strong>{amount.toLocaleString()}</strong>
        <small
          className={
            amount === 0
              ? "member-payment-empty"
              : paid
                ? "member-payment-paid"
                : "member-payment-unpaid"
          }
        >
          {amount === 0
            ? w("Tidak ada bagian", "No allocation")
            : paid
              ? w("Sudah dibayar", "Paid")
              : w("Belum dibayar", "Unpaid")}
          {amount > 0 && paid && at
            ? ` · ${new Date(at).toLocaleDateString()}`
            : ""}
        </small>
      </>
    );
  }
  return (
    <section className="guild-shell member-page">
      <div className="guild-heading member-hero">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={14} aria-hidden="true" /> GUILD & RAID
          </span>
          <h1>{w("Cek pembagian member", "Member reward lookup")}</h1>
          <p>
            {w(
              "Masukkan nama karakter, server, dan guild. Tidak perlu akun atau undangan.",
              "Enter your character name, server, and guild. No account or invitation needed.",
            )}
          </p>
        </div>
        <Link className="guild-button" href="/login">
          {w("Login pengurus", "Officer sign in")}
        </Link>
      </div>
      <div className="panel guild-card member-search-card">
        <div className="member-section-title">
          <span className="member-icon">
            <Search size={20} aria-hidden="true" />
          </span>
          <div>
            <h2>{w("Temukan pembagianmu", "Find your rewards")}</h2>
            <p>
              {w(
                "Pilih server dan guild, lalu masukkan nama karakter yang terdaftar.",
                "Choose a server and guild, then enter your registered character name.",
              )}
            </p>
          </div>
        </div>
        {directoryBusy && (
          <p role="status">
            {w("Memuat server dan guild…", "Loading servers and guilds…")}
          </p>
        )}
        {directoryError && (
          <div className="guild-error" role="alert">
            {directoryError}{" "}
            <button
              type="button"
              onClick={() => {
                setDirectoryError("");
                setDirectoryBusy(true);
                setDirectoryAttempt((value) => value + 1);
              }}
            >
              {w("Coba lagi", "Retry")}
            </button>
          </div>
        )}
        {!directoryBusy && !directoryError && !directory.length && (
          <p>
            {w(
              "Belum ada guild terdaftar. Pengurus dapat membuat guild setelah login.",
              "No guilds registered yet. An officer can create a guild after signing in.",
            )}
          </p>
        )}
        <form className="guild-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="guild-grid">
              <SearchSelect
                label="Server"
                options={servers}
                value={server}
                disabled={directoryBusy || !!directoryError}
                onChange={(value) => {
                  setServer(value);
                  setGuild("");
                  setResult(null);
                }}
              />
              <SearchSelect
                key={server}
                label={w("Nama guild", "Guild name")}
                options={guilds}
                value={guild}
                disabled={!server || directoryBusy}
                onChange={(value) => {
                  setGuild(value);
                  setResult(null);
                }}
              />
              <Field label={w("Nama karakter", "Character name")}>
                <input
                  name="character"
                  required
                  maxLength={80}
                  placeholder={w(
                    "Nama karakter dalam game",
                    "In-game character name",
                  )}
                  autoComplete="off"
                />
              </Field>
            </div>
            <button
              className="member-search-submit"
              type="submit"
              disabled={directoryBusy || !server || !guild}
            >
              <Search size={17} aria-hidden="true" />
              {busy
                ? w("Mencari…", "Searching…")
                : w("Lihat pembagian", "View rewards")}
            </button>
          </fieldset>
        </form>
        <p>
          {w(
            "Gunakan nama yang tercatat oleh pengurus. Huruf besar/kecil tidak berpengaruh.",
            "Use the names recorded by an officer. Capitalization does not matter.",
          )}
        </p>
      </div>
      <RewardFormula />
      {error && (
        <p className="guild-error" role="alert">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {result?.status === "not_found" && (
          <p className="guild-notice">
            {w(
              "Karakter tidak ditemukan untuk server dan guild tersebut. Periksa ketiga nama atau hubungi pengurus.",
              "Character not found in that server and guild. Check all three names or contact an officer.",
            )}
          </p>
        )}
        {result?.status === "ambiguous" && (
          <p className="guild-notice">
            {w(
              "Ada nama guild dan karakter yang sama pada server ini. Minta pengurus membedakan nama guild agar hasil tidak tertukar.",
              "More than one guild and character matches on this server. Ask an officer to distinguish the guild names so the results cannot be confused.",
            )}
          </p>
        )}
        {result?.status === "found" && (
          <div className="panel guild-card member-results">
            <h2>
              {result.guild_name} · {result.server_name}
            </h2>
            <p>
              {w(
                "Seluruh anggota dan pembagian final guild. Nama yang dicari ditandai di setiap tabel.",
                "All guild members and finalized allocations. The searched name is highlighted in each table.",
              )}
            </p>
            <div className="member-result-stats">
              <div>
                <Users size={18} aria-hidden="true" />
                <span>{w("Anggota terdaftar", "Registered members")}</span>
                <strong>{result.members.length}</strong>
              </div>
              <div>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>{w("Raid di halaman ini", "Raids on this page")}</span>
                <strong>{result.raids.length}</strong>
              </div>
              <div>
                <Search size={18} aria-hidden="true" />
                <span>{w("Nama yang dicari", "Searched character")}</span>
                <strong>{result.character_name}</strong>
              </div>
            </div>
            <details className="member-roster-disclosure member-disclosure">
              <summary className="member-disclosure-heading">
                <h3>
                  {w("Anggota guild", "Guild members")}{" "}
                  <span className="member-disclosure-count">
                    {result.members.length}
                  </span>
                </h3>
                <ChevronDown
                  className="member-disclosure-arrow"
                  size={20}
                  aria-hidden="true"
                />
              </summary>
              <p>
                {w(
                  "CP di daftar anggota adalah CP terbaru. CP, tier, dan bobot pembagian mengikuti data saat raid dikunci.",
                  "The roster shows current CP. Allocation CP, tiers, and weights reflect the locked raid snapshot.",
                )}
              </p>
              <div className="guild-table-wrap">
                <table className="guild-table member-results-table">
                  <thead>
                    <tr>
                      <th>{w("Karakter", "Character")}</th>
                      <th>CP</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPage.rows.map((member, index) => (
                      <tr
                        key={index}
                        className={
                          member.is_searched ? "member-searched" : undefined
                        }
                      >
                        <td data-label={w("Karakter", "Character")}>
                          {member.character_name}
                          {member.is_searched && (
                            <small className="member-search-badge">
                              {w("Nama yang dicari", "Searched name")}
                            </small>
                          )}
                          {member.is_officer && (
                            <small>{w("T0 · Pengurus", "T0 · Officer")}</small>
                          )}
                        </td>
                        <td data-label="CP">
                          {member.cp?.toLocaleString() ??
                            w("Belum diisi", "Not set")}
                        </td>
                        <td data-label="Status">
                          {member.active
                            ? w("Aktif", "Active")
                            : w("Diarsipkan", "Archived")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination {...rosterPage} />
            </details>
            <h3 className="member-subheading">
              {w("Pembagian raid", "Raid allocations")}
            </h3>
            {!result.raids.length && (
              <p>
                {w(
                  "Belum ada pembagian final untuk guild ini.",
                  "No finalized rewards for this guild yet.",
                )}
              </p>
            )}
            {result.raids.map((raid, index) => (
              <details
                className="member-raid member-disclosure"
                key={`${offset}-${index}`}
              >
                <summary className="member-raid-heading member-disclosure-heading">
                  <div>
                    <span className="eyebrow">
                      {raid.raid_date} · {raid.participants.length}{" "}
                      {w("peserta", "participants")}
                    </span>
                    <h4>{raid.raid_name}</h4>
                  </div>
                  <span className="member-final-badge">
                    <ShieldCheck size={14} aria-hidden="true" /> Final
                  </span>
                  <ChevronDown
                    className="member-disclosure-arrow"
                    size={20}
                    aria-hidden="true"
                  />
                </summary>
                <div className="member-raid-totals">
                  <div>
                    <Gem size={18} aria-hidden="true" />
                    <span>
                      {w("Diamond dibagikan", "Diamond distributed")}
                      <strong>
                        {raid.participants
                          .reduce((sum, row) => sum + row.diamond, 0)
                          .toLocaleString()}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <Coins size={18} aria-hidden="true" />
                    <span>
                      {w("Rupiah dibagikan", "Rupiah distributed")}
                      <strong>
                        Rp{" "}
                        {raid.participants
                          .reduce((sum, row) => sum + row.idr, 0)
                          .toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>
                <RewardFormula participants={raid.participants} />
                {!raid.participants.some((row) => row.is_searched) && (
                  <p>
                    {w(
                      "Karakter yang dicari tidak ikut raid ini.",
                      "The searched character did not participate in this raid.",
                    )}
                  </p>
                )}
                <div className="guild-table-wrap">
                  <table className="guild-table member-results-table">
                    <thead>
                      <tr>
                        <th>{w("Karakter", "Character")}</th>
                        <th>CP / Tier</th>
                        <th>Diamond</th>
                        <th>Rupiah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raid.participants.map((row, i) => (
                        <tr
                          key={i}
                          className={
                            row.is_searched ? "member-searched" : undefined
                          }
                        >
                          <td data-label={w("Karakter", "Character")}>
                            {row.character_name}
                            {row.is_searched && (
                              <small className="member-search-badge">
                                {w("Nama yang dicari", "Searched name")}
                              </small>
                            )}
                          </td>
                          <td data-label="CP / Tier">
                            {row.cp.toLocaleString()}
                            <small>
                              T{row.tier} · {w("Bobot", "Weight")}{" "}
                              {(row.weight / 100).toFixed(2)}
                            </small>
                          </td>
                          <td data-label="Diamond">
                            {payment(
                              row.diamond,
                              row.diamond_paid,
                              row.diamond_paid_at,
                            )}
                          </td>
                          <td data-label="Rupiah">
                            {payment(row.idr, row.idr_paid, row.idr_paid_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
            {search && (offset > 0 || result.has_more) && (
              <div className="guild-links">
                <button
                  disabled={busy || offset === 0}
                  onClick={() => lookup(search, offset - 10)}
                >
                  {w("Sebelumnya", "Previous")}
                </button>
                <span>
                  {w("Halaman", "Page")} {offset / 10 + 1}
                </span>
                <button
                  disabled={busy || !result.has_more}
                  onClick={() => lookup(search, offset + 10)}
                >
                  {w("Berikutnya", "Next")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

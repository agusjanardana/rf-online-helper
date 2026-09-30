"use client";
import { ListPagination, useListPage } from "./list-pagination";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/src/lib/guild-api";
import type { Guild, GuildData, RaidData } from "@/src/lib/raid/types";
import { ActionForm, Field, useWords, value } from "./ui";
import { MembersPanel, SettingsPanel } from "./management";
import { RaidPanel } from "./raid-panel";
export type Command = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<Record<string, string>>;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function GuildApp({
  path,
  username,
}: {
  path: string[];
  username: string;
}) {
  const w = useWords();
  const router = useRouter();
  const guildId = path[0];
  const tab = path[1] ?? "overview";
  const raidId = path[2];
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [data, setData] = useState<GuildData | null>(null);
  const raidPage = useListPage(data?.raids ?? []);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [raidData, setRaidData] = useState<RaidData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((r) => r + 1), []);
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const guildRows = await api<Guild[]>("/api/guild?operation=guilds");
        if (!alive) return;
        setGuilds(guildRows);
        if (!guildId) {
          setData(null);
          return;
        }
        if (
          !uuid.test(guildId) ||
          !["overview", "members", "settings", "raids"].includes(tab) ||
          (tab !== "raids" && path.length > 2) ||
          path.length > 3
        )
          throw new Error("Page not found");
        const nextData = await api<GuildData>(
          `/api/guild?operation=guild&guild_id=${guildId}`,
        );
        let nextRaid: RaidData | null = null;
        if (tab === "raids" && raidId && raidId !== "new") {
          if (
            !uuid.test(raidId) ||
            !nextData.raids.some((r) => r.id === raidId)
          )
            throw new Error("Raid not found");
          nextRaid = await api<RaidData>(
            `/api/guild?operation=raid&guild_id=${guildId}&raid_id=${raidId}`,
          );
        }
        if (alive) {
          setRaidData(nextRaid);
          setData(nextData);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [guildId, tab, raidId, refresh, path.length]);
  const command: Command = async (action, payload = {}) => {
    const result = await api<Record<string, string>>("/api/guild", {
      action,
      payload: { guild_id: guildId, ...payload },
    });
    reload();
    return result;
  };
  const root = `/guilds/${guildId}`;
  return (
    <section className="guild-shell">
      <div className="guild-heading">
        <div>
          <span className="eyebrow">RF NEXT GUILDS</span>
          <h1>
            {data && guildId ? data.guild.name : w("Guild kamu", "Your guilds")}
          </h1>
          <p>
            {data && guildId ? `${data.guild.server} · ${data.role}` : username}
          </p>
        </div>
        <div className="guild-links">
          <Link href="/member">{w("Halaman member", "Member lookup")}</Link>
          <Link href="/guilds">{w("Pilih guild", "Switch guild")}</Link>
          <button
            onClick={async () => {
              try {
                await api("/api/auth/logout", {});
                router.push("/login");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Logout failed");
              }
            }}
          >
            {w("Keluar", "Sign out")}
          </button>
        </div>
      </div>
      {guildId && (
        <nav className="guild-tabs">
          <Link href={root}>{w("Ringkasan", "Overview")}</Link>
          <Link href={`${root}/members`}>{w("Anggota", "Members")}</Link>
          <Link href={`${root}/settings`}>
            {w("Aturan & akses", "Rules & access")}
          </Link>
          <Link href={`${root}/raids`}>Raid</Link>
        </nav>
      )}
      {error ? (
        <div className="panel guild-card">
          <p className="guild-error" role="alert">
            {error}
          </p>
          <p>
            {w(
              "Pastikan migration Supabase sudah dijalankan. Jika sesi habis, masuk kembali.",
              "Make sure the Supabase migration is applied. If your session expired, sign in again.",
            )}
          </p>
          <button onClick={reload}>{w("Coba lagi", "Retry")}</button>{" "}
          <Link href="/login">{w("Masuk", "Sign in")}</Link>
        </div>
      ) : loading && !data ? (
        <p role="status">{w("Memuat data…", "Loading data…")}</p>
      ) : !guildId ? (
        <>
          <div className="guild-grid">
            {guilds.map((g) => (
              <Link
                className="panel guild-card"
                key={g.id}
                href={`/guilds/${g.id}`}
              >
                <h2>{g.name}</h2>
                <p>{g.server}</p>
                <strong>{w("Buka guild →", "Open guild →")}</strong>
              </Link>
            ))}
          </div>
          {!guilds.length && (
            <p className="guild-notice">
              {w(
                "Belum ada guild. Buat guild atau buka tautan undangan dari pengurus.",
                "No guild yet. Create one or open an invitation from your guild owner.",
              )}
            </p>
          )}
          <div className="panel guild-card">
            <h2>{w("Buat guild", "Create guild")}</h2>
            <ActionForm
              submit={w("Buat guild", "Create guild")}
              onSubmit={async (f) => {
                const result = await command("create_guild", {
                  name: value(f, "name"),
                  server: value(f, "server"),
                });
                router.push(`/guilds/${result.id}`);
              }}
            >
              <Field label={w("Nama guild", "Guild name")}>
                <input name="name" required maxLength={80} />
              </Field>
              <Field label="Server">
                <input
                  name="server"
                  required
                  maxLength={80}
                  placeholder="Anka 3"
                />
              </Field>
            </ActionForm>
          </div>
        </>
      ) : (
        data && (
          <>
            {tab === "members" && (
              <MembersPanel data={data} command={command} />
            )}
            {tab === "settings" && (
              <SettingsPanel data={data} command={command} />
            )}
            {(tab === "overview" || (tab === "raids" && !raidId)) && (
              <>
                <div className="guild-grid">
                  <div className="panel guild-card">
                    <small>{w("Karakter aktif", "Active characters")}</small>
                    <h2>{data.characters.filter((c) => c.active).length}</h2>
                  </div>
                  <div className="panel guild-card">
                    <small>Raid</small>
                    <h2>{data.raids.length}</h2>
                  </div>
                  <div className="panel guild-card">
                    <small>{w("Metode pembagian", "Split method")}</small>
                    <h2>{w("Tier CP", "CP tiers")}</h2>
                    <p>
                      {w(
                        "Tanpa poin kontribusi atau bonus T0.",
                        "No contribution points or T0 bonus.",
                      )}
                    </p>
                  </div>
                </div>
                {!data.rules.length && (
                  <p className="guild-notice">
                    {w(
                      "Owner perlu mengatur batas CP T1–T5 sebelum raid dikunci.",
                      "The owner must configure T1–T5 CP boundaries before locking a raid.",
                    )}{" "}
                    <Link href={`${root}/settings`}>
                      {w("Buka pengaturan", "Open settings")}
                    </Link>
                  </p>
                )}
                <div className="panel guild-card">
                  <div className="guild-heading">
                    <h2>{w("Riwayat raid", "Raid history")}</h2>
                    {data.role !== "member" && (
                      <Link className="guild-button" href={`${root}/raids/new`}>
                        + Raid
                      </Link>
                    )}
                  </div>
                  {!data.raids.length && (
                    <p>
                      {w(
                        "Belum ada raid yang dapat ditampilkan.",
                        "No raids available yet.",
                      )}
                    </p>
                  )}
                  <p>
                    {w(
                      "Centang kegiatan yang ingin ditampilkan di halaman member. Hanya raid final yang dapat dilihat member.",
                      "Check activities to display on the member page. Members can only view finalized raids.",
                    )}
                  </p>
                  {visibilityError && (
                    <p className="guild-error" role="alert">
                      {visibilityError}
                    </p>
                  )}
                  {raidPage.rows.map((r) => (
                    <div className="guild-list-row" key={r.id}>
                      <Link href={`${root}/raids/${r.id}`}>
                        <strong>
                          {r.name}
                          {r.revision_of ? " · revision" : ""}
                        </strong>
                        <small>
                          {r.raid_date} · {r.status}
                        </small>
                      </Link>
                      {data.role !== "member" && (
                        <label className="guild-check">
                          <input
                            type="checkbox"
                            checked={r.member_visible ?? true}
                            disabled={
                              visibilityBusy || r.member_visible === undefined
                            }
                            onChange={async (event) => {
                              const visible = event.target.checked;
                              setVisibilityBusy(true);
                              setVisibilityError("");
                              try {
                                await command("raid_member_visibility", {
                                  raid_id: r.id,
                                  member_visible: visible,
                                });
                              } catch (error) {
                                setVisibilityError(
                                  error instanceof Error
                                    ? error.message
                                    : "Request failed",
                                );
                              } finally {
                                setVisibilityBusy(false);
                              }
                            }}
                          />
                          {w("Tampilkan di member", "Show on member page")}
                        </label>
                      )}
                    </div>
                  ))}
                  {data.raids.some((r) => r.member_visible === undefined) && (
                    <p className="guild-notice">
                      {w(
                        "Terapkan migration 006 untuk mengatur kegiatan yang tampil di halaman member.",
                        "Apply migration 006 to control activities shown on the member page.",
                      )}
                    </p>
                  )}
                  <ListPagination {...raidPage} />
                </div>
                {data.role !== "member" && (
                  <details className="panel guild-card">
                    <summary>
                      {w(
                        "Riwayat perubahan (50 terbaru)",
                        "Change history (latest 50)",
                      )}
                    </summary>
                    {data.audit.map((a) => (
                      <div className="guild-audit" key={a.id}>
                        <strong>{a.action}</strong> ·{" "}
                        <time>{new Date(a.created_at).toLocaleString()}</time>
                        <small>{a.actor_id}</small>
                        <pre>{JSON.stringify(a.details, null, 2)}</pre>
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
            {tab === "raids" && raidId === "new" && data.role !== "member" && (
              <div className="panel guild-card">
                <h2>{w("Buat raid", "Create raid")}</h2>
                <ActionForm
                  submit={w("Buat draft", "Create draft")}
                  onSubmit={async (f) => {
                    const result = await command("create_raid", {
                      name: value(f, "name"),
                      raid_date: value(f, "date"),
                    });
                    router.push(`${root}/raids/${result.id}`);
                  }}
                >
                  <Field label={w("Nama kegiatan", "Event name")}>
                    <input name="name" required maxLength={120} />
                  </Field>
                  <Field label={w("Tanggal", "Date")}>
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toLocaleDateString("en-CA")}
                    />
                  </Field>
                </ActionForm>
              </div>
            )}
            {tab === "raids" &&
              raidData &&
              data.raids.find((r) => r.id === raidId) && (
                <RaidPanel
                  key={`${raidId}-${data.raids.find((r) => r.id === raidId)!.version}`}
                  guild={data}
                  raid={data.raids.find((r) => r.id === raidId)!}
                  data={raidData}
                  command={command}
                />
              )}
          </>
        )
      )}
    </section>
  );
}

"use client";
import { ListPagination, useListPage } from "./list-pagination";
import { useState } from "react";
import type { Character, GuildData } from "@/src/lib/raid/types";
import { MAX_VALUE, tierForCp } from "@/src/lib/raid/calculation";
import type { Command } from "./guild-app";
import { ActionForm, Field, numberValue, useWords, value } from "./ui";

export function MembersPanel({
  data,
  command,
}: {
  data: GuildData;
  command: Command;
}) {
  const w = useWords();
  const [editing, setEditing] = useState<Character | null>(null);
  const rosterPage = useListPage(data.characters);
  const tiers = data.rules[0]?.guild_tier_rules ?? [];
  return (
    <>
      <div className="panel guild-card">
        <h2>{w("Daftar karakter", "Character roster")}</h2>
        <p>
          {w(
            "Member cukup mencari nama karakter, server, dan guild tanpa akun. Label T0 tidak menambah bobot pembagian.",
            "Members look up their character, server, and guild without an account. The T0 label does not increase reward weight.",
          )}
        </p>
        <div className="guild-table-wrap">
          <table className="guild-table">
            <thead>
              <tr>
                <th>{w("Nama", "Name")}</th>
                <th>CP</th>
                <th>Tier</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rosterPage.rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.is_officer && (
                      <small> T0 · {w("Pengurus", "Officer")}</small>
                    )}
                  </td>
                  <td>{c.cp?.toLocaleString() ?? "—"}</td>
                  <td>
                    {tierForCp(c.cp, tiers)
                      ? `T${tierForCp(c.cp, tiers)!.tier}`
                      : "—"}
                  </td>
                  <td>
                    {c.active ? w("Aktif", "Active") : w("Arsip", "Archived")}
                  </td>
                  <td>
                    {data.role !== "member" && (
                      <button onClick={() => setEditing(c)}>
                        {w("Edit", "Edit")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination {...rosterPage} />
        {!data.characters.length && (
          <p>{w("Belum ada karakter.", "No characters yet.")}</p>
        )}
      </div>
      {data.role !== "member" && (
        <div className="panel guild-card">
          <h2>
            {editing
              ? w("Edit karakter", "Edit character")
              : w("Tambah karakter", "Add character")}
          </h2>
          <ActionForm
            key={editing?.id ?? "new"}
            submit={w("Simpan karakter", "Save character")}
            onSubmit={async (f) => {
              await command("character", {
                id: editing?.id,
                name: value(f, "name"),
                cp: value(f, "cp") === "" ? null : numberValue(f, "cp"),
                is_officer: f.has("officer"),
                user_id: editing?.user_id ?? null,
                active: f.has("active"),
              });
              setEditing(null);
            }}
          >
            <Field label={w("Nama karakter", "Character name")}>
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={editing?.name}
              />
            </Field>
            <Field
              label={w("CP (boleh kosong dulu)", "CP (may be left blank)")}
            >
              <input
                name="cp"
                type="number"
                min={0}
                max={MAX_VALUE}
                step={1}
                defaultValue={editing?.cp ?? ""}
              />
            </Field>
            <label className="guild-check">
              <input
                name="officer"
                type="checkbox"
                defaultChecked={editing?.is_officer}
              />
              {w("Label pengurus / T0", "Officer / T0 label")}
            </label>
            <label className="guild-check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              {w("Karakter aktif", "Active character")}
            </label>
          </ActionForm>
          {editing && (
            <button onClick={() => setEditing(null)}>
              {w("Batal edit", "Cancel edit")}
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function SettingsPanel({
  data,
  command,
}: {
  data: GuildData;
  command: Command;
}) {
  const w = useWords();
  const [inviteUrl, setInviteUrl] = useState("");
  const tiers = data.rules[0]?.guild_tier_rules ?? [];
  const owner = data.role === "owner";
  return (
    <>
      <div className="panel guild-card">
        <h2>{w("Aturan tier CP", "CP tier rules")}</h2>
        <p>
          {w(
            "T1 tertinggi. Tentukan minimum CP sendiri; minimum T5 harus 0. Bobot 150 berarti 1,50 bagian. Bobot harus sama atau naik menuju T1.",
            "T1 is highest. Set your own CP boundaries; T5 must start at 0. Weight 150 means 1.50 shares. Weights must stay equal or increase toward T1.",
          )}
        </p>
        <ActionForm
          submit={w("Simpan versi aturan", "Save rule version")}
          disabled={!owner}
          onSubmit={async (f) => {
            await command("settings", {
              tiers: [1, 2, 3, 4, 5].map((tier) => ({
                tier,
                min_cp: numberValue(f, `cp${tier}`),
                weight: numberValue(f, `weight${tier}`),
              })),
            });
          }}
        >
          <div className="guild-table-wrap">
            <table className="guild-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Minimum CP</th>
                  <th>{w("Bobot integer", "Integer weight")}</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((tier, i) => (
                  <tr key={tier}>
                    <td>T{tier}</td>
                    <td>
                      <input
                        aria-label={`T${tier} minimum CP`}
                        name={`cp${tier}`}
                        type="number"
                        min={0}
                        max={MAX_VALUE}
                        step={1}
                        required
                        readOnly={tier === 5}
                        defaultValue={
                          tiers.find((t) => t.tier === tier)?.min_cp ??
                          (tier === 5 ? 0 : "")
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`T${tier} weight`}
                        name={`weight${tier}`}
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        required
                        defaultValue={
                          tiers.find((t) => t.tier === tier)?.weight ??
                          [150, 130, 120, 110, 100][i]
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
        <p>
          {w(
            "Perubahan aturan tidak mengubah raid yang sudah dikunci.",
            "Rule changes do not alter already locked raids.",
          )}
        </p>
      </div>
      {owner && (
        <>
          <div className="panel guild-card">
            <h2>{w("Identitas guild", "Guild identity")}</h2>
            <ActionForm
              submit={w("Simpan", "Save")}
              onSubmit={async (f) => {
                await command("guild_identity", {
                  name: value(f, "name"),
                  server: value(f, "server"),
                });
              }}
            >
              <Field label={w("Nama guild", "Guild name")}>
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={data.guild.name}
                />
              </Field>
              <Field label="Server">
                <input
                  name="server"
                  required
                  maxLength={80}
                  defaultValue={data.guild.server}
                />
              </Field>
            </ActionForm>
          </div>
          <div className="panel guild-card">
            <h2>{w("Undang pengurus", "Invite officer")}</h2>
            <p>
              {w(
                "Undangan ini memberi akses pengurus untuk mengelola raid dan anggota. Berlaku 7 hari untuk username tujuan. Member cukup membuka halaman cek pembagian.",
                "This invitation grants officer access to manage raids and characters. It is valid for 7 days for the invited username. Members use the reward lookup page.",
              )}
            </p>
            <ActionForm
              submit={w("Buat tautan undangan", "Create invitation link")}
              onSubmit={async (f) => {
                const result = await command("invite", {
                  username: value(f, "username"),
                  role: "officer",
                });
                setInviteUrl(
                  `${window.location.origin}/invites/${result.token}`,
                );
              }}
            >
              <Field label="Username">
                <input
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]{3,32}"
                  autoCapitalize="none"
                />
              </Field>
            </ActionForm>
            {inviteUrl && (
              <Field
                label={w("Salin tautan ini sekarang", "Copy this link now")}
              >
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </Field>
            )}
            {data.invites
              .filter((i) => i.role === "officer")
              .map((i) => (
                <div className="guild-list-row" key={i.id}>
                  <span>
                    {i.username} · {i.role}
                    <small>
                      {i.revoked
                        ? w("Dicabut", "Revoked")
                        : i.accepted_at
                          ? w("Diterima", "Accepted")
                          : new Date(i.expires_at).toLocaleString()}
                    </small>
                  </span>
                  {!i.revoked && !i.accepted_at && (
                    <ActionForm
                      submit={w("Cabut", "Revoke")}
                      onSubmit={async () => {
                        await command("revoke_invite", { id: i.id });
                      }}
                    >
                      {null}
                    </ActionForm>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
      <div className="panel guild-card">
        <h2>{w("Akses pengurus", "Officer access")}</h2>
        {data.memberships
          .filter((m) => m.role !== "member")
          .map((m) => (
            <div key={m.user_id} className="guild-list-row">
              <span className="guild-id">
                {m.username ?? m.user_id}
                <small>{m.role}</small>
              </span>
              {owner && m.role !== "owner" && (
                <ActionForm
                  submit={w("Cabut akses pengurus", "Remove officer access")}
                  onSubmit={async () => {
                    await command("remove_officer", { user_id: m.user_id });
                  }}
                >
                  <label className="guild-check">
                    <input type="checkbox" required />
                    {w("Konfirmasi pencabutan akses", "Confirm access removal")}
                  </label>
                </ActionForm>
              )}
            </div>
          ))}
      </div>
      {owner && data.memberships.some((m) => m.role === "officer") && (
        <details className="panel guild-card">
          <summary>
            {w("Pindahkan kepemilikan guild", "Transfer guild ownership")}
          </summary>
          <p>
            {w(
              "Akun kamu akan menjadi pengurus. Pemilik baru mendapat kontrol atas aturan dan akses guild.",
              "Your account becomes an officer. The new owner controls guild rules and access.",
            )}
          </p>
          <ActionForm
            submit={w("Pindahkan kepemilikan", "Transfer ownership")}
            onSubmit={async (f) => {
              await command("transfer_owner", { user_id: value(f, "user_id") });
            }}
          >
            <Field label={w("Owner baru", "New owner")}>
              <select
                name="user_id"
                aria-label={w("Owner baru", "New owner")}
                required
              >
                <option value="">—</option>
                {data.memberships
                  .filter((m) => m.role === "officer")
                  .map((m) => (
                    <option value={m.user_id} key={m.user_id}>
                      {m.username ?? m.user_id}
                    </option>
                  ))}
              </select>
            </Field>
            <label className="guild-check">
              <input type="checkbox" required />
              {w(
                "Saya menyetujui perpindahan kepemilikan ini.",
                "I confirm this ownership transfer.",
              )}
            </label>
          </ActionForm>
        </details>
      )}
    </>
  );
}

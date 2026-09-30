"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Currency, GuildData, Raid, RaidData } from "@/src/lib/raid/types";
import {
  balance,
  csvCell,
  MAX_VALUE,
  splitReward,
  tierForCp,
} from "@/src/lib/raid/calculation";
import type { Command } from "./guild-app";
import { ActionForm, Field, numberValue, useWords, value } from "./ui";

export function RaidPanel({
  guild,
  raid,
  data,
  command,
}: {
  guild: GuildData;
  raid: Raid;
  data: RaidData;
  command: Command;
}) {
  const w = useWords();
  const router = useRouter();
  const canEdit = guild.role !== "member";
  const editable = canEdit && ["draft", "locked"].includes(raid.status);
  const final = ["final", "superseded"].includes(raid.status);
  const [selected, setSelected] = useState(
    data.participants.map((p) => p.character_id),
  );
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantPage, setParticipantPage] = useState(0);
  const participantPageSize = 10;
  const filteredCharacters = guild.characters.filter((c) =>
    c.name
      .toLocaleLowerCase()
      .includes(participantQuery.trim().toLocaleLowerCase()),
  );
  const participantPages = Math.max(
    1,
    Math.ceil(filteredCharacters.length / participantPageSize),
  );
  const currentParticipantPage = Math.min(
    participantPage,
    participantPages - 1,
  );
  const participantStart = currentParticipantPage * participantPageSize;
  const visibleCharacters = filteredCharacters.slice(
    participantStart,
    participantStart + participantPageSize,
  );
  const tiers = guild.rules[0]?.guild_tier_rules ?? [];
  const call = (action: string, payload: Record<string, unknown> = {}) =>
    command(action, { raid_id: raid.id, version: raid.version, ...payload });
  const names = new Map(data.participants.map((p) => [p.character_id, p.name]));
  let calculationError = "";
  const totals = { diamond: 0, idr: 0 };
  let preview: {
    character_id: string;
    amount: number;
    rounding_bonus: number;
    currency: Currency;
    id: string;
  }[] = [];
  try {
    for (const currency of ["diamond", "idr"] as const) {
      totals[currency] = balance(data.transactions, currency);
      if (raid.status === "locked")
        preview.push(
          ...splitReward(totals[currency], data.participants).map((s) => ({
            ...s,
            currency,
            id: `${s.character_id}-${currency}`,
          })),
        );
    }
  } catch (e) {
    calculationError = e instanceof Error ? e.message : "Invalid calculation";
  }
  if (final)
    preview = [...data.allocations].sort((a, b) => {
      const byName = (names.get(a.character_id) ?? "").localeCompare(
        names.get(b.character_id) ?? "",
      );
      return (
        byName ||
        (a.currency === b.currency ? 0 : a.currency === "diamond" ? -1 : 1)
      );
    });
  const changedSelection =
    [...selected].sort().join() !==
    data.participants
      .map((p) => p.character_id)
      .sort()
      .join();
  const pendingRevision = guild.raids.find(
    (r) => r.revision_of === raid.id && ["draft", "locked"].includes(r.status),
  );
  const hasPaid = data.allocations.some((a) =>
    data.payments.some((p) => p.allocation_id === a.id),
  );
  function downloadCsv() {
    const rows = [
      [
        "Guild",
        "Server",
        "Raid",
        "Date",
        "Status",
        "Character",
        "CP",
        "Tier",
        "Weight",
        "Currency",
        "Net pool",
        "Amount",
        "Rounding bonus",
        "Paid",
        "Paid at",
        "Reference",
      ],
      ...preview.map((a) => {
        const p = data.participants.find(
          (p) => p.character_id === a.character_id,
        )!;
        const payment = data.payments.find((p) => p.allocation_id === a.id);
        return [
          guild.guild.name,
          guild.guild.server,
          raid.name,
          raid.raid_date,
          raid.status,
          p.name,
          p.cp,
          p.tier,
          p.weight,
          a.currency,
          totals[a.currency],
          a.amount,
          a.rounding_bonus,
          payment?.paid ? "yes" : "no",
          payment?.paid_at ?? "",
          payment?.reference ?? "",
        ];
      }),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `raid-${raid.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="panel guild-card">
        <div className="guild-heading">
          <div>
            <h2>{raid.name}</h2>
            <p>
              {raid.raid_date} · <strong>{raid.status}</strong> · v
              {raid.version}
            </p>
          </div>
          {final && preview.length > 0 && (
            <button className="guild-button" onClick={downloadCsv}>
              {w("Ekspor CSV", "Export CSV")}
            </button>
          )}
        </div>
        <p>
          {w(
            "Bagian = hasil bersih × bobot tier ÷ total bobot peserta. Diamond dan rupiah dihitung terpisah.",
            "Share = net rewards × tier weight ÷ total participant weight. Diamond and rupiah are calculated separately.",
          )}
        </p>
        {raid.revision_of && (
          <Link href={`/guilds/${guild.guild.id}/raids/${raid.revision_of}`}>
            {w("Lihat raid versi sebelumnya", "View previous raid version")}
          </Link>
        )}
        {pendingRevision && (
          <p className="guild-notice">
            <Link
              href={`/guilds/${guild.guild.id}/raids/${pendingRevision.id}`}
            >
              {w(
                "Ada revisi tertunda. Pembayaran diblokir sampai revisi selesai atau dibatalkan.",
                "A revision is pending. Payments are blocked until it is finalized or cancelled.",
              )}
            </Link>
          </p>
        )}
        <div className="guild-grid">
          <div className="guild-stat">
            <small>{w("Diamond bersih", "Net diamond")}</small>
            <strong>
              {calculationError ? "—" : totals.diamond.toLocaleString()}
            </strong>
          </div>
          <div className="guild-stat">
            <small>{w("Rupiah bersih", "Net rupiah")}</small>
            <strong>
              {calculationError ? "—" : `Rp ${totals.idr.toLocaleString()}`}
            </strong>
          </div>
          <div className="guild-stat">
            <small>{w("Peserta", "Participants")}</small>
            <strong>{data.participants.length}</strong>
          </div>
        </div>
        {calculationError && (
          <p className="guild-error" role="alert">
            {calculationError}
          </p>
        )}
      </div>
      <div className="panel guild-card">
        <h2>{w("Peserta raid", "Raid participants")}</h2>
        {raid.status === "draft" && canEdit ? (
          <>
            <ActionForm
              submit={w("Simpan peserta", "Save participants")}
              onSubmit={async () => {
                await call("participants", { ids: selected });
              }}
            >
              <div className="raid-selection-toolbar">
                <div>
                  <strong>
                    {selected.length} {w("anggota dipilih", "members selected")}
                  </strong>
                  <p>
                    {w(
                      "Centang anggota yang ikut raid, simpan pilihan, lalu kunci CP dan peserta.",
                      "Check the members joining this raid, save your selection, then lock CP and participants.",
                    )}
                  </p>
                </div>
                <div className="guild-links">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        guild.characters
                          .filter((c) => c.active)
                          .map((c) => c.id),
                      )
                    }
                  >
                    {w(
                      "Pilih semua anggota aktif",
                      "Select all active members",
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!selected.length}
                    onClick={() => setSelected([])}
                  >
                    {w("Hapus pilihan", "Clear selection")}
                  </button>
                </div>
              </div>
              <Field label={w("Cari nama anggota", "Search member name")}>
                <input
                  type="search"
                  value={participantQuery}
                  placeholder={w(
                    "Ketik nama karakter…",
                    "Type a character name…",
                  )}
                  onChange={(event) => {
                    setParticipantQuery(event.target.value);
                    setParticipantPage(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
              </Field>
              <p className="raid-selection-note">
                {w(
                  "Pilihan tetap tersimpan saat berpindah halaman. Pilih semua dan hapus pilihan berlaku untuk seluruh halaman, termasuk di luar hasil pencarian.",
                  "Selections persist across pages. Select all and clear selection apply across all pages, including outside the search results.",
                )}
              </p>
              <div className="guild-table-wrap raid-selection-wrap">
                <table className="guild-table raid-selection-table">
                  <caption>
                    {w(
                      "Seluruh anggota guild · centang yang ikut raid",
                      "All guild members · check those joining the raid",
                    )}
                  </caption>
                  <thead>
                    <tr>
                      <th>{w("Ikut", "Join")}</th>
                      <th>{w("Nama anggota", "Member name")}</th>
                      <th>CP</th>
                      <th>Tier</th>
                      <th>{w("Bobot", "Weight")}</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCharacters.map((c) => {
                      const tier = tierForCp(c.cp, tiers);
                      const checked = selected.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={
                            checked ? "raid-participant-selected" : undefined
                          }
                        >
                          <td>
                            <input
                              id={`participant-${c.id}`}
                              type="checkbox"
                              aria-label={`${w("Ikut raid", "Join raid")}: ${c.name}`}
                              checked={checked}
                              disabled={!c.active && !checked}
                              onChange={(event) =>
                                setSelected((old) =>
                                  event.target.checked
                                    ? [...old, c.id]
                                    : old.filter((id) => id !== c.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <label htmlFor={`participant-${c.id}`}>
                              {c.name}
                            </label>
                            {c.is_officer && (
                              <small>
                                {w("T0 · Pengurus", "T0 · Officer")}
                              </small>
                            )}
                          </td>
                          <td>
                            {c.cp?.toLocaleString() ??
                              w("Belum diisi", "Not set")}
                          </td>
                          <td>{tier ? `T${tier.tier}` : "—"}</td>
                          <td>{tier ? (tier.weight / 100).toFixed(2) : "—"}</td>
                          <td>
                            {!c.active
                              ? w("Diarsipkan", "Archived")
                              : checked
                                ? w("Ikut raid", "Joining")
                                : w("Tidak ikut", "Not joining")}
                            {c.active && !tier && (
                              <small>
                                {w(
                                  "Lengkapi CP / aturan tier sebelum dikunci",
                                  "Complete CP / tier rules before locking",
                                )}
                              </small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredCharacters.length && (
                      <tr>
                        <td colSpan={6}>
                          {guild.characters.length
                            ? w(
                                "Tidak ada anggota yang cocok dengan pencarian.",
                                "No members match your search.",
                              )
                            : w(
                                "Belum ada anggota. Tambahkan anggota di halaman guild terlebih dahulu.",
                                "No members yet. Add members on the guild page first.",
                              )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <nav
                className="raid-participant-pagination"
                aria-label={w("Halaman anggota raid", "Raid member pages")}
              >
                <span role="status">
                  {filteredCharacters.length ? participantStart + 1 : 0}–
                  {Math.min(
                    participantStart + participantPageSize,
                    filteredCharacters.length,
                  )}{" "}
                  {w("dari", "of")} {filteredCharacters.length}{" "}
                  {w("anggota", "members")}
                </span>
                <div className="guild-links">
                  <button
                    type="button"
                    disabled={currentParticipantPage === 0}
                    onClick={() =>
                      setParticipantPage(currentParticipantPage - 1)
                    }
                  >
                    {w("Sebelumnya", "Previous")}
                  </button>
                  <span>
                    {w("Halaman", "Page")} {currentParticipantPage + 1} /{" "}
                    {participantPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentParticipantPage + 1 >= participantPages}
                    onClick={() =>
                      setParticipantPage(currentParticipantPage + 1)
                    }
                  >
                    {w("Berikutnya", "Next")}
                  </button>
                </div>
              </nav>
              {guild.characters.some((c) => !c.active) && (
                <p className="raid-selection-note">
                  {w(
                    "Anggota arsip tetap ditampilkan. Aktifkan kembali di halaman anggota sebelum mengikutkannya dalam raid.",
                    "Archived members remain visible. Reactivate them on the members page before including them in the raid.",
                  )}
                </p>
              )}
            </ActionForm>
            <ActionForm
              submit={w("Kunci CP & peserta", "Lock CP & participants")}
              disabled={
                changedSelection || !data.participants.length || !tiers.length
              }
              onSubmit={async () => {
                await call("lock");
              }}
            >
              <p>
                {changedSelection
                  ? w(
                      "Simpan pilihan peserta dahulu.",
                      "Save your participant selection first.",
                    )
                  : w(
                      "CP, tier, aturan, dan urutan pembulatan disimpan saat dikunci.",
                      "CP, tiers, rules, and rounding order are captured when locked.",
                    )}
              </p>
            </ActionForm>
          </>
        ) : (
          <div className="guild-table-wrap">
            <table className="guild-table">
              <thead>
                <tr>
                  <th>{w("Nama", "Name")}</th>
                  <th>CP</th>
                  <th>Tier</th>
                  <th>{w("Bobot", "Weight")}</th>
                  <th>{w("Urutan sisa", "Remainder order")}</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((p) => (
                  <tr key={p.character_id}>
                    <td>{p.name}</td>
                    <td>{p.cp?.toLocaleString() ?? "—"}</td>
                    <td>{p.tier ? `T${p.tier}` : "—"}</td>
                    <td>{p.weight ? (p.weight / 100).toFixed(2) : "—"}</td>
                    <td>{p.tie_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && raid.status === "locked" && (
          <details className="raid-unlock-participants">
            <summary>
              {w("Buka kembali peserta", "Unlock participants")}
            </summary>
            <p>
              {w(
                "Peserta dan CP sudah dikunci. Buka kunci dengan alasan untuk kembali ke tabel pilihan seluruh anggota.",
                "Participants and CP are locked. Unlock with a reason to return to the full member selection table.",
              )}
            </p>
            <ActionForm
              submit={w("Buka kunci", "Unlock")}
              onSubmit={async (f) => {
                await call("unlock", { reason: value(f, "reason") });
              }}
            >
              <Field label={w("Alasan", "Reason")}>
                <input name="reason" required maxLength={500} />
              </Field>
            </ActionForm>
          </details>
        )}
      </div>
      <div className="panel guild-card">
        <h2>{w("Pemasukan & potongan", "Income & deductions")}</h2>
        <p>
          {w(
            "Catat pajak hanya jika belum dipotong. Untuk penjualan diamond, gunakan konversi agar tidak dihitung dua kali.",
            "Record tax only if it has not already been deducted. Use conversion for diamond sales to avoid double counting.",
          )}
        </p>
        {data.transactions.map((t) => (
          <div key={t.id} className="guild-list-row">
            <span>
              {t.label}
              {t.conversion_id && (
                <small>
                  {w(
                    "Transaksi konversi terkait",
                    "Linked conversion transaction",
                  )}
                </small>
              )}
            </span>
            <strong>
              {t.kind === "deduction" ? "−" : "+"}
              {t.amount.toLocaleString()} {t.currency === "idr" ? "Rp" : "💎"}
            </strong>
            {editable && (
              <ActionForm
                submit={w("Hapus", "Remove")}
                onSubmit={async () => {
                  await call("delete_transaction", { id: t.id });
                }}
              >
                {null}
              </ActionForm>
            )}
          </div>
        ))}
        {!data.transactions.length && (
          <p>{w("Belum ada transaksi.", "No transactions yet.")}</p>
        )}
        {editable && (
          <>
            <ActionForm
              submit={w("Tambah transaksi", "Add transaction")}
              onSubmit={async (f) => {
                await call("transaction", {
                  currency: value(f, "currency"),
                  kind: value(f, "kind"),
                  amount: numberValue(f, "amount"),
                  label: value(f, "label"),
                });
              }}
            >
              <Field label={w("Keterangan", "Description")}>
                <input name="label" required maxLength={200} />
              </Field>
              <div className="guild-grid">
                <Field label={w("Mata uang", "Currency")}>
                  <select name="currency">
                    <option value="diamond">Diamond</option>
                    <option value="idr">Rupiah</option>
                  </select>
                </Field>
                <Field label={w("Jenis", "Type")}>
                  <select name="kind">
                    <option value="income">{w("Pemasukan", "Income")}</option>
                    <option value="deduction">
                      {w(
                        "Potongan / kas / biaya",
                        "Deduction / treasury / fee",
                      )}
                    </option>
                  </select>
                </Field>
                <Field label={w("Jumlah", "Amount")}>
                  <input
                    name="amount"
                    required
                    type="number"
                    min={1}
                    max={MAX_VALUE}
                    step={1}
                  />
                </Field>
              </div>
            </ActionForm>
            <details>
              <summary>
                {w(
                  "Catat penjualan diamond menjadi rupiah",
                  "Record a diamond sale for rupiah",
                )}
              </summary>
              <ActionForm
                submit={w("Simpan konversi", "Save conversion")}
                onSubmit={async (f) => {
                  await call("conversion", {
                    diamond: numberValue(f, "diamond"),
                    idr: numberValue(f, "idr"),
                  });
                }}
              >
                <Field label={w("Diamond keluar", "Diamond sold")}>
                  <input
                    name="diamond"
                    required
                    type="number"
                    min={1}
                    max={MAX_VALUE}
                    step={1}
                  />
                </Field>
                <Field
                  label={w("Rupiah bersih diterima", "Net rupiah received")}
                >
                  <input
                    name="idr"
                    required
                    type="number"
                    min={1}
                    max={MAX_VALUE}
                    step={1}
                  />
                </Field>
              </ActionForm>
            </details>
          </>
        )}
      </div>
      {(raid.status === "locked" || final) && (
        <div className="panel guild-card">
          <h2>
            {final
              ? w("Hasil pembagian", "Reward allocations")
              : w("Simulasi pembagian", "Split preview")}
          </h2>
          <p>
            {w(
              "Sisa pembulatan diberikan ke pecahan terbesar. Jika sama, gunakan urutan peserta yang diundi saat dikunci.",
              "Remainders go to the largest fractional shares. Ties use the participant order drawn when the raid was locked.",
            )}
          </p>
          <div className="guild-table-wrap">
            <table className="guild-table">
              <thead>
                <tr>
                  <th>{w("Nama", "Name")}</th>
                  <th>{w("Mata uang", "Currency")}</th>
                  <th>{w("Diterima", "Receives")}</th>
                  <th>{w("Sisa +1", "Rounding +1")}</th>
                  <th>{w("Pembayaran", "Payment")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((a) => {
                  const payment = data.payments.find(
                    (p) => p.allocation_id === a.id,
                  );
                  return (
                    <tr key={a.id}>
                      <td>{names.get(a.character_id)}</td>
                      <td>{a.currency === "idr" ? "Rp" : "Diamond"}</td>
                      <td>
                        <strong>{a.amount.toLocaleString()}</strong>
                      </td>
                      <td>{a.rounding_bonus}</td>
                      <td>
                        {a.amount === 0 ? (
                          "—"
                        ) : payment?.paid ? (
                          <>
                            {w("Sudah dibayar", "Paid")}
                            <small>
                              {payment.paid_at &&
                                new Date(payment.paid_at).toLocaleString()}{" "}
                              · {payment.reference}
                            </small>
                          </>
                        ) : (
                          w("Belum dibayar", "Unpaid")
                        )}
                        {canEdit &&
                          raid.status === "final" &&
                          a.amount > 0 &&
                          !pendingRevision && (
                            <details>
                              <summary>
                                {w("Catat pembayaran", "Record payment")}
                              </summary>
                              <ActionForm
                                submit={
                                  payment?.paid
                                    ? w(
                                        "Batalkan tanda dibayar",
                                        "Reverse payment mark",
                                      )
                                    : w("Tandai dibayar", "Mark paid")
                                }
                                onSubmit={async (f) => {
                                  await call("payment", {
                                    allocation_id: a.id,
                                    paid: !payment?.paid,
                                    reference: value(f, "reference"),
                                    reason: value(f, "reason"),
                                  });
                                }}
                              >
                                {payment?.paid ? (
                                  <Field
                                    label={w(
                                      "Alasan koreksi",
                                      "Correction reason",
                                    )}
                                  >
                                    <input
                                      name="reason"
                                      required
                                      maxLength={500}
                                    />
                                  </Field>
                                ) : (
                                  <Field
                                    label={w(
                                      "Catatan / referensi transfer",
                                      "Note / transfer reference",
                                    )}
                                  >
                                    <input name="reference" maxLength={500} />
                                  </Field>
                                )}
                              </ActionForm>
                            </details>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canEdit && raid.status === "locked" && (
            <ActionForm
              disabled={!!calculationError}
              submit={w("Finalisasi pembagian", "Finalize allocations")}
              onSubmit={async () => {
                await call("finalize");
              }}
            >
              <label className="guild-check">
                <input type="checkbox" required />
                {w(
                  "Saya sudah memeriksa peserta, potongan, dan nominal pembagian.",
                  "I have reviewed participants, deductions, and allocations.",
                )}
              </label>
            </ActionForm>
          )}
        </div>
      )}
      {canEdit && raid.status === "final" && !hasPaid && !pendingRevision && (
        <details className="panel guild-card">
          <summary>
            {w("Buat revisi pembagian", "Create allocation revision")}
          </summary>
          <ActionForm
            submit={w("Buat revisi", "Create revision")}
            onSubmit={async (f) => {
              const result = await call("revise", {
                reason: value(f, "reason"),
              });
              router.push(`/guilds/${guild.guild.id}/raids/${result.id}`);
            }}
          >
            <Field label={w("Alasan revisi", "Revision reason")}>
              <input name="reason" required maxLength={500} />
            </Field>
          </ActionForm>
        </details>
      )}
      {editable && raid.revision_of && (
        <details className="panel guild-card">
          <summary>{w("Batalkan revisi ini", "Cancel this revision")}</summary>
          <ActionForm
            submit={w("Batalkan revisi", "Cancel revision")}
            onSubmit={async (f) => {
              await call("cancel_revision", { reason: value(f, "reason") });
            }}
          >
            <Field label={w("Alasan", "Reason")}>
              <input name="reason" required maxLength={500} />
            </Field>
          </ActionForm>
        </details>
      )}
      {final && (
        <p className="guild-notice">
          {w(
            "Transfer dilakukan pengurus di luar aplikasi. Status ini merupakan pencatatan, bukan bukti transfer otomatis.",
            "Transfers are made by officers outside the app. These statuses are records, not automatic transfer confirmations.",
          )}
        </p>
      )}
    </>
  );
}

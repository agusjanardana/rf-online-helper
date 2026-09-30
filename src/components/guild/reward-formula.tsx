"use client";

import { Calculator, ArrowRight } from "lucide-react";
import { useWords } from "./ui";

type Share = {
  is_searched: boolean;
  character_name: string;
  weight: number;
  diamond: number;
  idr: number;
};

export function RewardFormula({ participants }: { participants?: Share[] }) {
  const w = useWords();
  const totalWeight =
    participants?.reduce((sum, row) => sum + row.weight, 0) ?? 0;
  const selected = participants?.find((row) => row.is_searched);
  if (participants)
    return (
      <details className="member-calculation">
        <summary>
          <Calculator size={16} aria-hidden="true" />
          {w("Lihat perhitungan raid ini", "View this raid’s calculation")}
        </summary>
        <div>
          <p>
            {w("Total bobot peserta", "Total participant weight")}:{" "}
            <strong>
              {(totalWeight / 100).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </strong>
            .{" "}
            {w(
              "Nominal bersih di bawah adalah total alokasi final seluruh peserta, dihitung terpisah untuk setiap mata uang.",
              "The net amount below is the sum of all finalized participant allocations, calculated separately for each currency.",
            )}
          </p>
          {selected && totalWeight > 0 ? (
            <>
              <h5>
                {w("Perhitungan untuk", "Calculation for")}{" "}
                {selected.character_name}
              </h5>
              {(["diamond", "idr"] as const).map((currency) => {
                const total = participants.reduce(
                  (sum, row) => sum + row[currency],
                  0,
                );
                const base = Number(
                  (BigInt(total) * BigInt(selected.weight)) /
                    BigInt(totalWeight),
                );
                const bonus = selected[currency] - base;
                return (
                  <div className="member-equation" key={currency}>
                    <span>{currency === "diamond" ? "Diamond" : "Rupiah"}</span>
                    <p>
                      {total.toLocaleString()} × ({selected.weight / 100} ÷{" "}
                      {totalWeight / 100}){" "}
                      <ArrowRight size={14} aria-hidden="true" />{" "}
                      {base.toLocaleString()}{" "}
                      {w("dibulatkan ke bawah", "rounded down")}
                    </p>
                    <strong>
                      {base.toLocaleString()} + {bonus.toLocaleString()}{" "}
                      {w("sisa pembulatan", "rounding remainder")} ={" "}
                      {selected[currency].toLocaleString()}
                    </strong>
                  </div>
                );
              })}
            </>
          ) : (
            <p>
              {w(
                "Gunakan bobot masing-masing peserta pada tabel untuk menghitung bagiannya dengan rumus yang sama.",
                "Use each participant’s table weight to calculate their share with the same formula.",
              )}
            </p>
          )}
        </div>
      </details>
    );
  return (
    <aside className="member-formula" aria-labelledby="member-formula-title">
      <div className="member-section-title">
        <span className="member-icon">
          <Calculator size={20} aria-hidden="true" />
        </span>
        <div>
          <span className="eyebrow">{w("TRANSPARANSI", "TRANSPARENCY")}</span>
          <h2 id="member-formula-title">
            {w("Bagaimana bagian dihitung?", "How are rewards calculated?")}
          </h2>
        </div>
      </div>
      <div className="member-formula-main">
        <span>{w("Bagian awal member", "Initial member share")}</span>
        <strong>
          {w("Saldo bersih", "Net balance")} ×{" "}
          <span className="member-fraction">
            <span>{w("Bobot tier member", "Member tier weight")}</span>
            <span>
              {w("Total bobot peserta raid", "Total raid participant weight")}
            </span>
          </span>
        </strong>
      </div>
      <ol className="member-formula-steps">
        <li>
          <strong>{w("CP menentukan tier", "CP determines tier")}</strong>
          <p>
            {w(
              "CP saat raid dikunci menentukan tier 1–5 dan bobot sesuai aturan guild. T0 adalah label pengurus; bagiannya tetap mengikuti tier CP.",
              "CP when the raid is locked determines tiers 1–5 and their guild-defined weights. T0 labels officers; their allocation still follows their CP tier.",
            )}
          </p>
        </li>
        <li>
          <strong>
            {w("Bagikan saldo bersih", "Distribute the net balance")}
          </strong>
          <p>
            {w(
              "Saldo bersih = pemasukan − pengurangan yang dicatat pada raid. Diamond dan rupiah dihitung terpisah. Hanya peserta raid yang masuk total bobot.",
              "Net balance = recorded raid income − deductions. Diamond and rupiah are calculated separately. Only raid participants contribute to the total weight.",
            )}
          </p>
        </li>
        <li>
          <strong>
            {w(
              "Sisa pembulatan tetap dibagikan",
              "Rounding remainders are distributed",
            )}
          </strong>
          <p>
            {w(
              "Setiap bagian dibulatkan ke bawah. Sisa unit dibagikan satu per satu, mulai dari pecahan terbesar. Jika sama, urutan peserta saat raid dikunci menjadi penentu.",
              "Each share is rounded down. Remaining units go one at a time to the largest fractional remainders. Ties use the participant order saved when the raid was locked.",
            )}
          </p>
        </li>
      </ol>
      <p className="member-formula-example">
        <strong>{w("Contoh", "Example")}:</strong> 12.000 diamond × (1,50 ÷
        4,00) = <strong>4.500 diamond</strong>.{" "}
        {w(
          "Bobot di contoh hanya ilustrasi; perhitungan tiap raid tersedia pada hasil pencarian.",
          "These example weights are illustrative; each raid’s calculation is available in the search results.",
        )}
      </p>
    </aside>
  );
}

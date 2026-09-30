import type { Participant, Tier, Transaction, Currency } from "./types.ts";
export const MAX_VALUE = 1_000_000_000_000;
export function tierForCp(cp: number | null, tiers: Tier[]) {
  if (cp === null || !Number.isSafeInteger(cp) || cp < 0 || cp > MAX_VALUE)
    return null;
  return (
    [...tiers]
      .sort((a, b) => b.min_cp - a.min_cp)
      .find((tier) => cp >= tier.min_cp) ?? null
  );
}
export function balance(transactions: Transaction[], currency: Currency) {
  const total = transactions
    .filter((t) => t.currency === currency)
    .reduce((sum, t) => {
      if (
        !Number.isSafeInteger(t.amount) ||
        t.amount <= 0 ||
        t.amount > MAX_VALUE
      )
        throw new Error("Invalid transaction amount");
      return sum + BigInt(t.kind === "income" ? t.amount : -t.amount);
    }, BigInt(0));
  if (total < BigInt(0) || total > BigInt(MAX_VALUE))
    throw new Error("Net balance must be between 0 and 1,000,000,000,000");
  return Number(total);
}
export function splitReward(total: number, participants: Participant[]) {
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_VALUE)
    throw new Error("Invalid balance");
  if (!participants.length || participants.length > 500)
    throw new Error("Select 1–500 participants");
  if (
    new Set(participants.map((p) => p.character_id)).size !==
      participants.length ||
    new Set(participants.map((p) => p.tie_order)).size !== participants.length
  )
    throw new Error("Duplicate participant or rounding order");
  for (const p of participants)
    if (
      !p.weight ||
      !Number.isSafeInteger(p.weight) ||
      p.weight < 1 ||
      p.weight > 100_000
    )
      throw new Error("Lock participants with valid weights first");
  const denominator = participants.reduce(
    (sum, p) => sum + BigInt(p.weight!),
    BigInt(0),
  );
  const shares = participants.map((p) => {
    const numerator = BigInt(total) * BigInt(p.weight!);
    return {
      character_id: p.character_id,
      amount: Number(numerator / denominator),
      remainder: numerator % denominator,
      order: p.tie_order,
      rounding_bonus: 0,
    };
  });
  const left = total - shares.reduce((sum, s) => sum + s.amount, 0);
  const ranked = [...shares].sort((a, b) =>
    a.remainder === b.remainder
      ? a.order - b.order
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; i < left; i++) {
    ranked[i].amount++;
    ranked[i].rounding_bonus = 1;
  }
  return shares.map(({ character_id, amount, rounding_bonus }) => ({
    character_id,
    amount,
    rounding_bonus,
  }));
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}

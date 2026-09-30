import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balance,
  csvCell,
  MAX_VALUE,
  splitReward,
  tierForCp,
} from "./calculation.ts";
import type { Participant, Transaction } from "./types.ts";
const participant = (
  id: string,
  weight: number,
  order: number,
): Participant => ({
  character_id: id,
  name: id,
  cp: 0,
  tier: 1,
  weight,
  tie_order: order,
});
const people = [
  participant("A", 150, 1),
  participant("B", 150, 2),
  participant("C", 100, 3),
];
test("CP boundaries and invalid CP", () => {
  const tiers = [
    { tier: 1, min_cp: 100, weight: 150 },
    { tier: 5, min_cp: 0, weight: 100 },
  ];
  assert.equal(tierForCp(100, tiers)?.tier, 1);
  assert.equal(tierForCp(99, tiers)?.tier, 5);
  for (const cp of [null, -1, 1.5, Infinity, MAX_VALUE + 1])
    assert.equal(tierForCp(cp, tiers), null);
});
test("agreed 12000 example", () => {
  assert.deepEqual(
    splitReward(12000, people).map((p) => p.amount),
    [4500, 4500, 3000],
  );
});
test("largest remainder, with stable locked tie order", () => {
  const equal = [
    participant("A", 100, 3),
    participant("B", 100, 1),
    participant("C", 100, 2),
  ];
  assert.deepEqual(
    splitReward(2, equal).map((p) => p.amount),
    [0, 1, 1],
  );
  assert.deepEqual(splitReward(2, equal), splitReward(2, equal));
  assert.deepEqual(
    splitReward(1, people).map((p) => p.amount),
    [1, 0, 0],
  );
});
test("integer arithmetic preserves totals even beyond safe intermediate multiplication", () => {
  const roster = Array.from({ length: 500 }, (_, i) =>
    participant(String(i), 100000 - i, i),
  );
  for (const total of [0, 1, 7, 10001, MAX_VALUE]) {
    const result = splitReward(total, roster);
    assert.equal(
      result.reduce((sum, p) => sum + p.amount, 0),
      total,
    );
    assert.ok(
      result.every((p) => Number.isSafeInteger(p.amount) && p.amount >= 0),
    );
  }
  assert.equal(
    splitReward(MAX_VALUE, [participant("A", 1, 1)])[0].amount,
    MAX_VALUE,
  );
});
test("invalid participants and amounts are rejected", () => {
  for (const total of [-1, 0.5, NaN, Infinity, MAX_VALUE + 1])
    assert.throws(() => splitReward(total, people));
  assert.throws(() => splitReward(1, []));
  assert.throws(() => splitReward(1, [participant("A", 0, 1)]));
  assert.throws(() =>
    splitReward(1, [participant("A", 1, 1), participant("A", 1, 2)]),
  );
  assert.throws(() =>
    splitReward(1, [participant("A", 1, 1), participant("B", 1, 1)]),
  );
});
test("currency balances and sale conversion do not count diamond twice", () => {
  const tx = (
    currency: "diamond" | "idr",
    kind: "income" | "deduction",
    amount: number,
  ): Transaction => ({
    id: "x",
    currency,
    kind,
    amount,
    label: "test",
    conversion_id: null,
  });
  const transactions = [
    tx("diamond", "income", 10000),
    tx("diamond", "deduction", 800),
    tx("diamond", "deduction", 9200),
    tx("idr", "income", 150000),
  ];
  assert.equal(balance(transactions, "diamond"), 0);
  assert.equal(balance(transactions, "idr"), 150000);
  assert.throws(() => balance([tx("diamond", "deduction", 1)], "diamond"));
  assert.throws(() =>
    balance([tx("idr", "income", MAX_VALUE), tx("idr", "income", 1)], "idr"),
  );
});
test("CSV escapes quotes and spreadsheet formulas", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
});

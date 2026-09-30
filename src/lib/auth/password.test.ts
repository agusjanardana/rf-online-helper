import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  normalizeUsername,
  sessionToken,
  tokenHash,
  validatePassword,
  verifyPassword,
} from "./password.ts";

test("username is case insensitive, bounded, and excludes reserved legacy names", () => {
  assert.equal(normalizeUsername("  Rihoko_3 "), "rihoko_3");
  for (const input of [
    null,
    "ab",
    "a".repeat(33),
    "bad name",
    "a@example.com",
    "legacy_owner",
  ])
    assert.throws(() => normalizeUsername(input));
});
test("password whitespace is preserved and length is bounded", () => {
  assert.equal(validatePassword("  password  "), "  password  ");
  for (const input of [null, "short", "x".repeat(129)])
    assert.throws(() => validatePassword(input));
});
test("salted scrypt verifies exact passwords and rejects wrong/missing credentials", async () => {
  const a = await hashPassword("CorrectPassword!1");
  const b = await hashPassword("CorrectPassword!1");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("CorrectPassword!1", a));
  assert.equal(await verifyPassword("WrongPassword!1", a), false);
  assert.equal(await verifyPassword("CorrectPassword!1", null), false);
  assert.equal(await verifyPassword("CorrectPassword!1", "malformed"), false);
  assert.ok(!a.includes("CorrectPassword"));
});
test("sessions have random opaque tokens and stable one-way hashes", () => {
  const a = sessionToken(),
    b = sessionToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  assert.equal(tokenHash(a), tokenHash(a));
  assert.notEqual(tokenHash(a), a);
});

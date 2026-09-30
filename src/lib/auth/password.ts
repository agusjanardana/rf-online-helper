import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

export function normalizeUsername(input: unknown): string {
  if (typeof input !== "string") throw new Error("Username wajib diisi.");
  const username = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username) || username.startsWith("legacy_")) {
    throw new Error(
      "Username harus 3–32 karakter: huruf, angka, atau underscore.",
    );
  }
  return username;
}
export function validatePassword(input: unknown): string {
  if (typeof input !== "string" || input.length < 8 || input.length > 128) {
    throw new Error("Password harus 8–128 karakter.");
  }
  return input;
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(validatePassword(password), salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  const valid =
    stored !== null && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored);
  const [, salt, expected] = valid
    ? stored.split("$")
    : ["scrypt", "0".repeat(32), "0".repeat(128)];
  // Unknown usernames take the same expensive hashing path as valid accounts.
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && valid;
}
export function sessionToken() {
  return randomBytes(32).toString("hex");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

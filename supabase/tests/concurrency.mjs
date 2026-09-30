import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile);
const url = process.env.RF_TEST_DATABASE_URL;
if (!url) throw new Error("Set RF_TEST_DATABASE_URL to a disposable test database");
const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
let user;
let guild;
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
async function sql(query) {
  return (await exec("psql", [url, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query])).stdout.trim();
}
async function command(action, payload) {
  const output = await sql(`begin; set local role service_role; select public.staff_gateway(${quote(token)},'command',${quote(JSON.stringify({action,payload}))}::jsonb); commit;`);
  return JSON.parse(output);
}
try {
  const account = JSON.parse(await sql(`select public.staff_auth('register',${quote(JSON.stringify({username: "test_" + randomUUID().replaceAll("-", "").slice(0,20), password_hash: "scrypt$" + "1".repeat(32) + "$" + "2".repeat(128), token_hash:token}))}::jsonb)`));
  user = account.id;
  guild = (await command("create_guild", { name: "Concurrency test", server: "Local" })).id;
  await command("settings", { guild_id: guild, tiers: [1,2,3,4,5].map((tier) => ({tier, min_cp: (5-tier)*100, weight: 100})) });
  const character = randomUUID();
  await command("character", { guild_id: guild, id: character, name: "Test", cp: 500 });
  const raid = (await command("create_raid", { guild_id: guild, name: "Parallel finalization", raid_date: "2026-09-30" })).id;
  await command("participants", { guild_id: guild, raid_id: raid, version: 0, ids: [character] });
  await command("lock", { guild_id: guild, raid_id: raid, version: 1 });
  await command("transaction", { guild_id: guild, raid_id: raid, version: 2, currency: "diamond", kind: "income", amount: 12000, label: "Loot" });
  const payload = { guild_id: guild, raid_id: raid, version: 3 };
  const results = await Promise.allSettled([command("finalize", payload), command("finalize", payload)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.match(results.find((r) => r.status === "rejected").reason.stderr, /Data changed/);
  assert.equal(await sql(`select count(*)||':'||sum(amount) from public.raid_allocations where raid_id='${raid}'`), "2:12000");
  console.log("PASS: two concurrent finalizations produce one result; the stale request is rejected");
} finally {
  if (guild) {
    await sql(`begin;
      delete from public.raid_payments where guild_id='${guild}';
      delete from public.raid_allocations where guild_id='${guild}';
      delete from public.raid_transactions where guild_id='${guild}';
      delete from public.raid_participants where guild_id='${guild}';
      delete from public.raids where guild_id='${guild}';
      delete from public.guild_tier_rules where rule_id in (select id from public.guild_rule_versions where guild_id='${guild}');
      delete from public.guild_rule_versions where guild_id='${guild}';
      delete from public.guild_characters where guild_id='${guild}';
      delete from public.guild_invites where guild_id='${guild}';
      delete from public.audit_logs where guild_id='${guild}';
      delete from public.guild_memberships where guild_id='${guild}';
      delete from public.guilds where id='${guild}';
      delete from public.profiles where id='${user}';
      delete from private.staff_sessions where account_id='${user}';
      delete from private.staff_accounts where id='${user}';
      commit;`);
  } else if (user) await sql(`delete from private.staff_sessions where account_id='${user}'; delete from public.profiles where id='${user}'; delete from private.staff_accounts where id='${user}';`);
}

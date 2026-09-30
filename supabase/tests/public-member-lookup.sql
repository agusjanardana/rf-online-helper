-- Run after both migrations. Uses a disposable local Auth schema; rolls back fixtures.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-0000-0000-000000000001','lookup-owner@example.test',now()),
 ('30000000-0000-0000-0000-000000000002','lookup-legacy@example.test',now()),
 ('30000000-0000-0000-0000-000000000003','lookup-officer@example.test',now());
create function pg_temp.expect_failure(query text) returns void language plpgsql as $$
begin
 begin execute query; exception when others then return; end;
 raise exception 'Expected rejection but succeeded: %',query;
end $$;
-- Construct two guilds with the same character/server but different guild names.
insert into public.guilds(id,name,server,owner_id) values
 ('31000000-0000-0000-0000-000000000001','Lookup Guild','Anka 3','30000000-0000-0000-0000-000000000001'),
 ('31000000-0000-0000-0000-000000000002','Other Guild','Anka 3','30000000-0000-0000-0000-000000000001');
insert into public.guild_memberships values
 ('31000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','owner'),
 ('31000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','member'),
 ('31000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','owner');
insert into public.guild_characters(id,guild_id,name,cp) values
 ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Rihoko',900),
 ('32000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','Another Player',500),
 ('32000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000002','Rihoko',800),
 ('32000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000001','New Member',0);
insert into public.raids(id,guild_id,name,raid_date,status,finalized_at) values
 ('33000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Final Raid','2026-09-30','final',now()),
 ('33000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','Secret Draft','2026-09-30','draft',null),
 ('33000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','Old Version','2026-09-30','superseded',now()),
 ('33000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000002','Other Raid','2026-09-30','final',now());
insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tier,weight,tie_order) values
 ('31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','Rihoko',400,1,150,1),
 ('31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000002','Another Player',500,1,150,2),
 ('31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001','Rihoko',400,1,150,1),
 ('31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000003','32000000-0000-0000-0000-000000000001','Rihoko',400,1,150,1),
 ('31000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000004','32000000-0000-0000-0000-000000000003','Rihoko',800,1,150,1);
insert into public.raid_allocations(id,guild_id,raid_id,character_id,currency,amount,rounding_bonus) values
 ('34000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','diamond',4500,0),
 ('34000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','idr',100000,0),
 ('34000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000002','diamond',9999,0),
 ('34000000-0000-0000-0000-000000000004','31000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000004','32000000-0000-0000-0000-000000000003','diamond',8888,0);
insert into public.raid_payments(allocation_id,guild_id,recorded_by,paid_at,reference) values
 ('34000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',now(),'PRIVATE BANK REFERENCE');
set local role anon;
do $$ declare r jsonb; begin
 r:=public.lookup_member_rewards('  rIHoko  ',' anka 3 ',' lookup guild ');
 assert r->>'status'='found', 'Case-insensitive trimmed lookup';
 assert jsonb_array_length(r->'rows')=1, 'Only current final raids';
 assert r#>>'{rows,0,diamond}'='4500' and r#>>'{rows,0,idr}'='100000', 'Correct own allocation';
 assert r#>>'{rows,0,cp}'='400', 'CP snapshot, not updated roster CP';
 assert r#>>'{rows,0,diamond_paid}'='true' and r#>>'{rows,0,idr_paid}'='false', 'Per-currency payment state';
 assert r::text not like '%PRIVATE BANK%' and r::text not like '%Another Player%' and r::text not like '%Secret Draft%' and r::text not like '%Old Version%', 'No unrelated or private data';
 assert public.lookup_member_rewards('Rihoko','Anka 3','Other Guild')#>>'{rows,0,diamond}'='8888', 'Guild names scope results';
 assert public.lookup_member_rewards('Rihoko','Wrong Server','Lookup Guild')->>'status'='not_found', 'Wrong server does not match';
 assert public.lookup_member_rewards('Rih%','Anka 3','Lookup Guild')->>'status'='not_found', 'Wildcards are literal';
 assert public.lookup_member_rewards('New Member','Anka 3','Lookup Guild')->'rows'='[]'::jsonb, 'Existing character with no final raids';
 perform pg_temp.expect_failure('select public.lookup_member_rewards('''',''Anka 3'',''Lookup Guild'')');
 perform pg_temp.expect_failure('select public.lookup_member_rewards(''Rihoko'',''Anka 3'',''Lookup Guild'',-1)');
 perform pg_temp.expect_failure('select * from public.guilds');
 perform pg_temp.expect_failure('select * from public.raid_allocations');
 perform pg_temp.expect_failure('select public.guild_command(''create_guild'',''{"name":"Unauthorized","server":"No"}'')');
 perform pg_temp.expect_failure('select private.guild_command(''create_guild'',''{"name":"Unauthorized","server":"No"}'')');
end $$;
reset role;
-- Identical guild/character names must never choose an arbitrary result.
update public.guilds set name='Lookup Guild' where id='31000000-0000-0000-0000-000000000002';
set local role anon;
do $$ begin assert public.lookup_member_rewards('Rihoko','Anka 3','Lookup Guild')->>'status'='ambiguous'; end $$;
reset role;
update public.guilds set name='Other Guild' where id='31000000-0000-0000-0000-000000000002';
-- Legacy logged-in members lose private dashboard access.
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
do $$ begin
 assert (select count(*)=0 from public.guilds), 'Legacy member cannot read private guilds';
 perform pg_temp.expect_failure('select public.guild_command(''character'',''{"guild_id":"31000000-0000-0000-0000-000000000001","name":"No","cp":1}'')');
 assert public.lookup_member_rewards('Rihoko','Anka 3','Lookup Guild')->>'status'='found', 'Public lookup also works while signed in';
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
do $$ declare t text; begin
 perform pg_temp.expect_failure('select public.guild_command(''invite'',''{"guild_id":"31000000-0000-0000-0000-000000000001","email":"member@example.test","role":"member"}'')');
 perform pg_temp.expect_failure('select public.guild_command(''transfer_owner'',''{"guild_id":"31000000-0000-0000-0000-000000000001","user_id":"30000000-0000-0000-0000-000000000002"}'')');
 t:=public.guild_command('invite','{"guild_id":"31000000-0000-0000-0000-000000000001","email":"lookup-legacy@example.test","role":"officer"}')->>'token';
 perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
 perform public.guild_command('accept_invite',jsonb_build_object('token',t));
 assert private.guild_role('31000000-0000-0000-0000-000000000001')='officer', 'Explicit officer invitation upgrades legacy membership';
 perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
 perform public.guild_command('remove_officer','{"guild_id":"31000000-0000-0000-0000-000000000001","user_id":"30000000-0000-0000-0000-000000000002"}');
 perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
 assert private.guild_role('31000000-0000-0000-0000-000000000001') is null, 'Officer removal revokes access';
end $$;
reset role;
-- Pagination: additional finalized raids appear once, never more than 25 per page.
insert into public.raids(guild_id,name,raid_date,status,finalized_at)
 select '31000000-0000-0000-0000-000000000001','History '||n,'2026-09-29','final',now() from generate_series(1,26) n;
insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tier,weight,tie_order)
 select guild_id,id,'32000000-0000-0000-0000-000000000001','Rihoko',400,1,150,1 from public.raids where name like 'History %';
set local role anon;
do $$ declare a jsonb; b jsonb; begin
 a:=public.lookup_member_rewards('Rihoko','Anka 3','Lookup Guild',0);
 b:=public.lookup_member_rewards('Rihoko','Anka 3','Lookup Guild',25);
 assert jsonb_array_length(a->'rows')=25 and a->>'has_more'='true';
 assert jsonb_array_length(b->'rows')=2 and b->>'has_more'='false';
 assert not exists(select 1 from jsonb_array_elements(a->'rows') x join jsonb_array_elements(b->'rows') y on x.value->>'raid_name'=y.value->>'raid_name');
 raise notice 'PASS: public lookup, exact identity tuple, CP snapshots, payments, private-field isolation, ambiguity, pagination, staff-only invitations and legacy access';
end $$;
rollback;

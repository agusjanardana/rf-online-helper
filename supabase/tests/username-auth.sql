-- Run after all migrations in disposable PostgreSQL. No Auth service required.
\set ON_ERROR_STOP on
begin;
create function pg_temp.expect_failure(query text) returns void language plpgsql as $$
begin
 begin execute query; exception when others then return; end;
 raise exception 'Expected rejection but succeeded: %',query;
end $$;
set local role service_role;
do $$
declare owner_id uuid; officer_id uuid; g uuid; raid uuid; c uuid:=gen_random_uuid(); invitation text; result jsonb; hash text:='scrypt$'||repeat('1',32)||'$'||repeat('2',128); n integer;
begin
 result:=public.staff_auth('register',jsonb_build_object('username','test_owner','password_hash',hash,'token_hash',repeat('a',64)));
 owner_id:=(result->>'id')::uuid;
 assert result->>'username'='test_owner';
 assert public.staff_auth('user',jsonb_build_object('token_hash',repeat('a',64)))->>'id'=owner_id::text;
 assert public.staff_auth('user',jsonb_build_object('token_hash',repeat('b',64)))='null'::jsonb;
 perform pg_temp.expect_failure(format('select public.staff_auth(''register'',%L::jsonb)',jsonb_build_object('username','test_owner','password_hash',hash,'token_hash',repeat('b',64))));
 perform pg_temp.expect_failure('select public.staff_auth(''register'',''{"username":"legacy_stolen","password_hash":"bad"}'')');
 result:=public.staff_auth('register',jsonb_build_object('username','test_officer','password_hash',hash,'token_hash',repeat('b',64)));
 officer_id:=(result->>'id')::uuid;
 result:=public.staff_gateway(repeat('a',64),'command','{"action":"create_guild","payload":{"name":"Username Guild","server":"Anka 3"}}'); g:=(result->>'id')::uuid;
 assert jsonb_array_length(public.staff_gateway(repeat('a',64),'guilds'))=1;
 assert public.staff_gateway(repeat('b',64),'guilds')='[]'::jsonb;
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''guild'',%L::jsonb)',repeat('b',64),jsonb_build_object('guild_id',g)));
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''command'',%L::jsonb)',repeat('c',64),jsonb_build_object('action','character','payload',jsonb_build_object('guild_id',g,'name','Bad'))));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','settings','payload',jsonb_build_object('guild_id',g,'tiers','[{"tier":1,"min_cp":400,"weight":150},{"tier":2,"min_cp":300,"weight":130},{"tier":3,"min_cp":200,"weight":120},{"tier":4,"min_cp":100,"weight":110},{"tier":5,"min_cp":0,"weight":100}]'::jsonb)));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','character','payload',jsonb_build_object('guild_id',g,'id',c,'name','Solo Member','cp',500)));
 result:=public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','create_raid','payload',jsonb_build_object('guild_id',g,'name','Custom auth raid','raid_date','2026-09-30'))); raid:=(result->>'id')::uuid;
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','participants','payload',jsonb_build_object('guild_id',g,'raid_id',raid,'version',0,'ids',jsonb_build_array(c))));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','lock','payload',jsonb_build_object('guild_id',g,'raid_id',raid,'version',1)));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','transaction','payload',jsonb_build_object('guild_id',g,'raid_id',raid,'version',2,'currency','diamond','kind','income','amount',12000,'label','Loot')));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','finalize','payload',jsonb_build_object('guild_id',g,'raid_id',raid,'version',3)));
 result:=public.staff_gateway(repeat('a',64),'raid',jsonb_build_object('guild_id',g,'raid_id',raid));
 assert jsonb_array_length(result->'allocations')=2;
 assert public.lookup_member_rewards('Solo Member','Anka 3','Username Guild')#>>'{raids,0,participants,0,diamond}'='12000';
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''command'',%L::jsonb)',repeat('a',64),jsonb_build_object('action','invite','payload',jsonb_build_object('guild_id',g,'username','test_officer','role','member'))));
 result:=public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','invite','payload',jsonb_build_object('guild_id',g,'username','TEST_OFFICER','role','officer'))); invitation:=result->>'token';
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''command'',%L::jsonb)',repeat('a',64),jsonb_build_object('action','accept_invite','payload',jsonb_build_object('token',invitation))));
 perform public.staff_gateway(repeat('b',64),'command',jsonb_build_object('action','accept_invite','payload',jsonb_build_object('token',invitation)));
 result:=public.staff_gateway(repeat('b',64),'guild',jsonb_build_object('guild_id',g));
 assert result->>'role'='officer';
 assert result->'invites'='[]'::jsonb;
 assert result::text not like '%password_hash%';
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''command'',%L::jsonb)',repeat('b',64),jsonb_build_object('action','guild_identity','payload',jsonb_build_object('guild_id',g,'name','Unauthorized','server','No'))));
 perform public.staff_gateway(repeat('a',64),'command',jsonb_build_object('action','remove_officer','payload',jsonb_build_object('guild_id',g,'user_id',officer_id)));
 assert public.staff_gateway(repeat('b',64),'guilds')='[]'::jsonb;
 perform public.staff_auth('logout',jsonb_build_object('token_hash',repeat('b',64)));
 assert public.staff_auth('user',jsonb_build_object('token_hash',repeat('b',64)))='null'::jsonb;
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''guilds'')',repeat('b',64)));
 for n in 1..20 loop assert public.staff_auth('attempt',jsonb_build_object('bucket',repeat('c',64)))->>'allowed'='true'; end loop;
 assert public.staff_auth('attempt',jsonb_build_object('bucket',repeat('c',64)))->>'allowed'='false';
end $$;
reset role;
update private.staff_sessions set expires_at=now()-interval '1 second' where token_hash=repeat('a',64);
set local role service_role;
do $$ begin
 assert public.staff_auth('user',jsonb_build_object('token_hash',repeat('a',64)))='null'::jsonb;
 perform pg_temp.expect_failure(format('select public.staff_gateway(%L,''guilds'')',repeat('a',64)));
end $$;
set local role anon;
do $$ begin
 assert public.lookup_member_rewards('Solo Member','Anka 3','Username Guild')#>>'{raids,0,participants,0,diamond}'='12000';
 perform pg_temp.expect_failure('select * from private.staff_accounts');
 perform pg_temp.expect_failure('select * from private.staff_sessions');
 perform pg_temp.expect_failure('select * from public.guilds');
 perform pg_temp.expect_failure('select public.staff_auth(''credentials'',''{"username":"test_owner"}'')');
 perform pg_temp.expect_failure('select public.staff_gateway(repeat(''a'',64),''guilds'')');
 perform pg_temp.expect_failure('select private.guild_command(''create_guild'',''{"name":"Bad","server":"Bad"}'')');
end $$;
set local role authenticated;
do $$ begin
 perform pg_temp.expect_failure('select * from public.guilds');
 perform pg_temp.expect_failure('select public.staff_auth(''credentials'',''{"username":"test_owner"}'')');
 perform pg_temp.expect_failure('select public.staff_gateway(repeat(''a'',64),''guilds'')');
 raise notice 'PASS: custom registration/session lifecycle, isolation, username invites, raid finalization, public member lookup, expiry, revocation, throttling, no Supabase Auth access';
end $$;
rollback;

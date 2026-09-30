-- Run after migration in a disposable local database. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000000000001','owner@example.test',now()),
 ('10000000-0000-0000-0000-000000000002','member@example.test',now()),
 ('10000000-0000-0000-0000-000000000003','outsider@example.test',now()),
 ('10000000-0000-0000-0000-000000000004','unverified@example.test',null);
create function pg_temp.expect_failure(query text) returns void language plpgsql as $$
begin
 begin execute query; exception when others then return; end;
 raise exception 'Expected rejection but succeeded: %',query;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare g uuid; other_g uuid; r uuid; rev uuid; c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); c3 uuid:=gen_random_uuid(); token text; x jsonb; aid uuid; orig jsonb; version integer;
begin
 x:=public.guild_command('create_guild','{"name":"Test Guild","server":"Anka 3"}'); g:=(x->>'id')::uuid;
 assert (select count(*)=1 from public.guild_memberships where guild_id=g and role='owner'), 'Creator must be owner';
 perform public.guild_command('settings',jsonb_build_object('guild_id',g,'tiers','[{"tier":1,"min_cp":400,"weight":150},{"tier":2,"min_cp":300,"weight":130},{"tier":3,"min_cp":200,"weight":120},{"tier":4,"min_cp":100,"weight":110},{"tier":5,"min_cp":0,"weight":100}]'::jsonb));
 perform pg_temp.expect_failure(format('select public.guild_command(''settings'',%L::jsonb)',jsonb_build_object('guild_id',g,'tiers','[{"tier":1,"min_cp":0,"weight":150}]'::jsonb)));
 perform public.guild_command('character',jsonb_build_object('guild_id',g,'id',c1,'name','A','cp',400,'is_officer',true));
 perform public.guild_command('character',jsonb_build_object('guild_id',g,'id',c2,'name','B','cp',500));
 perform public.guild_command('character',jsonb_build_object('guild_id',g,'id',c3,'name','C','cp',0));
 x:=public.guild_command('create_raid',jsonb_build_object('guild_id',g,'name','Example raid','raid_date','2026-09-30')); r:=(x->>'id')::uuid;
 perform pg_temp.expect_failure(format('select public.guild_command(''lock'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',r,'version',0)));
 perform public.guild_command('participants',jsonb_build_object('guild_id',g,'raid_id',r,'version',0,'ids',jsonb_build_array(c1,c2,c3)));
 perform pg_temp.expect_failure(format('select public.guild_command(''lock'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',r,'version',0)));
 perform public.guild_command('lock',jsonb_build_object('guild_id',g,'raid_id',r,'version',1));
 assert (select weight=150 and tier=1 from public.raid_participants where raid_id=r and character_id=c1), 'T0 must not add weight';
 perform public.guild_command('character',jsonb_build_object('guild_id',g,'id',c1,'name','A edited','cp',0));
 assert (select cp=400 and name='A' from public.raid_participants where raid_id=r and character_id=c1), 'Locked CP/name must not change';
 perform public.guild_command('transaction',jsonb_build_object('guild_id',g,'raid_id',r,'version',2,'currency','diamond','kind','income','amount',12000,'label','Loot'));
 perform public.guild_command('transaction',jsonb_build_object('guild_id',g,'raid_id',r,'version',3,'currency','idr','kind','income','amount',2,'label','Rounding test'));
 perform public.guild_command('finalize',jsonb_build_object('guild_id',g,'raid_id',r,'version',4));
 assert (select sum(amount)=12000 from public.raid_allocations where raid_id=r and currency='diamond'), 'Diamond conservation';
 assert (select sum(amount)=2 from public.raid_allocations where raid_id=r and currency='idr'), 'IDR conservation';
 assert (select amount=4500 from public.raid_allocations where raid_id=r and character_id=c1 and currency='diamond'), 'A share';
 assert (select amount=4500 from public.raid_allocations where raid_id=r and character_id=c2 and currency='diamond'), 'B share';
 assert (select amount=3000 from public.raid_allocations where raid_id=r and character_id=c3 and currency='diamond'), 'C share';
 perform pg_temp.expect_failure(format('select public.guild_command(''finalize'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',r,'version',4)));
 perform pg_temp.expect_failure(format('update public.raid_allocations set amount=999 where raid_id=%L',r));
 select jsonb_agg(to_jsonb(p) order by character_id) into orig from public.raid_participants p where raid_id=r;
 x:=public.guild_command('invite',jsonb_build_object('guild_id',g,'email','member@example.test','role','officer')); token:=x->>'token';
 -- Wrong email cannot accept and cannot see the guild.
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
 assert (select count(*)=0 from public.guilds where id=g), 'Cross guild read';
 assert (select count(*)=0 from public.raid_allocations where raid_id=r), 'Cross guild allocation read';
 perform pg_temp.expect_failure(format('select public.guild_command(''accept_invite'',%L::jsonb)',jsonb_build_object('token',token)));
 perform pg_temp.expect_failure(format('select public.guild_command(''character'',%L::jsonb)',jsonb_build_object('guild_id',g,'name','Intruder','cp',1)));
 x:=public.guild_command('create_guild','{"name":"Other Guild","server":"Other"}'); other_g:=(x->>'id')::uuid;
 perform pg_temp.expect_failure(format('select public.guild_command(''character'',%L::jsonb)',jsonb_build_object('guild_id',other_g,'id',c1,'name','Steal','cp',1)));
 -- Invited officers can read results but cannot change owner settings.
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
 perform public.guild_command('accept_invite',jsonb_build_object('token',token));
 assert (select count(*)=1 from public.guilds where id=g), 'Invited member visibility';
 assert (select count(*)=6 from public.raid_allocations where raid_id=r), 'Member final allocation visibility';
 perform pg_temp.expect_failure(format('select public.guild_command(''accept_invite'',%L::jsonb)',jsonb_build_object('token',token)));
 perform pg_temp.expect_failure(format('select public.guild_command(''guild_identity'',%L::jsonb)',jsonb_build_object('guild_id',g,'name','Unauthorized','server','No')));
 perform pg_temp.expect_failure(format('update public.guild_memberships set role=''owner'' where guild_id=%L',g));
 -- Revisions preserve old records and prevent payment races.
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
 x:=public.guild_command('revise',jsonb_build_object('guild_id',g,'raid_id',r,'version',5,'reason','Correct CP')); rev:=(x->>'id')::uuid;
 select id into aid from public.raid_allocations where raid_id=r and currency='diamond' limit 1;
 perform pg_temp.expect_failure(format('select public.guild_command(''payment'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',r,'version',6,'allocation_id',aid,'paid',true)));
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
 assert (select count(*)=1 from public.raids where id=rev), 'Officer can see draft';
 assert (select count(*)=3 from public.raid_participants where raid_id=rev), 'Officer can see draft children';
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
 perform public.guild_command('lock',jsonb_build_object('guild_id',g,'raid_id',rev,'version',0));
 perform public.guild_command('finalize',jsonb_build_object('guild_id',g,'raid_id',rev,'version',1));
 assert (select status='superseded' from public.raids where id=r), 'Previous final archived';
 assert (select jsonb_agg(to_jsonb(p) order by character_id)=orig from public.raid_participants p where raid_id=r), 'Old snapshot preserved';
 select id into aid from public.raid_allocations where raid_id=rev and currency='diamond' limit 1;
 perform public.guild_command('payment',jsonb_build_object('guild_id',g,'raid_id',rev,'version',2,'allocation_id',aid,'paid',true,'reference','manual transfer'));
 perform pg_temp.expect_failure(format('select public.guild_command(''revise'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',rev,'version',3,'reason','Forbidden paid revision')));
 perform pg_temp.expect_failure(format('select public.guild_command(''payment'',%L::jsonb)',jsonb_build_object('guild_id',g,'raid_id',rev,'version',3,'allocation_id',aid,'paid',false)));
 -- Conversion: sold diamond no longer appears in the pool.
 x:=public.guild_command('create_raid',jsonb_build_object('guild_id',g,'name','Conversion','raid_date','2026-09-30')); r:=(x->>'id')::uuid;
 perform public.guild_command('participants',jsonb_build_object('guild_id',g,'raid_id',r,'version',0,'ids',jsonb_build_array(c1)));
 perform public.guild_command('lock',jsonb_build_object('guild_id',g,'raid_id',r,'version',1));
 perform public.guild_command('transaction',jsonb_build_object('guild_id',g,'raid_id',r,'version',2,'currency','diamond','kind','income','amount',100,'label','Loot'));
 perform public.guild_command('conversion',jsonb_build_object('guild_id',g,'raid_id',r,'version',3,'diamond',100,'idr',1000));
 perform public.guild_command('finalize',jsonb_build_object('guild_id',g,'raid_id',r,'version',4));
 assert (select sum(amount)=0 from public.raid_allocations where raid_id=r and currency='diamond'), 'Sold diamond excluded';
 assert (select sum(amount)=1000 from public.raid_allocations where raid_id=r and currency='idr'), 'Sale proceeds included';
 -- Owner transfer is atomic; former owner cannot change rules/roles afterwards.
 perform public.guild_command('transfer_owner',jsonb_build_object('guild_id',g,'user_id','10000000-0000-0000-0000-000000000002'));
 assert (select role='officer' from public.guild_memberships where guild_id=g and user_id='10000000-0000-0000-0000-000000000001'), 'Old owner demoted';
 perform pg_temp.expect_failure(format('select public.guild_command(''invite'',%L::jsonb)',jsonb_build_object('guild_id',g,'email','x@example.test','role','officer')));
 assert (select count(*)>15 from public.audit_logs where guild_id=g), 'Mutations are audited';
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
 perform pg_temp.expect_failure('select public.guild_command(''create_guild'',''{"name":"No","server":"No"}'')');
 raise notice 'PASS: lifecycle, CP snapshots, exact totals, revisions, payments, conversion, invitations, owner transfer, RLS, direct-write protection';
end $$;
rollback;

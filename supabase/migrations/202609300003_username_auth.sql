-- Username/password accounts owned by this application. No Supabase Auth or SMTP.
-- Apply after migrations 001 and 002. Existing raid data and account IDs are preserved.
begin;
create table private.staff_accounts (
 id uuid primary key default gen_random_uuid(), username text not null unique check(username ~ '^[a-z0-9_]{3,32}$'),
 password_hash text, created_at timestamptz not null default now()
);
create table private.staff_sessions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), account_id uuid not null references private.staff_accounts(id),
 expires_at timestamptz not null default now()+interval '7 days'
);
create index staff_sessions_expiry on private.staff_sessions(expires_at);
create table private.auth_attempts (
 bucket text primary key, attempts integer not null, window_start timestamptz not null
);
revoke all on private.staff_accounts,private.staff_sessions,private.auth_attempts from public,anon,authenticated;
-- Legacy Supabase accounts get reserved usernames and disabled passwords. No automatic
-- password migration or account takeover by matching an email/username is possible.
insert into private.staff_accounts(id,username)
 select id,'legacy_'||substr(replace(id::text,'-',''),1,24) from auth.users;
do $$ declare c record; begin
 for c in select con.conname,con.conrelid::regclass as tbl,a.attname
 from pg_constraint con join pg_class t on t.oid=con.conrelid
 join pg_namespace n on n.oid=t.relnamespace
 join pg_attribute a on a.attrelid=t.oid and a.attnum=con.conkey[1]
 where con.contype='f' and con.confrelid='auth.users'::regclass and n.nspname='public' loop
 execute format('alter table %s drop constraint %I',c.tbl,c.conname);
 execute format('alter table %s add constraint %I foreign key (%I) references private.staff_accounts(id)',c.tbl,c.conname,c.attname);
 end loop;
end $$;
update public.guild_invites set revoked=true where accepted_at is null;
alter table public.guild_invites rename column email to username;
create function private.current_staff_id() returns uuid language sql stable set search_path='' as $$
 select nullif(current_setting('rf.staff_id',true),'')::uuid
$$;
create or replace function private.guild_role(g uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.guild_memberships where guild_id=g and user_id=private.current_staff_id() and role in ('owner','officer')
$$;
create or replace function private.guild_command(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid := private.current_staff_id(); g uuid; eid uuid; rid uuid; rule uuid; role_name text; token text; reason text;
 r public.raids%rowtype; inv public.guild_invites%rowtype; a public.raid_allocations%rowtype;
 item jsonb; n integer; previous_cp bigint := -1; previous_weight integer := 0;
 total bigint; weights bigint; money text; result jsonb := '{}'; before_data jsonb := '{}';
begin
 if u is null or not exists(select 1 from private.staff_accounts where id=u) then
 raise exception 'Sign in first'; end if;
 insert into public.profiles(id,display_name) values(u,(select username from private.staff_accounts where id=u)) on conflict do nothing;
 reason := trim(coalesce(payload->>'reason',''));
 if action='create_guild' then
 insert into public.guilds(name,server,owner_id) values(trim(payload->>'name'),trim(payload->>'server'),u) returning id into g;
 insert into public.guild_memberships values(g,u,'owner');
 result := jsonb_build_object('id',g);
 elsif action='accept_invite' then
 select * into inv from public.guild_invites where token_hash=encode(sha256(convert_to(payload->>'token','UTF8')),'hex');
 if inv.id is null then raise exception 'Invalid invitation'; end if;
 g:=inv.guild_id;
 perform 1 from public.guilds where id=g for update;
 select * into inv from public.guild_invites where id=inv.id for update;
 if inv.revoked or inv.accepted_at is not null or inv.expires_at<=now() or
 inv.username <> (select username from private.staff_accounts where id=u) then raise exception 'Invitation expired, used, revoked, or username does not match'; end if;
 insert into public.guild_memberships values(g,u,inv.role) on conflict do nothing;
 update public.guild_invites set accepted_at=now() where id=inv.id;
 result:=jsonb_build_object('id',g);
 else
 g:=(payload->>'guild_id')::uuid;
 -- Serialize guild mutations, including permission changes and revision/payment races.
 perform 1 from public.guilds where id=g for update;
 role_name:=private.guild_role(g);
 if role_name is null or role_name not in ('owner','officer') then raise exception 'Access denied'; end if;
 if action in ('settings','invite','revoke_invite','role','transfer_owner','guild_identity') and role_name<>'owner' then raise exception 'Owner access required'; end if;
 if action='character' then
 select to_jsonb(c) into before_data from public.guild_characters c where id=nullif(payload->>'id','')::uuid and guild_id=g;
 elsif action in ('guild_identity','transfer_owner','role') then
 select jsonb_build_object('guild',to_jsonb(x),'memberships',(select jsonb_agg(to_jsonb(m)) from public.guild_memberships m where m.guild_id=g)) into before_data from public.guilds x where x.id=g;
 end if;
 case action
 when 'guild_identity' then
 update public.guilds set name=trim(payload->>'name'),server=trim(payload->>'server') where id=g;
 when 'invite' then
 if lower(trim(payload->>'username')) !~ '^[a-z0-9_]{3,32}$' then raise exception 'Invalid username'; end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.guild_invites(guild_id,username,role,token_hash) values(g,lower(trim(payload->>'username')),payload->>'role',encode(sha256(convert_to(token,'UTF8')),'hex')) returning id into eid;
 result:=jsonb_build_object('token',token);
 when 'revoke_invite' then
 update public.guild_invites set revoked=true where id=(payload->>'id')::uuid and guild_id=g;
 when 'role' then
 if payload->>'role' not in ('officer','member') then raise exception 'Invalid role'; end if;
 update public.guild_memberships set role=payload->>'role' where guild_id=g and user_id=(payload->>'user_id')::uuid and role<>'owner';
 if not found then raise exception 'Member not found or owner protected'; end if;
 when 'transfer_owner' then
 eid:=(payload->>'user_id')::uuid;
 if eid=u or not exists(select 1 from public.guild_memberships where guild_id=g and user_id=eid) then raise exception 'Choose another existing member'; end if;
 update public.guild_memberships set role='officer' where guild_id=g and user_id=u;
 update public.guild_memberships set role='owner' where guild_id=g and user_id=eid;
 update public.guilds set owner_id=eid where id=g;
 when 'character' then
 eid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.guild_characters where id=eid and guild_id<>g) then raise exception 'Invalid character'; end if;
 insert into public.guild_characters(id,guild_id,name,cp,is_officer,user_id,active)
 values(eid,g,trim(payload->>'name'),nullif(payload->>'cp','')::bigint,coalesce((payload->>'is_officer')::boolean,false),nullif(payload->>'user_id','')::uuid,coalesce((payload->>'active')::boolean,true))
 on conflict(id) do update set name=excluded.name,cp=excluded.cp,is_officer=excluded.is_officer,user_id=excluded.user_id,active=excluded.active;
 when 'settings' then
 if jsonb_array_length(payload->'tiers')<>5 then raise exception 'Exactly five tiers required'; end if;
 insert into public.guild_rule_versions(guild_id,created_by) values(g,u) returning id into rule;
 for n in reverse 5..1 loop
 select value into item from jsonb_array_elements(payload->'tiers') where (value->>'tier')::integer=n;
 if item is null or (item->>'min_cp')::bigint<=previous_cp or (n=5 and (item->>'min_cp')::bigint<>0) or (item->>'weight')::integer<previous_weight then raise exception 'Invalid tier boundaries or weights'; end if;
 insert into public.guild_tier_rules values(rule,n,(item->>'min_cp')::bigint,(item->>'weight')::integer);
 previous_cp:=(item->>'min_cp')::bigint; previous_weight:=(item->>'weight')::integer;
 end loop;
 when 'create_raid' then
 insert into public.raids(guild_id,name,raid_date) values(g,trim(payload->>'name'),(payload->>'raid_date')::date) returning id into rid;
 result:=jsonb_build_object('id',rid);
 else
 rid:=(payload->>'raid_id')::uuid;
 select * into r from public.raids where id=rid and guild_id=g for update;
 if r.id is null then raise exception 'Raid not found'; end if;
 before_data:=jsonb_build_object('raid',to_jsonb(r));
 if action in ('participants','lock','unlock') then
 before_data:=before_data||jsonb_build_object('participants',(select jsonb_agg(to_jsonb(p)) from public.raid_participants p where raid_id=rid));
 elsif action='delete_transaction' then
 before_data:=before_data||jsonb_build_object('transactions',(select jsonb_agg(to_jsonb(t)) from public.raid_transactions t where raid_id=rid));
 elsif action='payment' then
 before_data:=before_data||jsonb_build_object('payment',(select to_jsonb(p) from public.raid_payments p where allocation_id=(payload->>'allocation_id')::uuid and guild_id=g));
 end if;
 if (payload->>'version')::integer is distinct from r.version then raise exception 'Data changed. Refresh before trying again.'; end if;
 if action='revise' then
 if r.status<>'final' or reason='' or exists(select 1 from public.raid_allocations x join public.raid_payments p on p.allocation_id=x.id where x.raid_id=rid) then raise exception 'Revision requires an unpaid final raid and a reason'; end if;
 insert into public.raids(guild_id,name,raid_date,revision_of) values(g,r.name,r.raid_date,rid) returning id into eid;
 insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tier,weight,tie_order)
 select guild_id,eid,character_id,name,cp,null,null,tie_order from public.raid_participants where raid_id=rid;
 insert into public.raid_transactions(guild_id,raid_id,currency,kind,amount,label,conversion_id)
 select guild_id,eid,currency,kind,amount,label,conversion_id from public.raid_transactions where raid_id=rid;
 result:=jsonb_build_object('id',eid);
 elsif action='payment' then
 if r.status<>'final' then raise exception 'Only final raids can be paid'; end if;
 select * into a from public.raid_allocations where id=(payload->>'allocation_id')::uuid and raid_id=rid;
 if a.id is null or a.amount=0 then raise exception 'Invalid allocation'; end if;
 if not coalesce((payload->>'paid')::boolean,false) and reason='' then raise exception 'A reversal needs a reason'; end if;
 if exists(select 1 from public.raids where revision_of=rid and status in ('draft','locked')) then raise exception 'Cancel or finalize the pending revision before payment'; end if;
 insert into public.raid_payments(allocation_id,guild_id,paid,paid_at,recorded_by,reference)
 values(a.id,g,(payload->>'paid')::boolean,case when (payload->>'paid')::boolean then now() end,u,left(coalesce(payload->>'reference',''),500))
 on conflict(allocation_id) do update set paid=excluded.paid,paid_at=excluded.paid_at,recorded_by=u,reference=excluded.reference;
 elsif action='cancel_revision' then
 if r.revision_of is null or r.status not in ('draft','locked') or reason='' then raise exception 'Only a pending revision can be cancelled with a reason'; end if;
 update public.raids set status='superseded' where id=rid;
 else
 if r.status not in ('draft','locked') then raise exception 'Final results cannot be edited'; end if;
 case action
 when 'participants' then
 if r.status<>'draft' then raise exception 'Unlock participants first'; end if;
 if jsonb_array_length(payload->'ids')>500 then raise exception 'Maximum 500 participants'; end if;
 delete from public.raid_participants where raid_id=rid;
 n:=0;
 for item in select value from jsonb_array_elements(payload->'ids') loop
 n:=n+1;
 insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tie_order)
 select g,rid,id,name,cp,n from public.guild_characters where id=(item#>>'{}')::uuid and guild_id=g and active;
 if not found then raise exception 'Invalid or archived character'; end if;
 end loop;
 when 'lock' then
 if r.status<>'draft' then raise exception 'Already locked'; end if;
 select id into rule from public.guild_rule_versions where guild_id=g order by created_at desc limit 1;
 if rule is null then raise exception 'Configure CP tiers first'; end if;
 if not exists(select 1 from public.raid_participants where raid_id=rid) then raise exception 'Select participants first'; end if;
 if exists(select 1 from public.raid_participants p join public.guild_characters c on c.id=p.character_id where p.raid_id=rid and (c.cp is null or not c.active)) then raise exception 'Participants must be active and have CP'; end if;
 -- Move existing order out of the new range to avoid transient unique collisions.
 update public.raid_participants set tie_order=tie_order+1000 where raid_id=rid;
 with shuffled as (select character_id,row_number() over(order by gen_random_uuid())::integer as ord from public.raid_participants where raid_id=rid)
 update public.raid_participants p set name=c.name,cp=c.cp,tier=t.tier,weight=t.weight,tie_order=s.ord
 from public.guild_characters c join lateral(select tier,weight from public.guild_tier_rules where rule_id=rule and min_cp<=c.cp order by min_cp desc limit 1)t on true,
 shuffled s where p.raid_id=rid and p.character_id=c.id and s.character_id=p.character_id;
 update public.raids set status='locked',rule_id=rule where id=rid;
 when 'unlock' then
 if r.status<>'locked' or reason='' then raise exception 'Unlocking needs a reason'; end if;
 update public.raids set status='draft',rule_id=null where id=rid;
 update public.raid_participants set tier=null,weight=null where raid_id=rid;
 when 'transaction' then
 insert into public.raid_transactions(guild_id,raid_id,currency,kind,amount,label)
 values(g,rid,payload->>'currency',payload->>'kind',(payload->>'amount')::bigint,trim(payload->>'label'));
 when 'conversion' then
 eid:=gen_random_uuid();
 insert into public.raid_transactions(guild_id,raid_id,currency,kind,amount,label,conversion_id) values
 (g,rid,'diamond','deduction',(payload->>'diamond')::bigint,'Diamond sold',eid),
 (g,rid,'idr','income',(payload->>'idr')::bigint,'Diamond sale proceeds (net)',eid);
 when 'delete_transaction' then
 select conversion_id into eid from public.raid_transactions where id=(payload->>'id')::uuid and raid_id=rid;
 delete from public.raid_transactions where raid_id=rid and (id=(payload->>'id')::uuid or (eid is not null and conversion_id=eid));
 when 'finalize' then
 if r.status<>'locked' then raise exception 'Lock participants before finalizing'; end if;
 if r.revision_of is not null then
 if exists(select 1 from public.raid_allocations x join public.raid_payments p on p.allocation_id=x.id where x.raid_id=r.revision_of) then raise exception 'Original raid has payments'; end if;
 update public.raids set status='superseded',version=version+1 where id=r.revision_of and status='final';
 if not found then raise exception 'Original raid is no longer final'; end if;
 end if;
 select sum(weight) into weights from public.raid_participants where raid_id=rid;
 if weights is null or weights<=0 then raise exception 'Invalid participant weights'; end if;
 foreach money in array array['diamond','idr'] loop
 select coalesce(sum(case when kind='income' then amount else -amount end),0) into total from public.raid_transactions where raid_id=rid and currency=money;
 if total<0 or total>1000000000000 then raise exception 'Net balance must be between 0 and 1,000,000,000,000'; end if;
 with shares as (
 select character_id,tie_order,(total::numeric*weight/weights) as ideal from public.raid_participants where raid_id=rid
 ), ranked as (
 select *,row_number() over(order by ideal-floor(ideal) desc,tie_order) as rank,
 total-sum(floor(ideal)) over() as leftover from shares
 )
 insert into public.raid_allocations(guild_id,raid_id,character_id,currency,amount,rounding_bonus)
 select g,rid,character_id,money,floor(ideal)::bigint+case when rank<=leftover then 1 else 0 end,case when rank<=leftover then 1 else 0 end from ranked;
 end loop;
 update public.raids set status='final',finalized_at=now() where id=rid;
 else raise exception 'Unknown raid action';
 end case;
 end if;
 update public.raids set version=version+1 where id=rid;
 end case;
 end if;
 -- Tokens and invitation addresses are not copied into audit payloads.
 insert into public.audit_logs(guild_id,actor_id,action,entity_id,details)
 values(g,u,action,coalesce(rid,eid,g),jsonb_build_object('before',before_data,'input',payload-'token','result',result-'token'));
 return result;
end $$;

create function private.staff_command(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare g uuid; target uuid; invitation public.guild_invites%rowtype;
begin
 if private.current_staff_id() is null or not exists(select 1 from private.staff_accounts where id=private.current_staff_id()) then raise exception 'Sign in as an officer first'; end if;
 if action='invite' and (payload->>'role') is distinct from 'officer' then
   raise exception 'Invitations are for officers only. Members use the public lookup.';
 end if;
 if action='role' then raise exception 'Member accounts are no longer used. Invite or remove an officer instead.'; end if;
 if action='accept_invite' then
   select * into invitation from public.guild_invites where token_hash=encode(sha256(convert_to(payload->>'token','UTF8')),'hex');
   if invitation.id is null or invitation.role<>'officer' then raise exception 'Invalid officer invitation'; end if;
   -- Match the original lock order and validate before upgrading a legacy member.
   perform 1 from public.guilds where id=invitation.guild_id for update;
   select * into invitation from public.guild_invites where id=invitation.id for update;
   if invitation.revoked or invitation.accepted_at is not null or invitation.expires_at<=now()
     or not exists(select 1 from private.staff_accounts where id=private.current_staff_id() and username=invitation.username)
     then raise exception 'Invitation expired, used, revoked, or username does not match'; end if;
   update public.guild_memberships set role='officer' where guild_id=invitation.guild_id and user_id=private.current_staff_id() and role='member';
 end if;
 if action in ('transfer_owner','remove_officer') then
   g:=(payload->>'guild_id')::uuid; target:=(payload->>'user_id')::uuid;
   perform 1 from public.guilds where id=g for update;
   if private.guild_role(g) is distinct from 'owner' then raise exception 'Owner access required'; end if;
   if not exists(select 1 from public.guild_memberships where guild_id=g and user_id=target and role='officer') then raise exception 'Choose an existing officer'; end if;
   if action='remove_officer' then
     update public.guild_characters set user_id=null where guild_id=g and user_id=target;
     delete from public.guild_memberships where guild_id=g and user_id=target and role='officer';
     insert into public.audit_logs(guild_id,actor_id,action,entity_id,details)
     values(g,private.current_staff_id(),action,target,jsonb_build_object('previous_role','officer'));
     return '{}'::jsonb;
   end if;
 end if;
 return private.guild_command(action,payload);
end $$;

-- Only the Next.js server (service_role) may create accounts/sessions or dispatch
-- private reads/writes. Never expose the service key in browser configuration.
create function public.staff_auth(operation text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.staff_accounts%rowtype; count_attempts integer; session_hash text;
begin
 case operation
 when 'attempt' then
   if length(payload->>'bucket')<>64 then raise exception 'Invalid attempt bucket'; end if;
   delete from private.auth_attempts where window_start<now()-interval '1 day';
   insert into private.auth_attempts(bucket,attempts,window_start) values(payload->>'bucket',1,now())
   on conflict(bucket) do update set
     attempts=case when private.auth_attempts.window_start<now()-interval '15 minutes' then 1 else private.auth_attempts.attempts+1 end,
     window_start=case when private.auth_attempts.window_start<now()-interval '15 minutes' then now() else private.auth_attempts.window_start end
   returning attempts into count_attempts;
   return jsonb_build_object('allowed',count_attempts<=20);
 when 'credentials' then
   select * into a from private.staff_accounts where username=payload->>'username';
   if a.id is null then return 'null'::jsonb; end if;
   return jsonb_build_object('id',a.id,'username',a.username,'password_hash',a.password_hash);
 when 'register' then
   if left(payload->>'username',7)='legacy_' then raise exception 'Username reserved'; end if;
   if coalesce(payload->>'password_hash','') !~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'Invalid password hash'; end if;
   insert into private.staff_accounts(username,password_hash) values(payload->>'username',payload->>'password_hash') returning * into a;
   insert into public.profiles(id,display_name) values(a.id,a.username);
   insert into private.staff_sessions(token_hash,account_id) values(payload->>'token_hash',a.id);
   return jsonb_build_object('id',a.id,'username',a.username);
 when 'session' then
   select * into a from private.staff_accounts where id=(payload->>'account_id')::uuid and password_hash is not null;
   if a.id is null then raise exception 'Account not found'; end if;
   delete from private.staff_sessions where expires_at<=now();
   insert into private.staff_sessions(token_hash,account_id) values(payload->>'token_hash',a.id);
   return jsonb_build_object('id',a.id,'username',a.username);
 when 'logout' then
   delete from private.staff_sessions where token_hash=payload->>'token_hash';
   return '{}'::jsonb;
 when 'user' then
   select x.* into a from private.staff_accounts x join private.staff_sessions s on s.account_id=x.id where s.token_hash=payload->>'token_hash' and s.expires_at>now();
   if a.id is null then return 'null'::jsonb; end if;
   return jsonb_build_object('id',a.id,'username',a.username);
 else raise exception 'Unknown authentication operation';
 end case;
end $$;

create function public.staff_gateway(token_hash text, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; g uuid; r uuid; result jsonb;
begin
 select account_id into u from private.staff_sessions s where s.token_hash=staff_gateway.token_hash and expires_at>now();
 if u is null then raise exception 'Session expired. Please sign in again.' using errcode='28000'; end if;
 perform set_config('rf.staff_id',u::text,true);
 if operation='command' then return private.staff_command(payload->>'action',coalesce(payload->'payload','{}'::jsonb)); end if;
 if operation='guilds' then
   select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into result
   from public.guilds x join public.guild_memberships m on m.guild_id=x.id where m.user_id=u and m.role in ('owner','officer');
   return result;
 end if;
 g:=(payload->>'guild_id')::uuid;
 if private.guild_role(g) is null then raise exception 'Officer access required' using errcode='42501'; end if;
 if operation='guild' then
   return jsonb_build_object(
     'guild',(select to_jsonb(x) from public.guilds x where id=g),
     'role',private.guild_role(g),
     'characters',(select coalesce(jsonb_agg(to_jsonb(x) order by name,id),'[]'::jsonb) from public.guild_characters x where guild_id=g),
     'memberships',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('username',a.username) order by role,user_id),'[]'::jsonb) from public.guild_memberships x join private.staff_accounts a on a.id=x.user_id where guild_id=g and role in ('owner','officer')),
     'rules',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('guild_tier_rules',(select jsonb_agg(to_jsonb(t) order by tier) from public.guild_tier_rules t where rule_id=x.id)) order by created_at desc),'[]'::jsonb) from public.guild_rule_versions x where guild_id=g),
     'raids',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]'::jsonb) from public.raids x where guild_id=g),
     'invites',(select coalesce(jsonb_agg(to_jsonb(x)-'token_hash' order by expires_at desc),'[]'::jsonb) from public.guild_invites x where guild_id=g and private.guild_role(g)='owner' and role='officer'),
     'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]'::jsonb) from (select * from public.audit_logs where guild_id=g order by created_at desc limit 50)x)
   );
 elsif operation='raid' then
   r:=(payload->>'raid_id')::uuid;
   if not exists(select 1 from public.raids where id=r and guild_id=g) then raise exception 'Raid not found'; end if;
   return jsonb_build_object(
     'participants',(select coalesce(jsonb_agg(to_jsonb(x) order by tie_order),'[]'::jsonb) from public.raid_participants x where raid_id=r),
     'transactions',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from public.raid_transactions x where raid_id=r),
     'allocations',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from public.raid_allocations x where raid_id=r),
     'payments',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.raid_payments x join public.raid_allocations a on a.id=x.allocation_id where a.raid_id=r)
   );
 end if;
 raise exception 'Unknown operation';
end $$;
-- Remove the old Supabase-authenticated entry point. No browser account/JWT can
-- invoke the internal mutation implementation or read private tables directly.
drop function public.guild_command(text,jsonb);
revoke all on function private.guild_command(text,jsonb),private.staff_command(text,jsonb),private.current_staff_id() from public,anon,authenticated;
revoke all on function public.staff_auth(text,jsonb),public.staff_gateway(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.staff_auth(text,jsonb),public.staff_gateway(text,text,jsonb) to service_role;
do $$ declare t text; begin
 foreach t in array array['profiles','guilds','guild_memberships','guild_invites','guild_characters','guild_rule_versions','guild_tier_rules','raids','raid_participants','raid_transactions','raid_allocations','raid_payments','audit_logs'] loop
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;
grant execute on function public.lookup_member_rewards(text,text,text,integer) to service_role;
commit;

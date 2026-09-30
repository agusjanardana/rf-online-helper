-- All writes go through guild_command. RLS also protects direct reads.
create schema if not exists private;
revoke all on schema private from public;
create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null default ''
);
create table public.guilds (
 id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 80),
 server text not null check (length(trim(server)) between 1 and 80), owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.guild_memberships (
 guild_id uuid not null references public.guilds(id), user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','officer','member')), primary key(guild_id,user_id)
);
create unique index one_owner_per_guild on public.guild_memberships(guild_id) where role='owner';
create table public.guild_invites (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null references public.guilds(id),
 email text not null, role text not null check(role in ('officer','member')),
 token_hash text not null unique, expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, revoked boolean not null default false
);
create table public.guild_characters (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null references public.guilds(id),
 name text not null check(length(trim(name)) between 1 and 80), cp bigint check(cp between 0 and 1000000000000),
 is_officer boolean not null default false, user_id uuid, active boolean not null default true,
 unique(guild_id,id), foreign key(guild_id,user_id) references public.guild_memberships(guild_id,user_id)
);
create unique index unique_character_name on public.guild_characters(guild_id,lower(name));
create table public.guild_rule_versions (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null references public.guilds(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp(), unique(guild_id,id)
);
create table public.guild_tier_rules (
 rule_id uuid not null references public.guild_rule_versions(id), tier integer not null check(tier between 1 and 5),
 min_cp bigint not null check(min_cp between 0 and 1000000000000), weight integer not null check(weight between 1 and 100000),
 primary key(rule_id,tier)
);
create table public.raids (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null references public.guilds(id),
 name text not null check(length(trim(name)) between 1 and 120), raid_date date not null,
 status text not null default 'draft' check(status in ('draft','locked','final','superseded')),
 version integer not null default 0, rule_id uuid, revision_of uuid, finalized_at timestamptz,
 created_at timestamptz not null default now(), unique(guild_id,id),
 foreign key(guild_id,rule_id) references public.guild_rule_versions(guild_id,id),
 foreign key(guild_id,revision_of) references public.raids(guild_id,id)
);
create unique index one_active_revision on public.raids(revision_of) where revision_of is not null and status <> 'superseded';
create table public.raid_participants (
 guild_id uuid not null, raid_id uuid not null, character_id uuid not null,
 name text not null, cp bigint, tier integer check(tier between 1 and 5), weight integer check(weight > 0), tie_order integer not null,
 primary key(raid_id,character_id), unique(raid_id,tie_order),
 foreign key(guild_id,raid_id) references public.raids(guild_id,id),
 foreign key(guild_id,character_id) references public.guild_characters(guild_id,id)
);
create table public.raid_transactions (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null, raid_id uuid not null,
 currency text not null check(currency in ('diamond','idr')), kind text not null check(kind in ('income','deduction')),
 amount bigint not null check(amount between 1 and 1000000000000), label text not null check(length(trim(label)) between 1 and 200),
 conversion_id uuid, foreign key(guild_id,raid_id) references public.raids(guild_id,id)
);
create table public.raid_allocations (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null, raid_id uuid not null, character_id uuid not null,
 currency text not null check(currency in ('diamond','idr')), amount bigint not null check(amount>=0), rounding_bonus integer not null check(rounding_bonus in (0,1)),
 unique(raid_id,character_id,currency), unique(guild_id,id),
 foreign key(guild_id,raid_id) references public.raids(guild_id,id),
 foreign key(raid_id,character_id) references public.raid_participants(raid_id,character_id)
);
create table public.raid_payments (
 allocation_id uuid primary key, guild_id uuid not null, paid boolean not null default true,
 paid_at timestamptz, recorded_by uuid not null references auth.users(id), reference text not null default '',
 foreign key(guild_id,allocation_id) references public.raid_allocations(guild_id,id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), guild_id uuid not null references public.guilds(id),
 actor_id uuid not null references auth.users(id), action text not null, entity_id uuid,
 details jsonb not null default '{}', created_at timestamptz not null default clock_timestamp()
);
create index membership_user on public.guild_memberships(user_id);
create index characters_guild on public.guild_characters(guild_id);
create index raids_guild on public.raids(guild_id);
create index transactions_raid on public.raid_transactions(raid_id);
create index audit_guild on public.audit_logs(guild_id,created_at desc);

create function private.guild_role(g uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.guild_memberships where guild_id=g and user_id=auth.uid()
$$;
create function private.can_read_raid(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.raids where id=r and
 (private.guild_role(guild_id) in ('owner','officer') or (private.guild_role(guild_id)='member' and (status='final' or (status='superseded' and finalized_at is not null)))))
$$;
grant usage on schema private to authenticated;
grant execute on function private.guild_role(uuid), private.can_read_raid(uuid) to authenticated;
revoke execute on function private.guild_role(uuid), private.can_read_raid(uuid) from public, anon;

do $$ declare t text; begin
 foreach t in array array['profiles','guilds','guild_memberships','guild_invites','guild_characters','guild_rule_versions','guild_tier_rules','raids','raid_participants','raid_transactions','raid_allocations','raid_payments','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy profile_self on public.profiles for select to authenticated using(id=auth.uid());
create policy guild_read on public.guilds for select to authenticated using(private.guild_role(id) is not null);
create policy memberships_read on public.guild_memberships for select to authenticated using(private.guild_role(guild_id) is not null);
create policy invites_read on public.guild_invites for select to authenticated using(private.guild_role(guild_id)='owner');
create policy characters_read on public.guild_characters for select to authenticated using(private.guild_role(guild_id) is not null);
create policy rules_read on public.guild_rule_versions for select to authenticated using(private.guild_role(guild_id) is not null);
create policy tiers_read on public.guild_tier_rules for select to authenticated using(exists(select 1 from public.guild_rule_versions v where v.id=rule_id and private.guild_role(v.guild_id) is not null));
create policy raids_read on public.raids for select to authenticated using(private.can_read_raid(id));
create policy participants_read on public.raid_participants for select to authenticated using(private.can_read_raid(raid_id));
create policy transactions_read on public.raid_transactions for select to authenticated using(private.can_read_raid(raid_id));
create policy allocations_read on public.raid_allocations for select to authenticated using(private.can_read_raid(raid_id));
create policy payments_read on public.raid_payments for select to authenticated using(exists(select 1 from public.raid_allocations a where a.id=allocation_id and private.can_read_raid(a.raid_id)));
create policy audit_read on public.audit_logs for select to authenticated using(private.guild_role(guild_id) in ('owner','officer'));

create function public.guild_command(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid := auth.uid(); g uuid; eid uuid; rid uuid; rule uuid; role_name text; token text; reason text;
 r public.raids%rowtype; inv public.guild_invites%rowtype; a public.raid_allocations%rowtype;
 item jsonb; n integer; previous_cp bigint := -1; previous_weight integer := 0;
 total bigint; weights bigint; money text; result jsonb := '{}'; before_data jsonb := '{}';
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then
 raise exception 'Login with a verified email first'; end if;
 insert into public.profiles(id,display_name) values(u,coalesce((select raw_user_meta_data->>'name' from auth.users where id=u),'')) on conflict do nothing;
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
 inv.email <> lower((select email from auth.users where id=u)) then raise exception 'Invitation expired, used, revoked, or email does not match'; end if;
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
 if trim(payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.guild_invites(guild_id,email,role,token_hash) values(g,lower(trim(payload->>'email')),payload->>'role',encode(sha256(convert_to(token,'UTF8')),'hex')) returning id into eid;
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
 values(g,u,action,coalesce(rid,eid,g),jsonb_build_object('before',before_data,'input',payload-'token'-'email','result',result-'token'));
 return result;
end $$;
revoke all on function public.guild_command(text,jsonb) from public,anon;
grant execute on function public.guild_command(text,jsonb) to authenticated;

-- Members look up their own allocation by character + server + guild.
-- These names are a public lookup key, not proof of identity.
-- Existing tables remain private; only the limited result below is public.
begin;

create or replace function private.guild_role(g uuid) returns text
language sql stable security definer set search_path='' as $$
 select role from public.guild_memberships
 where guild_id=g and user_id=auth.uid() and role in ('owner','officer')
$$;

-- Preserve legacy membership records without retaining member dashboard access.
update public.guild_invites set revoked=true where role='member' and accepted_at is null;

-- Keep the original mutation implementation private. The public entry point
-- restricts invitation/ownership operations to the new staff-only access model.
alter function public.guild_command(text,jsonb) set schema private;
revoke all on function private.guild_command(text,jsonb) from public,anon,authenticated;
create function public.guild_command(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare g uuid; target uuid; invitation public.guild_invites%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Sign in with a verified officer account first'; end if;
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
     or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=invitation.email)
     then raise exception 'Invitation expired, used, revoked, or email does not match'; end if;
   update public.guild_memberships set role='officer' where guild_id=invitation.guild_id and user_id=auth.uid() and role='member';
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
     values(g,auth.uid(),action,target,jsonb_build_object('previous_role','officer'));
     return '{}'::jsonb;
   end if;
 end if;
 return private.guild_command(action,payload);
end $$;
revoke all on function public.guild_command(text,jsonb) from public,anon;
grant execute on function public.guild_command(text,jsonb) to authenticated;

create index guild_lookup_names on public.guilds(lower(btrim(name)),lower(btrim(server)));
create index character_lookup_names on public.guild_characters(guild_id,lower(btrim(name)));

create function public.lookup_member_rewards(character_name text, server_name text, guild_name text, page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare matches integer; character_row public.guild_characters%rowtype; guild_row public.guilds%rowtype; rows_json jsonb;
begin
 if character_name is null or server_name is null or guild_name is null
   or length(btrim(character_name)) not between 1 and 80
   or length(btrim(server_name)) not between 1 and 80
   or length(btrim(guild_name)) not between 1 and 80
   or page_offset is null or page_offset<0 or page_offset>100000 then
   raise exception 'Enter a character name, server, and guild (maximum 80 characters each)';
 end if;
 select count(*) into matches from public.guild_characters c join public.guilds g on g.id=c.guild_id
 where lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 if matches=0 then return jsonb_build_object('status','not_found'); end if;
 if matches<>1 then return jsonb_build_object('status','ambiguous'); end if;
 select c.* into character_row from public.guild_characters c join public.guilds g on g.id=c.guild_id
 where lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 select * into guild_row from public.guilds where id=character_row.guild_id;
 -- Return at most 25 raids plus one look-ahead row. No other members, accounts,
 -- draft raids, audit records, or transfer references are returned.
 select coalesce(jsonb_agg(q.row order by q.raid_date desc,q.finalized_at desc,q.id),'[]'::jsonb) into rows_json from (
   select r.id,r.raid_date,r.finalized_at,jsonb_build_object(
     'raid_name',r.name,'raid_date',r.raid_date,'character_name',p.name,'cp',p.cp,'tier',p.tier,'weight',p.weight,
     'diamond',coalesce(d.amount,0),'idr',coalesce(i.amount,0),
     'diamond_paid',coalesce(dp.paid,false),'idr_paid',coalesce(ip.paid,false),
     'diamond_paid_at',case when dp.paid then dp.paid_at end,'idr_paid_at',case when ip.paid then ip.paid_at end
   ) as row
   from public.raids r join public.raid_participants p on p.raid_id=r.id and p.character_id=character_row.id
   left join public.raid_allocations d on d.raid_id=r.id and d.character_id=p.character_id and d.currency='diamond'
   left join public.raid_allocations i on i.raid_id=r.id and i.character_id=p.character_id and i.currency='idr'
   left join public.raid_payments dp on dp.allocation_id=d.id
   left join public.raid_payments ip on ip.allocation_id=i.id
   where r.guild_id=guild_row.id and r.status='final'
   order by r.raid_date desc,r.finalized_at desc,r.id limit 26 offset page_offset
 ) q;
 return jsonb_build_object('status','found','character_name',character_row.name,'guild_name',guild_row.name,'server_name',guild_row.server,
 'rows',case when jsonb_array_length(rows_json)>25 then rows_json-25 else rows_json end,'has_more',jsonb_array_length(rows_json)>25);
end $$;
revoke all on function public.lookup_member_rewards(text,text,text,integer) from public;
grant execute on function public.lookup_member_rewards(text,text,text,integer) to anon,authenticated;
commit;

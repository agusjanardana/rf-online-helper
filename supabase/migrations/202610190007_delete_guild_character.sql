-- Remove members from current rosters while retaining historical raid snapshots.
begin;
alter table public.guild_characters add column deleted_at timestamptz;
drop index public.unique_character_name;
create unique index unique_character_name on public.guild_characters(guild_id,lower(name)) where deleted_at is null;
alter function private.staff_command(text,jsonb) rename to staff_command_before_character_delete;
create function private.staff_command(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare g uuid; c public.guild_characters%rowtype;
begin
 if action not in ('delete_character','character') then return private.staff_command_before_character_delete(action,payload); end if;
 g:=(payload->>'guild_id')::uuid;
 perform 1 from public.guilds where id=g for update;
 if private.guild_role(g) is null or private.guild_role(g) not in ('owner','officer') then raise exception 'Officer access required'; end if;
 select * into c from public.guild_characters where id=nullif(payload->>'id','')::uuid and guild_id=g for update;
 if c.deleted_at is not null then raise exception 'Character has been deleted'; end if;
 if action='character' then return private.staff_command_before_character_delete(action,payload); end if;
 if c.id is null then raise exception 'Character not found'; end if;
 -- Draft participant changes invalidate existing edits; locked/final snapshots stay intact.
 update public.raids set version=version+1 where guild_id=g and status='draft'
 and id in (select raid_id from public.raid_participants where character_id=c.id);
 delete from public.raid_participants p using public.raids r
 where p.raid_id=r.id and p.character_id=c.id and r.guild_id=g and r.status='draft';
 update public.guild_characters set deleted_at=now(),active=false,user_id=null where id=c.id;
 insert into public.audit_logs(guild_id,actor_id,action,entity_id,details)
 values(g,private.current_staff_id(),action,c.id,jsonb_build_object('name',c.name));
 return '{}'::jsonb;
end $$;
revoke all on function private.staff_command(text,jsonb),private.staff_command_before_character_delete(text,jsonb) from public,anon,authenticated;
create or replace function public.staff_gateway(token_hash text, operation text, payload jsonb default '{}') returns jsonb
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
     'characters',(select coalesce(jsonb_agg(to_jsonb(x) order by name,id),'[]'::jsonb) from public.guild_characters x where guild_id=g and deleted_at is null),
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
create or replace function public.lookup_member_rewards(character_name text, server_name text, guild_name text, page_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare matches integer; character_row public.guild_characters%rowtype; guild_row public.guilds%rowtype; rows_json jsonb; members_json jsonb;
begin
 if character_name is null or server_name is null or guild_name is null
   or length(btrim(character_name)) not between 1 and 80
   or length(btrim(server_name)) not between 1 and 80
   or length(btrim(guild_name)) not between 1 and 80
   or page_offset is null or page_offset<0 or page_offset>100000 then
   raise exception 'Enter a character name, server, and guild (maximum 80 characters each)';
 end if;
 select count(*) into matches from public.guild_characters c join public.guilds g on g.id=c.guild_id
 where c.deleted_at is null and lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 if matches=0 then return jsonb_build_object('status','not_found'); end if;
 if matches<>1 then return jsonb_build_object('status','ambiguous'); end if;
 select c.* into character_row from public.guild_characters c join public.guilds g on g.id=c.guild_id
 where c.deleted_at is null and lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 select * into guild_row from public.guilds where id=character_row.guild_id;
 -- Current roster is separate from the immutable participant snapshots.
 select coalesce(jsonb_agg(jsonb_build_object(
   'character_name',c.name,'cp',c.cp,'active',c.active,'is_officer',c.is_officer,
   'is_searched',c.id=character_row.id
 ) order by c.active desc,lower(c.name),c.id),'[]'::jsonb) into members_json
 from public.guild_characters c where c.guild_id=guild_row.id and c.deleted_at is null;
 -- Paginate complete raids so every participant remains visible together.
 select coalesce(jsonb_agg(jsonb_build_object(
   'raid_name',r.name,'raid_date',r.raid_date,
   'participants',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'character_name',p.name,'cp',p.cp,'tier',p.tier,'weight',p.weight,
       'is_searched',p.character_id=character_row.id,
       'diamond',coalesce(d.amount,0),'idr',coalesce(i.amount,0),
       'diamond_paid',coalesce(dp.paid,false),'idr_paid',coalesce(ip.paid,false),
       'diamond_paid_at',case when dp.paid then dp.paid_at end,
       'idr_paid_at',case when ip.paid then ip.paid_at end
     ) order by p.tie_order,p.character_id),'[]'::jsonb)
     from public.raid_participants p
     left join public.raid_allocations d on d.raid_id=p.raid_id and d.character_id=p.character_id and d.currency='diamond'
     left join public.raid_allocations i on i.raid_id=p.raid_id and i.character_id=p.character_id and i.currency='idr'
     left join public.raid_payments dp on dp.allocation_id=d.id
     left join public.raid_payments ip on ip.allocation_id=i.id
     where p.raid_id=r.id
   )
 ) order by r.raid_date desc,r.finalized_at desc,r.id),'[]'::jsonb) into rows_json
 from (select * from public.raids where guild_id=guild_row.id and status='final' and member_visible
   order by raid_date desc,finalized_at desc,id limit 11 offset page_offset) r;
 return jsonb_build_object('status','found','character_name',character_row.name,'guild_name',guild_row.name,'server_name',guild_row.server,
 'members',members_json,'raids',case when jsonb_array_length(rows_json)>10 then rows_json-10 else rows_json end,'has_more',jsonb_array_length(rows_json)>10);
end $$;
revoke all on function public.lookup_member_rewards(text,text,text,integer) from public;
grant execute on function public.lookup_member_rewards(text,text,text,integer) to anon,authenticated,service_role;
commit;

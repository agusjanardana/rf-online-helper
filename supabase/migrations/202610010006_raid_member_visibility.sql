-- Existing raids stay visible; staff can hide them from public member results.
begin;
alter table public.raids add column member_visible boolean not null default true;
alter function private.staff_command(text,jsonb) rename to staff_command_before_visibility;
create function private.staff_command(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare g uuid; r public.raids%rowtype; visible boolean;
begin
 if action <> 'raid_member_visibility' then return private.staff_command_before_visibility(action,payload); end if;
 g := (payload->>'guild_id')::uuid;
 perform 1 from public.guilds where id=g for update;
 if private.guild_role(g) is null or private.guild_role(g) not in ('owner','officer') then raise exception 'Officer access required'; end if;
 if jsonb_typeof(payload->'member_visible') is distinct from 'boolean' then raise exception 'Choose visibility'; end if;
 visible := (payload->>'member_visible')::boolean;
 select * into r from public.raids where id=(payload->>'raid_id')::uuid and guild_id=g for update;
 if r.id is null then raise exception 'Raid not found'; end if;
 update public.raids set member_visible=visible where id=r.id;
 insert into public.audit_logs(guild_id,actor_id,action,entity_id,details)
 values(g,private.current_staff_id(),action,r.id,jsonb_build_object('before',r.member_visible,'after',visible));
 return jsonb_build_object('member_visible',visible);
end $$;
revoke all on function private.staff_command(text,jsonb),private.staff_command_before_visibility(text,jsonb) from public,anon,authenticated;
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
 where lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 if matches=0 then return jsonb_build_object('status','not_found'); end if;
 if matches<>1 then return jsonb_build_object('status','ambiguous'); end if;
 select c.* into character_row from public.guild_characters c join public.guilds g on g.id=c.guild_id
 where lower(btrim(c.name))=lower(btrim(character_name))
 and lower(btrim(g.name))=lower(btrim(guild_name)) and lower(btrim(g.server))=lower(btrim(server_name));
 select * into guild_row from public.guilds where id=character_row.guild_id;
 -- Current roster is separate from the immutable participant snapshots.
 select coalesce(jsonb_agg(jsonb_build_object(
   'character_name',c.name,'cp',c.cp,'active',c.active,'is_officer',c.is_officer,
   'is_searched',c.id=character_row.id
 ) order by c.active desc,lower(c.name),c.id),'[]'::jsonb) into members_json
 from public.guild_characters c where c.guild_id=guild_row.id;
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

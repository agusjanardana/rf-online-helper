begin;
create function public.member_suggestions(server_name text,guild_name text,name_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if server_name is null or guild_name is null or name_query is null
 or length(btrim(server_name)) not between 1 and 80
 or length(btrim(guild_name)) not between 1 and 80
 or length(btrim(name_query)) not between 1 and 80 then return '[]'::jsonb; end if;
 return (select coalesce(jsonb_agg(name order by lower(name),name),'[]'::jsonb) from (
   select distinct c.name from public.guild_characters c join public.guilds g on g.id=c.guild_id
   where c.deleted_at is null and lower(btrim(g.server))=lower(btrim(server_name))
   and lower(btrim(g.name))=lower(btrim(guild_name))
   and strpos(lower(c.name),lower(btrim(name_query)))>0
   order by c.name limit 10
 ) matches);
end $$;
revoke all on function public.member_suggestions(text,text,text) from public,anon,authenticated;
grant execute on function public.member_suggestions(text,text,text) to service_role;
commit;

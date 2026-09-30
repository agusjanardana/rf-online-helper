-- Only public guild/server names are exposed for the member search selectors.
begin;
create or replace function public.member_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('server',server,'guild',name) order by lower(server),lower(name)),'[]'::jsonb)
 from (select distinct btrim(server) as server,btrim(name) as name from public.guilds) g
$$;
revoke all on function public.member_directory() from public,anon,authenticated;
grant execute on function public.member_directory() to service_role;
commit;

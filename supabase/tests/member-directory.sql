\set ON_ERROR_STOP on
begin;
do $$
declare u uuid:=gen_random_uuid();
begin
 insert into private.staff_accounts(id,username) values(u,'directory_test');
 insert into public.guilds(name,server,owner_id) values('Directory Guild','Directory Server',u),('Directory Guild','Directory Server',u),('Another Guild','Another Server',u);
end $$;
set local role service_role;
do $$
declare result jsonb; row jsonb;
begin
 result:=public.member_directory();
 assert (select count(*) from jsonb_array_elements(result) x where x->>'server'='Directory Server' and x->>'guild'='Directory Guild')=1;
 assert exists(select 1 from jsonb_array_elements(result) x where x->>'server'='Another Server' and x->>'guild'='Another Guild');
 for row in select * from jsonb_array_elements(result) loop
  assert (select count(*) from jsonb_object_keys(row))=2;
  assert row ? 'server' and row ? 'guild';
 end loop;
 raise notice 'PASS: registered names only, duplicate pairs collapsed, no private fields';
end $$;
rollback;

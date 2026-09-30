-- Run after migration 004 in disposable PostgreSQL; every fixture rolls back.
\set ON_ERROR_STOP on
begin;
do $$
declare u uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); other_g uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); r uuid; a uuid; n integer;
begin
 insert into private.staff_accounts(id,username) values(u,'transparency_fixture');
 insert into public.guilds(id,name,server,owner_id) values(g,'Transparency Guild','Test Server',u),(other_g,'Other Guild','Test Server',u);
 insert into public.guild_characters(id,guild_id,name,cp,active) values(c,g,'Renamed',999,true),(b,g,'Archived',100,false);
 insert into public.guild_characters(guild_id,name) values(g,'No raids'),(other_g,'Secret member');
 for n in 1..13 loop
  insert into public.raids(guild_id,name,raid_date,status,finalized_at) values(g,'Raid '||n,date '2026-09-01'+n,case when n=12 then 'draft' when n=13 then 'superseded' else 'final' end,now()) returning id into r;
  insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tier,weight,tie_order) values(g,r,b,'Archived',100,5,100,1);
  insert into public.raid_allocations(guild_id,raid_id,character_id,currency,amount,rounding_bonus) values(g,r,b,'diamond',400,0) returning id into a;
  insert into public.raid_payments(allocation_id,guild_id,paid,paid_at,recorded_by,reference) values(a,g,true,now(),u,'PRIVATE BANK REFERENCE');
  if n<>11 then
   insert into public.raid_participants(guild_id,raid_id,character_id,name,cp,tier,weight,tie_order) values(g,r,c,'Old name',500,1,150,2);
   insert into public.raid_allocations(guild_id,raid_id,character_id,currency,amount,rounding_bonus) values(g,r,c,'diamond',600,0),(g,r,c,'idr',15000,0);
  end if;
 end loop;
 insert into public.raids(guild_id,name,raid_date,status) values(other_g,'Secret raid',current_date,'final');
end $$;
set local role anon;
do $$
declare data jsonb; next_page jsonb; member jsonb;
begin
 data:=public.lookup_member_rewards(' renamed ','test server','TRANSPARENCY GUILD');
 assert data->>'status'='found';
 assert jsonb_array_length(data->'members')=3;
 select x into member from jsonb_array_elements(data->'members') x where x->>'character_name'='Renamed';
 assert member->>'is_searched'='true' and member->>'cp'='999';
 assert jsonb_array_length(data->'raids')=10 and data->>'has_more'='true';
 assert data#>>'{raids,0,raid_name}'='Raid 11';
 assert jsonb_array_length(data#>'{raids,0,participants}')=1; -- absent searched member still sees raid
 assert jsonb_array_length(data#>'{raids,1,participants}')=2;
 assert data#>>'{raids,1,participants,0,diamond}'='400';
 assert data#>>'{raids,1,participants,0,diamond_paid}'='true';
 assert data#>>'{raids,1,participants,1,character_name}'='Old name';
 assert data#>>'{raids,1,participants,1,is_searched}'='true';
 assert data#>>'{raids,1,participants,1,cp}'='500';
 assert data#>>'{raids,1,participants,1,idr}'='15000';
 assert data::text not like '%PRIVATE BANK%' and data::text not like '%password%' and data::text not like '%user_id%';
 assert data::text not like '%Secret%' and data::text not like '%Raid 12%' and data::text not like '%Raid 13%';
 next_page:=public.lookup_member_rewards('Renamed','Test Server','Transparency Guild',10);
 assert jsonb_array_length(next_page->'raids')=1 and next_page->>'has_more'='false';
 assert next_page#>>'{raids,0,raid_name}'='Raid 1';
 assert public.lookup_member_rewards('No raids','Test Server','Transparency Guild')->'raids'=data->'raids' is false; -- highlight differs
 assert jsonb_array_length(public.lookup_member_rewards('No raids','Test Server','Transparency Guild')->'raids')=10;
 assert public.lookup_member_rewards('Renamed','Wrong Server','Transparency Guild')->>'status'='not_found';
 raise notice 'PASS: entire roster, complete raid pagination, other allocations, renamed highlight, snapshots, payments, guild isolation, private fields';
end $$;
rollback;
